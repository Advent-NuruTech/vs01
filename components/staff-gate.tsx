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
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setAuthResolved(true);
    setProfileResolved(!nextUser);
    setRole(null);
    setActive(false);
    setError("");
  }, () => {
    setAuthResolved(true);
    setError("We could not verify your sign-in. Check your connection and refresh the page.");
  }), []);
  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => {
      setError("Staff verification is taking too long. Check your connection and refresh the page.");
    }, 12_000);
    const stop = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      window.clearTimeout(timeout);
      setRole(snapshot.data()?.role ?? null);
      setActive(snapshot.data()?.active === true);
      setProfileResolved(true);
      setError("");
    }, () => {
      window.clearTimeout(timeout);
      setProfileResolved(true);
      setError("We could not verify your staff access. Please refresh the page or sign in again.");
    });
    return () => {
      window.clearTimeout(timeout);
      stop();
    };
  }, [user]);

  if (!authResolved || (user && !profileResolved && !error)) return <div className="staff-loading">Verifying secure staff access…</div>;
  if (error) return <div className="staff-denied"><h1>Staff verification failed</h1><p>{error}</p><button onClick={() => signOut(auth)}>Sign out</button></div>;
  if (!user) return <div className="staff-login"><p className="eyebrow">VITOUR XPRESS OPERATIONS</p><h1>Staff sign in</h1><p>Use the separate administrator login to access operations.</p><Link className="button button-red" href="/admin/login">Administrator login</Link></div>;
  if (!active || !role || !allowed[permission].includes(role)) return <div className="staff-denied"><h1>Access restricted</h1><p>This account does not have permission to use this module.</p><button onClick={() => signOut(auth)}>Sign out</button></div>;
  return <>{children}</>;
}
