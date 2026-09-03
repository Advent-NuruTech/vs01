import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireStaff } from "@/lib/server/auth";

const prefix = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,10}$/);
const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().or(z.literal("")),
  address: z.string().trim().min(2).max(300),
  taxPin: z.string().trim().max(30).optional(),
  mpesaTill: z.string().trim().max(30).optional(),
  currency: z.literal("KES"),
  receiptFooter: z.string().trim().max(250),
  receiptPrefix: prefix,
  orderPrefix: prefix,
  purchasePrefix: prefix,
  serviceJobPrefix: prefix,
  maxDiscountPercent: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "SETTINGS");
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the settings fields and try again." }, { status: 400 });
    const db = adminDb();
    const settingsRef = db.collection("settings").doc("business");
    const batch = db.batch();
    batch.set(settingsRef, { ...parsed.data, updatedAt: FieldValue.serverTimestamp(), updatedBy: employee.uid }, { merge: true });
    batch.set(db.collection("auditLogs").doc(), { action: "SETTINGS_UPDATED", employeeId: employee.uid, affectedRecord: settingsRef.id, newValue: parsed.data, timestamp: FieldValue.serverTimestamp() });
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Settings could not be saved." }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Settings could not be saved." }, { status: 400 });
  }
}
