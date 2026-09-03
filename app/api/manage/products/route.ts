import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaff } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase-admin";

const schema = z.object({ name: z.string().trim().min(2), sku: z.string().trim().min(2), barcode: z.string().trim().optional(), brand: z.string().trim().min(2), category: z.enum(["TYRE", "RIM", "TUBE", "VALVE", "ACCESSORY", "LUBRICANT", "PART"]), description: z.string().trim().optional(), tyreSize: z.string().trim().optional(), width: z.number().int().positive().optional(), profile: z.number().int().positive().optional(), rimDiameter: z.number().int().positive().optional(), tyreType: z.string().trim().optional(), vehicleType: z.string().trim().optional(), loadIndex: z.string().trim().optional(), speedRating: z.string().trim().optional(), costPrice: z.number().nonnegative(), sellingPrice: z.number().positive(), onlinePrice: z.number().positive().optional(), reorderLevel: z.number().int().nonnegative(), initialStock: z.number().int().nonnegative(), imageUrls: z.array(z.string().url()).max(8).default([]), featured: z.boolean().default(false) });
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "INVENTORY"); const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid product data.", fields: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data; const db = adminDb(); const slug = slugify(`${input.brand}-${input.name}-${input.tyreSize ?? input.sku}`); const productRef = db.collection("products").doc();
    await db.runTransaction(async (transaction) => { const existing = await transaction.get(db.collection("products").where("slug", "==", slug).limit(1)); if (!existing.empty) throw new Error("A product with this name already exists."); transaction.set(productRef, { ...input, slug, quantityInStock: input.initialStock, featuredImageUrl: input.imageUrls[0] ?? null, active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); if (input.initialStock) transaction.set(db.collection("inventoryMovements").doc(), { productId: productRef.id, type: "OPENING_STOCK", quantity: input.initialStock, beforeQuantity: 0, afterQuantity: input.initialStock, reason: "Initial product stock", reference: productRef.id, employeeId: employee.uid, timestamp: FieldValue.serverTimestamp() }); transaction.set(db.collection("auditLogs").doc(), { action: "PRODUCT_CREATED", employeeId: employee.uid, affectedRecord: productRef.id, newValue: { name: input.name, sku: input.sku }, timestamp: FieldValue.serverTimestamp() }); });
    return Response.json({ id: productRef.id, slug }, { status: 201 });
  } catch (error) { return error instanceof Response ? error : Response.json({ error: error instanceof Error ? error.message : "Product could not be created." }, { status: 400 }); }
}
