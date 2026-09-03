"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ReactNode, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { UserRole } from "@/lib/domain";

const allowed: Record<string, UserRole[]> = { SALES: ["OWNER", "ADMIN", "CASHIER"], INVENTORY: ["OWNER", "ADMIN", "STOCK_MANAGER"], ORDERS: ["OWNER", "ADMIN", "CASHIER"], GARAGE: ["OWNER", "ADMIN", "MECHANIC"], FINANCE: ["OWNER", "ADMIN"], SETTINGS: ["OWNER", "ADMIN"] };

export function useStaffToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { const stop = onAuthStateChanged(auth, async (user) => setToken(user ? await user.getIdToken() : null)); return stop; }, []);
  return token;
}

export function StaffGate({ permission, children }: { permission: keyof typeof allowed; children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [role, setRole] = useState<UserRole | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      setRole(snapshot.data()?.role ?? null);
      setActive(snapshot.data()?.active === true);
    }, () => setError("We could not verify your staff access."));
  }, [user]);

  if (user === undefined || (user && !role && !error)) return <div className="staff-loading">Verifying secure staff access…</div>;
  if (!user) return <div className="staff-login"><p className="eyebrow">VITOUR XPRESS OPERATIONS</p><h1>Staff sign in</h1><p>Use the separate administrator login to access operations.</p><Link className="button button-red" href="/admin/login">Administrator login</Link></div>;
  if (error || !active || !role || !allowed[permission].includes(role)) return <div className="staff-denied"><h1>Access restricted</h1><p>This account does not have permission to use this module.</p><button onClick={() => signOut(auth)}>Sign out</button></div>;
  return <>{children}</>;
}
