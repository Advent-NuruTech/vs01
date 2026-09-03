import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";

export const saleSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2), phone: z.string().trim().min(7) }).optional(),
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), actualSellingPrice: z.number().nonnegative() })).min(1).refine((lines) => new Set(lines.map((line) => line.productId)).size === lines.length, "Duplicate product lines are not allowed."),
  payments: z.array(z.object({ method: z.enum(["CASH", "MPESA", "CARD", "BANK", "CREDIT"]), amount: z.number().nonnegative() })).min(1),
  notes: z.string().max(500).optional(),
});

export async function finalizeSale(input: z.infer<typeof saleSchema>, employeeId: string) {
  const db = adminDb();
  return db.runTransaction(async (transaction) => {
    const refs = input.lines.map((line) => db.collection("products").doc(line.productId));
    const docs = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const lines = input.lines.map((line, index) => {
      const product = docs[index].data();
      if (!docs[index].exists || !product?.active) throw new Error("A selected product is unavailable.");
      if ((product.quantityInStock ?? 0) < line.quantity) throw new Error(`${product.name} has insufficient stock.`);
      const standardPriceAtSale = product.sellingPrice;
      const unitCostAtSale = product.costPrice;
      return { productId: docs[index].id, productName: product.name, sku: product.sku, tyreSize: product.tyreSize ?? null, brand: product.brand, unitCostAtSale, standardPriceAtSale, actualSellingPrice: line.actualSellingPrice, discountDifference: standardPriceAtSale - line.actualSellingPrice, quantity: line.quantity, lineTotal: line.actualSellingPrice * line.quantity, profitAtSale: (line.actualSellingPrice - unitCostAtSale) * line.quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const paid = input.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paid > total) throw new Error("Payment cannot be greater than sale total.");
    const balance = total - paid;
    const counterRef = db.collection("settings").doc("counters"); const counter = await transaction.get(counterRef); const receiptSequence = (counter.data()?.receiptSequence ?? 0) + 1;
    const receiptNumber = `VX-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(receiptSequence).padStart(4, "0")}`;
    let customerRef: FirebaseFirestore.DocumentReference | null = null;
    if (input.customer) { const matchingCustomer = await transaction.get(db.collection("customers").where("phone", "==", input.customer.phone).limit(1)); customerRef = matchingCustomer.empty ? db.collection("customers").doc() : matchingCustomer.docs[0].ref; transaction.set(customerRef, { ...input.customer, updatedAt: FieldValue.serverTimestamp(), ...(matchingCustomer.empty ? { createdAt: FieldValue.serverTimestamp(), totalPurchases: 0, outstandingBalance: 0 } : {}) }, { merge: true }); }
    const saleRef = db.collection("sales").doc();
    transaction.set(counterRef, { receiptSequence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(saleRef, { receiptNumber, employeeId, customerId: customerRef?.id ?? null, source: "POS", status: "COMPLETED", paymentStatus: balance === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID", lines, total, cogs: lines.reduce((sum, line) => sum + line.unitCostAtSale * line.quantity, 0), grossProfit: lines.reduce((sum, line) => sum + line.profitAtSale, 0), paidAmount: paid, outstandingBalance: balance, notes: input.notes ?? null, createdAt: FieldValue.serverTimestamp() });
    input.payments.filter((payment) => payment.amount > 0).forEach((payment) => transaction.set(db.collection("payments").doc(), { saleId: saleRef.id, amount: payment.amount, method: payment.method, status: "COMPLETED", employeeId, createdAt: FieldValue.serverTimestamp() }));
    lines.forEach((line, index) => { const product = docs[index].data()!; const afterQuantity = product.quantityInStock - line.quantity; transaction.update(refs[index], { quantityInStock: afterQuantity, updatedAt: FieldValue.serverTimestamp() }); transaction.set(db.collection("inventoryMovements").doc(), { productId: line.productId, type: "SALE", quantity: -line.quantity, beforeQuantity: product.quantityInStock, afterQuantity, reason: "Completed POS sale", reference: receiptNumber, employeeId, saleId: saleRef.id, timestamp: FieldValue.serverTimestamp() }); });
    if (customerRef) transaction.set(customerRef, { totalPurchases: FieldValue.increment(total), outstandingBalance: FieldValue.increment(balance) }, { merge: true });
    transaction.set(db.collection("auditLogs").doc(), { action: "SALE_COMPLETED", employeeId, affectedRecord: saleRef.id, newValue: { receiptNumber, total, grossProfit: lines.reduce((sum, line) => sum + line.profitAtSale, 0) }, timestamp: FieldValue.serverTimestamp() });
    return { saleId: saleRef.id, receiptNumber, total, balance };
  });
}
