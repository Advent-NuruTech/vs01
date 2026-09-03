import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";

export const checkoutSchema = z.object({
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(50) })).min(1),
  customer: z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(7).max(30), email: z.string().email().optional().or(z.literal("")) }),
  address: z.object({ county: z.string().trim().min(2), town: z.string().trim().min(2), area: z.string().trim().min(2), street: z.string().trim().min(2), directions: z.string().trim().max(500).optional() }),
  fulfilment: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["PAY_ON_PICKUP", "CASH", "MPESA"]),
});

export async function createOnlineOrder(input: z.infer<typeof checkoutSchema>, customerUserId?: string) {
  const db = adminDb();
  return db.runTransaction(async (transaction) => {
    const productRefs = input.lines.map((line) => db.collection("products").doc(line.productId));
    const productDocs = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const rows = input.lines.map((line, index) => {
      const data = productDocs[index].data();
      if (!productDocs[index].exists || !data || !data.active) throw new Error("One of the requested products is no longer available.");
      if ((data.quantityInStock ?? 0) < line.quantity) throw new Error(`${data.name} does not have enough stock.`);
      const actualSellingPrice = data.onlinePrice ?? data.sellingPrice;
      const unitCostAtSale = data.costPrice;
      return { productId: productDocs[index].id, productName: data.name, sku: data.sku, tyreSize: data.tyreSize ?? null, brand: data.brand, quantity: line.quantity, unitCostAtSale, standardPriceAtSale: data.sellingPrice, actualSellingPrice, discountDifference: data.sellingPrice - actualSellingPrice, lineTotal: actualSellingPrice * line.quantity, profitAtSale: (actualSellingPrice - unitCostAtSale) * line.quantity };
    });
    const total = rows.reduce((sum, row) => sum + row.lineTotal, 0);
    const counterRef = db.collection("settings").doc("counters");
    const counter = await transaction.get(counterRef);
    const number = (counter.data()?.orderSequence ?? 0) + 1;
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const orderNumber = `VX-${date}-${String(number).padStart(4, "0")}`;
    const customerQuery = db.collection("customers").where("phone", "==", input.customer.phone).limit(1);
    const matches = await transaction.get(customerQuery);
    const customerRef = matches.empty ? db.collection("customers").doc() : matches.docs[0].ref;
    const orderRef = db.collection("orders").doc();
    const paymentRef = db.collection("payments").doc();
    transaction.set(counterRef, { orderSequence: number, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(customerRef, { ...input.customer, address: input.address, updatedAt: FieldValue.serverTimestamp(), ...(matches.empty ? { createdAt: FieldValue.serverTimestamp(), outstandingBalance: 0, totalPurchases: 0 } : {}) }, { merge: true });
    transaction.set(orderRef, { orderNumber, customerId: customerRef.id, customerUserId: customerUserId ?? null, customer: input.customer, address: input.address, fulfilment: input.fulfilment, status: "NEW", paymentStatus: input.paymentMethod === "PAY_ON_PICKUP" ? "UNPAID" : "PENDING_CONFIRMATION", paymentMethod: input.paymentMethod, items: rows, subtotal: total, total, cogs: rows.reduce((sum, row) => sum + row.unitCostAtSale * row.quantity, 0), profit: rows.reduce((sum, row) => sum + row.profitAtSale, 0), source: "ONLINE", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(paymentRef, { orderId: orderRef.id, amount: 0, method: input.paymentMethod, status: "PENDING", createdAt: Timestamp.now() });
    rows.forEach((row) => {
      const productRef = db.collection("products").doc(row.productId);
      const movementRef = db.collection("inventoryMovements").doc();
      const product = productDocs[input.lines.findIndex((line) => line.productId === row.productId)].data()!;
      const afterQuantity = product.quantityInStock - row.quantity;
      transaction.update(productRef, { quantityInStock: afterQuantity, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(movementRef, { productId: row.productId, type: "SALE", quantity: -row.quantity, beforeQuantity: product.quantityInStock, afterQuantity, reason: "Online order reserve", reference: orderNumber, employeeId: null, orderId: orderRef.id, timestamp: FieldValue.serverTimestamp() });
    });
    return { id: orderRef.id, orderNumber };
  });
}
