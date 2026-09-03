"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

type Order = { id: string; orderNumber?: string; status?: string; total?: number; createdAt?: { toDate?: () => Date } };
const money = (value?: number) => `KES ${(value ?? 0).toLocaleString("en-KE")}`;

export function CustomerPortal() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "orders"), where("customerUserId", "==", user.uid), orderBy("createdAt", "desc")), (snapshot) => {
      setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, () => setOrders([]));
  }, [user]);

  if (user === undefined) return <main className="customer-portal customer-loading">Loading your portal…</main>;
  if (!user) return <main className="auth-page"><section className="auth-card"><p className="eyebrow">CUSTOMER PORTAL</p><h1>Your tyres, services and orders—together.</h1><p>Sign in to view orders placed while you were logged in.</p><div className="auth-actions"><Link className="button button-blue" href="/customer/login">Sign in</Link><Link className="button button-outline" href="/customer/signup">Create account</Link></div></section></main>;

  return <main className="customer-portal">
    <header><Link href="/">← Vitour Xpress</Link><button onClick={() => signOut(auth)}>Sign out</button></header>
    <section><p className="eyebrow">CUSTOMER PORTAL</p><h1>Welcome back.</h1><p className="lead">Signed in as {user.email}</p>
      <div className="portal-actions"><Link className="button button-blue" href="/shop">Shop tyres</Link><Link className="button button-outline" href="/services">Book a service</Link></div>
      <div className="portal-orders"><div><h2>Your online orders</h2><p>Orders placed while signed in appear here.</p></div>{orders === null ? <p>Loading orders…</p> : orders.length ? <div className="portal-order-list">{orders.map((order) => <article key={order.id}><div><b>{order.orderNumber ?? "Order"}</b><span>{order.createdAt?.toDate?.().toLocaleDateString("en-KE") ?? "Processing"}</span></div><div><span className="status in">{order.status ?? "NEW"}</span><b>{money(order.total)}</b></div></article>)}</div> : <p className="portal-empty">No signed-in online orders yet. Your previous guest orders are still being handled by our team.</p>}</div>
    </section>
  </main>;
}
