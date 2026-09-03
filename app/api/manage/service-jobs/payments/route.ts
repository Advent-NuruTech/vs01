import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireStaff } from "@/lib/server/auth";

const paymentSchema = z.object({
  jobId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "MPESA", "CARD", "BANK"]),
});

const moneyValue = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "GARAGE");
    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid payment amount and method." }, { status: 400 });
    }

    const input = parsed.data;
    const db = adminDb();
    const jobRef = db.collection("serviceJobs").doc(input.jobId);

    const result = await db.runTransaction(async (transaction) => {
      const job = await transaction.get(jobRef);
      if (!job.exists) throw new Error("This service job no longer exists.");

      const jobData = job.data()!;
      const previousBalance = moneyValue(jobData.outstandingBalance ?? 0);
      const amount = moneyValue(input.amount);
      if (previousBalance <= 0) throw new Error("This service job is already fully paid.");
      if (amount > previousBalance) throw new Error("Payment cannot be greater than the outstanding balance.");

      const outstandingBalance = moneyValue(previousBalance - amount);
      const paidAmount = moneyValue((jobData.paidAmount ?? 0) + amount);
      const paymentStatus = outstandingBalance === 0 ? "PAID" : "PARTIALLY_PAID";

      transaction.update(jobRef, {
        paidAmount,
        outstandingBalance,
        paymentStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (jobData.customerId) {
        transaction.set(db.collection("customers").doc(jobData.customerId), {
          outstandingBalance: FieldValue.increment(-amount),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      const paymentRef = db.collection("payments").doc();
      transaction.set(paymentRef, {
        serviceJobId: jobRef.id,
        amount,
        method: input.method,
        type: "SERVICE",
        status: "COMPLETED",
        employeeId: employee.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "SERVICE_PAYMENT_RECORDED",
        employeeId: employee.uid,
        affectedRecord: jobRef.id,
        newValue: { paymentId: paymentRef.id, amount, method: input.method, outstandingBalance },
        timestamp: FieldValue.serverTimestamp(),
      });

      return { paymentId: paymentRef.id, paidAmount, outstandingBalance };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Payment could not be recorded." }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Payment could not be recorded." },
      { status: 400 },
    );
  }
}
