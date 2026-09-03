import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { rateLimit, requestIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const limit = rateLimit(`customer-signup:${requestIp(request)}`, 8, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ error: "Too many signup attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });

  try {
    const email = parsed.data.email.toLowerCase();
    const user = await adminAuth().createUser({ email, password: parsed.data.password });
    await adminDb().collection("customerProfiles").doc(user.uid).set({ email, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return Response.json({ email }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/email-already-exists") return Response.json({ error: "An account already exists for that email. Please sign in." }, { status: 409 });
    console.error("Customer signup failed", error);
    return Response.json({ error: "We could not create your account. Please try again." }, { status: 500 });
  }
}
