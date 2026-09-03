import { checkoutSchema, createOnlineOrder } from "@/lib/server/orders";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please review the checkout details.", fields: parsed.error.flatten() }, { status: 400 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const customerUserId = token ? await adminAuth().verifyIdToken(token).then((decoded) => decoded.uid).catch(() => null) : null;
  try { return Response.json(await createOnlineOrder(parsed.data, customerUserId ?? undefined), { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "We could not place your order." }, { status: 409 }); }
}
