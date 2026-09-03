"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { UserRole } from "@/lib/domain";

const allowed: Record<string, UserRole[]> = { SALES: ["OWNER", "ADMIN", "CASHIER"], INVENTORY: ["OWNER", "ADMIN", "STOCK_MANAGER"], ORDERS: ["OWNER", "ADMIN", "CASHIER"], GARAGE: ["OWNER", "ADMIN", "MECHANIC"], FINANCE: ["OWNER", "ADMIN"], SETTINGS: ["OWNER", "ADMIN"] };

export function useStaffToken() { const [token, setToken] = useState<string | null>(null); useEffect(() => { const stop = onAuthStateChanged(auth, async (user) => setToken(user ? await user.getIdToken() : null)); return stop; }, []); return token; }

export function StaffGate({ permission, children }: { permission: keyof typeof allowed; children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined); const [role, setRole] = useState<UserRole | null>(null); const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (!user) return; return onSnapshot(doc(db, "users", user.uid), (snapshot) => setRole(snapshot.data()?.role ?? null), () => setError("We could not verify your staff access.")); }, [user]);
  if (user === undefined || (user && !role && !error)) return <div className="staff-loading">Verifying secure staff access…</div>;
  if (!user) return <StaffLogin />;
  if (error || !role || !allowed[permission].includes(role)) return <div className="staff-denied"><h1>Access restricted</h1><p>This account does not have permission to use this module.</p><button onClick={() => signOut(auth)}>Sign out</button></div>;
  return <>{children}</>;
}

function StaffLogin() {
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await signInWithEmailAndPassword(auth, String(form.get("email")), String(form.get("password"))); } catch { setError("Sign-in failed. Check your email and password."); } };
  return <main className="staff-login"><p className="eyebrow">VITOUR XPRESS OPERATIONS</p><h1>Staff sign in</h1><form onSubmit={submit}><label>Email<input type="email" name="email" required /></label><label>Password<input type="password" name="password" required /></label>{error && <p>{error}</p>}<button className="button button-red">Sign in</button></form></main>;
}
