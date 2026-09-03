import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit, requestIp } from "@/lib/server/rate-limit";

const allowedServices = [
  "Tyre fitting",
  "Puncture repair",
  "Wheel balancing",
  "Wheel alignment",
  "Brake service",
  "Oil change",
  "Diagnostics",
  "Mechanical repairs",
  "Vehicle inspection",
] as const;

const serviceRequestSchema = z.object({
  serviceName: z.enum(allowedServices),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(7).max(30),
  vehicleRegistration: z.string().trim().min(2).max(30),
  vehicleDescription: z.string().trim().max(120).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  const limiter = rateLimit(`service-request:${requestIp(request)}`, 5, 60_000);
  if (!limiter.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  const parsed = serviceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please review your booking details." }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const db = adminDb();
    const counterRef = db.collection("settings").doc("counters");
    const requestRef = db.collection("serviceRequests").doc();

    const requestNumber = await db.runTransaction(async (transaction) => {
      const counter = await transaction.get(counterRef);
      const sequence = (counter.data()?.serviceRequestSequence ?? 0) + 1;
      const reference = `SR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;

      transaction.set(counterRef, {
        serviceRequestSequence: sequence,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(requestRef, {
        requestNumber: reference,
        serviceName: input.serviceName,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        vehicleRegistration: input.vehicleRegistration.toUpperCase(),
        vehicleDescription: input.vehicleDescription || null,
        preferredDate: input.preferredDate || null,
        notes: input.notes || null,
        status: "NEW",
        source: "WEBSITE",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return reference;
    });

    return Response.json({ requestId: requestRef.id, requestNumber }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "We could not save your service request." },
      { status: 500 },
    );
  }
}
