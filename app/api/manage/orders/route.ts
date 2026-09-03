import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireStaff } from "@/lib/server/auth";

const updateSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["NEW", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]),
  paymentStatus: z.enum(["UNPAID", "PENDING_CONFIRMATION", "PAID"]),
  paymentMethod: z.enum(["CASH", "MPESA", "CARD", "BANK"]),
});

export async function PATCH(request: Request) {
  try {
    const employee = await requireStaff(request, "ORDERS");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the order update." }, { status: 400 });

    const input = parsed.data;
    const db = adminDb();
    const orderRef = db.collection("orders").doc(input.orderId);

    const result = await db.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) throw new Error("This order no longer exists.");
      const data = order.data()!;
      if (data.status === "CANCELLED" && input.status !== "CANCELLED") throw new Error("A cancelled order cannot be reopened.");
      if (input.status === "CANCELLED" && data.paymentStatus === "PAID") throw new Error("A paid order must be refunded before it can be cancelled.");
      if (input.status === "CANCELLED" && input.paymentStatus === "PAID") throw new Error("A cancelled order cannot be marked as paid.");
      if (data.paymentStatus === "PAID" && input.paymentStatus !== "PAID") throw new Error("A recorded payment cannot be removed from the order.");

      const cancelling = input.status === "CANCELLED" && data.status !== "CANCELLED";
      const items = Array.isArray(data.items) ? data.items as Array<{ productId: string; quantity: number; productName?: string }> : [];
      const productRefs = cancelling ? items.map((item) => db.collection("products").doc(item.productId)) : [];
      const products = cancelling ? await Promise.all(productRefs.map((ref) => transaction.get(ref))) : [];

      const markingPaid = input.paymentStatus === "PAID" && data.paymentStatus !== "PAID";
      const update: Record<string, unknown> = {
        status: input.status,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: employee.uid,
      };
      if (input.status === "COMPLETED" && data.status !== "COMPLETED") update.completedAt = FieldValue.serverTimestamp();
      if (markingPaid) {
        update.paidAmount = data.total ?? 0;
        update.paidRecordedAt = FieldValue.serverTimestamp();
        transaction.set(db.collection("payments").doc(), {
          orderId: orderRef.id,
          amount: data.total ?? 0,
          method: input.paymentMethod,
          type: "ORDER",
          status: "COMPLETED",
          employeeId: employee.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(orderRef, update);

      if (cancelling) {
        items.forEach((item, index) => {
          const product = products[index];
          if (!product.exists) return;
          const beforeQuantity = product.data()?.quantityInStock ?? 0;
          const afterQuantity = beforeQuantity + item.quantity;
          transaction.update(productRefs[index], { quantityInStock: afterQuantity, updatedAt: FieldValue.serverTimestamp() });
          transaction.set(db.collection("inventoryMovements").doc(), {
            productId: item.productId,
            type: "SALE_RETURN",
            quantity: item.quantity,
            beforeQuantity,
            afterQuantity,
            reason: "Online order cancelled",
            reference: data.orderNumber,
            orderId: orderRef.id,
            employeeId: employee.uid,
            timestamp: FieldValue.serverTimestamp(),
          });
        });
      }

      transaction.set(db.collection("auditLogs").doc(), {
        action: "ORDER_UPDATED",
        employeeId: employee.uid,
        affectedRecord: orderRef.id,
        oldValue: { status: data.status, paymentStatus: data.paymentStatus },
        newValue: { status: input.status, paymentStatus: input.paymentStatus, paymentMethod: input.paymentMethod },
        timestamp: FieldValue.serverTimestamp(),
      });
      return { orderId: orderRef.id, status: input.status, paymentStatus: input.paymentStatus };
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Order could not be updated." }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Order could not be updated." }, { status: 400 });
  }
}
