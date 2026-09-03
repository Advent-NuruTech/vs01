import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaff } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase-admin";

const purchaseSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  supplierName: z.string().trim().min(2).max(120),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "INVENTORY");
    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the purchase details and try again.", fields: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const db = adminDb();
    const productRef = db.collection("products").doc(input.productId);
    const counterRef = db.collection("settings").doc("counters");
    const businessSettingsRef = db.collection("settings").doc("business");
    const purchaseRef = db.collection("purchases").doc();

    const result = await db.runTransaction(async (transaction) => {
      const [product, counter, businessSettings] = await Promise.all([
        transaction.get(productRef),
        transaction.get(counterRef),
        transaction.get(businessSettingsRef),
      ]);
      if (!product.exists) throw new Error("The selected product no longer exists.");

      const productData = product.data()!;
      if (productData.active !== true) throw new Error("The selected product is inactive.");

      const beforeQuantity = productData.quantityInStock ?? 0;
      const afterQuantity = beforeQuantity + input.quantity;
      const purchaseSequence = (counter.data()?.purchaseSequence ?? 0) + 1;
      const purchasePrefix = businessSettings.data()?.purchasePrefix ?? "PUR";
      const purchaseNumber = `${purchasePrefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(purchaseSequence).padStart(4, "0")}`;
      const total = input.quantity * input.unitCost;

      transaction.set(counterRef, {
        purchaseSequence,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.update(productRef, {
        quantityInStock: afterQuantity,
        costPrice: input.unitCost,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(purchaseRef, {
        purchaseNumber,
        productId: productRef.id,
        productName: productData.name,
        sku: productData.sku,
        supplierName: input.supplierName,
        supplierReference: input.reference ?? null,
        quantity: input.quantity,
        unitCost: input.unitCost,
        total,
        notes: input.notes ?? null,
        employeeId: employee.uid,
        status: "RECEIVED",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("inventoryMovements").doc(), {
        productId: productRef.id,
        productName: productData.name,
        sku: productData.sku,
        type: "PURCHASE",
        quantity: input.quantity,
        beforeQuantity,
        afterQuantity,
        unitCost: input.unitCost,
        total,
        supplierName: input.supplierName,
        reason: input.notes || `Stock received from ${input.supplierName}`,
        reference: input.reference || purchaseNumber,
        purchaseId: purchaseRef.id,
        purchaseNumber,
        employeeId: employee.uid,
        timestamp: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "PURCHASE_RECEIVED",
        employeeId: employee.uid,
        affectedRecord: purchaseRef.id,
        newValue: { purchaseNumber, productId: productRef.id, quantity: input.quantity, total },
        timestamp: FieldValue.serverTimestamp(),
      });

      return { purchaseId: purchaseRef.id, purchaseNumber, total, afterQuantity };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Purchase could not be received." }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Purchase could not be received." },
      { status: 400 },
    );
  }
}
