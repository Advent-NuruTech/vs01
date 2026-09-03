import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { rateLimit, requestIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  secret: z.string().min(1).max(512),
});

function validSecret(value: string, expected: string) {
  const received = Buffer.from(value);
  const configured = Buffer.from(expected);
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export async function POST(request: Request) {
  const limit = rateLimit(`admin-signup:${requestIp(request)}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) return Response.json({ error: "Too many signup attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email, password, and administrator signup code." }, { status: 400 });

  const configuredSecret = process.env.SIGNUP_ADMIN_SECRET;
  if (!configuredSecret || !validSecret(parsed.data.secret, configuredSecret)) return Response.json({ error: "We could not create that administrator account." }, { status: 403 });

  let createdUserId: string | undefined;

  try {
    const email = parsed.data.email.toLowerCase();
    const user = await adminAuth().createUser({ email, password: parsed.data.password });
    createdUserId = user.uid;
    await adminDb().collection("users").doc(user.uid).set({ email, role: "ADMIN", active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return Response.json({ email }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      try {
        await adminAuth().deleteUser(createdUserId);
      } catch (cleanupError) {
        console.error("Administrator signup rollback failed", cleanupError);
      }
    }
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/email-already-exists") return Response.json({ error: "An account already exists for that email. Please sign in." }, { status: 409 });
    console.error("Administrator signup failed", error);
    return Response.json({ error: "We could not create that administrator account. Please try again." }, { status: 500 });
  }
}
