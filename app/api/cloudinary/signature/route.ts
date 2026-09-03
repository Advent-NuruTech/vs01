import { createHash } from "crypto";
import { requireStaff } from "@/lib/server/auth";

export async function POST(request: Request) {
  try { await requireStaff(request, "INVENTORY"); }
  catch (error) { return error instanceof Response ? error : Response.json({ error: "Unable to verify staff access." }, { status: 500 }); }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ error: "Cloudinary is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = body.kind === "expense" ? "vitour-xpress/expenses" : "vitour-xpress/products";
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");

  return Response.json({ cloudName, apiKey, timestamp, folder, signature });
}
