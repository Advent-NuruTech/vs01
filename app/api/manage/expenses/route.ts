import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireStaff } from "@/lib/server/auth";

const expenseSchema = z.object({
  category: z.enum(["RENT", "UTILITIES", "SALARIES", "TRANSPORT", "MARKETING", "MAINTENANCE", "TAX", "SUPPLIES", "OTHER"]),
  description: z.string().trim().min(3).max(300),
  amount: z.number().positive(),
  vendor: z.string().trim().min(2).max(120),
  paymentMethod: z.enum(["CASH", "MPESA", "CARD", "BANK"]),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "FINANCE");
    const parsed = expenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Check the expense details and try again." }, { status: 400 });
    }

    const input = parsed.data;
    const db = adminDb();
    const expenseRef = db.collection("expenses").doc();
    const amount = Math.round(input.amount * 100) / 100;
    const batch = db.batch();
    batch.set(expenseRef, {
      ...input,
      amount,
      status: "PAID",
      employeeId: employee.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("auditLogs").doc(), {
      action: "EXPENSE_RECORDED",
      employeeId: employee.uid,
      affectedRecord: expenseRef.id,
      newValue: { category: input.category, vendor: input.vendor, amount },
      timestamp: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return Response.json({ expenseId: expenseRef.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Expense could not be recorded." }, { status: error.status });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Expense could not be recorded." }, { status: 400 });
  }
}
