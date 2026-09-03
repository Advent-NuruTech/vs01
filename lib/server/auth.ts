import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/lib/domain";

const permissions: Record<string, UserRole[]> = {
  SALES: ["OWNER", "ADMIN", "CASHIER"], INVENTORY: ["OWNER", "ADMIN", "STOCK_MANAGER"], ORDERS: ["OWNER", "ADMIN", "CASHIER"], GARAGE: ["OWNER", "ADMIN", "MECHANIC"], FINANCE: ["OWNER", "ADMIN"], SETTINGS: ["OWNER", "ADMIN"],
};

export async function requireStaff(request: Request, permission: keyof typeof permissions) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("Authentication required.", { status: 401 });
  const decoded = await adminAuth().verifyIdToken(token);
  const profile = await adminDb().collection("users").doc(decoded.uid).get();
  const role = profile.data()?.role as UserRole | undefined;
  if (!role || !profile.data()?.active || !permissions[permission].includes(role)) throw new Response("You do not have permission for this operation.", { status: 403 });
  return { uid: decoded.uid, role };
}
