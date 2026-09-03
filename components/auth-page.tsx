"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AccountKind = "customer" | "admin";
type Mode = "login" | "signup";

const copy = {
  customer: { label: "CUSTOMER PORTAL", name: "Customer", destination: "/customer" },
  admin: { label: "VITOUR XPRESS OPERATIONS", name: "Administrator", destination: "/manage" },
};

export function AuthPage({ kind, mode }: { kind: AccountKind; mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const account = copy[kind];
  const isSignup = mode === "signup";
  const otherPath = `/${kind}/${isSignup ? "login" : "signup"}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (isSignup) {
        const response = await fetch(`/api/auth/${kind}-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, ...(kind === "admin" ? { secret: String(form.get("secret") ?? "") } : {}) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "We could not create your account.");
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.replace(account.destination);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Sign-in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-page">
    <Link className="auth-back" href="/">← Vitour Xpress</Link>
    <section className="auth-card">
      <p className="eyebrow">{account.label}</p>
      <h1>{isSignup ? `Create ${account.name.toLowerCase()} account` : `${account.name} sign in`}</h1>
      <p>{isSignup ? "Use your email and password to set up secure access." : "Sign in with your email and password."}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required /></label>
        {kind === "admin" && isSignup && <label>Administrator signup code<input type="password" name="secret" autoComplete="off" required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-red" disabled={submitting}>{submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
      </form>
      <p className="auth-switch">{isSignup ? "Already have an account?" : "Need an account?"} <Link href={otherPath}>{isSignup ? "Sign in" : "Sign up"}</Link></p>
      {kind === "customer" && <p className="auth-admin-link">Staff member? <Link href="/admin/login">Use the administrator login</Link>.</p>}
    </section>
  </main>;
}
