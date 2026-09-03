import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { requireStaff } from "@/lib/server/auth";

const jobSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30),
  }),
  vehicleRegistration: z.string().trim().min(2).max(30),
  vehicleDescription: z.string().trim().max(120).optional(),
  serviceDescription: z.string().trim().min(3).max(500),
  labourCharge: z.number().nonnegative(),
  partsCharge: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "MPESA", "CARD", "BANK"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
}).refine((input) => input.labourCharge + input.partsCharge > 0, {
  message: "The job total must be greater than zero.",
}).refine((input) => input.amountPaid <= input.labourCharge + input.partsCharge, {
  message: "Payment cannot be greater than the job total.",
});

const moneyValue = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "GARAGE");
    const parsed = jobSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the service job details." },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const db = adminDb();
    const counterRef = db.collection("settings").doc("counters");
    const businessSettingsRef = db.collection("settings").doc("business");
    const customerQuery = db.collection("customers").where("phone", "==", input.customer.phone).limit(1);
    const jobRef = db.collection("serviceJobs").doc();

    const result = await db.runTransaction(async (transaction) => {
      const [counter, matchingCustomer, businessSettings] = await Promise.all([
        transaction.get(counterRef),
        transaction.get(customerQuery),
        transaction.get(businessSettingsRef),
      ]);

      const jobSequence = (counter.data()?.serviceJobSequence ?? 0) + 1;
      const serviceJobPrefix = businessSettings.data()?.serviceJobPrefix ?? "JOB";
      const jobNumber = `${serviceJobPrefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(jobSequence).padStart(4, "0")}`;
      const total = moneyValue(input.labourCharge + input.partsCharge);
      const paidAmount = moneyValue(input.amountPaid);
      const outstandingBalance = moneyValue(total - paidAmount);
      const paymentStatus = outstandingBalance === 0 ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";
      const customerRef = matchingCustomer.empty
        ? db.collection("customers").doc()
        : matchingCustomer.docs[0].ref;

      transaction.set(counterRef, {
        serviceJobSequence: jobSequence,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(customerRef, {
        ...input.customer,
        updatedAt: FieldValue.serverTimestamp(),
        ...(matchingCustomer.empty ? {
          createdAt: FieldValue.serverTimestamp(),
          totalPurchases: 0,
          outstandingBalance,
        } : outstandingBalance > 0 ? {
          outstandingBalance: FieldValue.increment(outstandingBalance),
        } : {}),
      }, { merge: true });
      transaction.set(jobRef, {
        jobNumber,
        customerId: customerRef.id,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        vehicleRegistration: input.vehicleRegistration.toUpperCase(),
        vehicleDescription: input.vehicleDescription ?? null,
        serviceDescription: input.serviceDescription,
        labourCharge: moneyValue(input.labourCharge),
        partsCharge: moneyValue(input.partsCharge),
        total,
        paidAmount,
        outstandingBalance,
        paymentStatus,
        status: input.status,
        assignedEmployeeId: employee.uid,
        createdBy: employee.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (paidAmount > 0) {
        transaction.set(db.collection("payments").doc(), {
          serviceJobId: jobRef.id,
          amount: paidAmount,
          method: input.paymentMethod,
          type: "SERVICE",
          status: "COMPLETED",
          employeeId: employee.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.set(db.collection("auditLogs").doc(), {
        action: "SERVICE_JOB_CREATED",
        employeeId: employee.uid,
        affectedRecord: jobRef.id,
        newValue: { jobNumber, total, paidAmount, status: input.status },
        timestamp: FieldValue.serverTimestamp(),
      });

      return { jobId: jobRef.id, jobNumber, total, outstandingBalance };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return Response.json({ error: message || "Service job could not be created." }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Service job could not be created." },
      { status: 400 },
    );
  }
}
