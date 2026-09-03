"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useStaffToken } from "./staff-gate";

type OrderStatus = "NEW" | "CONFIRMED" | "PREPARING" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PENDING_CONFIRMATION" | "PAID";
type PaymentMethod = "CASH" | "MPESA" | "CARD" | "BANK";
type Order = {
  id: string; orderNumber: string; customer?: { fullName?: string; phone?: string; email?: string };
  address?: { county?: string; town?: string; area?: string; street?: string }; fulfilment: string;
  status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod?: string; total: number;
  items?: Array<{ productName: string; quantity: number }>; createdAt?: { toDate: () => Date };
};
type Draft = { status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod };

const statuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];
const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function OrdersClient() {
  const token = useStaffToken();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");

  useEffect(() => onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500)),
    (snapshot) => { setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order)); setLoadError(""); },
    () => setLoadError("Unable to load orders. Check your connection and refresh the page."),
  ), []);

  const visible = useMemo(() => (orders ?? []).filter((order) => filter === "ALL" || order.status === filter), [filter, orders]);
  const counts = useMemo(() => (orders ?? []).reduce((result, order) => ({
    newOrders: result.newOrders + (order.status === "NEW" ? 1 : 0),
    active: result.active + (["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(order.status) ? 1 : 0),
    completed: result.completed + (order.status === "COMPLETED" ? 1 : 0),
    unpaid: result.unpaid + (order.paymentStatus === "PAID" ? 0 : order.total ?? 0),
  }), { newOrders: 0, active: 0, completed: 0, unpaid: 0 }), [orders]);

  const draftFor = (order: Order): Draft => drafts[order.id] ?? {
    status: order.status, paymentStatus: order.paymentStatus,
    paymentMethod: (["CASH", "MPESA", "CARD", "BANK"].includes(order.paymentMethod ?? "") ? order.paymentMethod : "CASH") as PaymentMethod,
  };
  const updateDraft = (order: Order, update: Partial<Draft>) => setDrafts((current) => ({ ...current, [order.id]: { ...draftFor(order), ...update } }));

  const save = async (order: Order) => {
    if (!token) return setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
    const draft = draftFor(order);
    setSaving(order.id); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/manage/orders", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, ...draft }) });
      const body = await response.text();
      const result = body ? JSON.parse(body) as { error?: string } : {};
      if (!response.ok) return setError(result.error ?? `Order update failed (${response.status}).`);
      setSuccess(`${order.orderNumber} updated successfully.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Order could not be updated."); }
    finally { setSaving(null); }
  };

  return <div className="or-view">
    <div className="or-heading"><div><p className="eyebrow">ONLINE ORDERS</p><h2>Order fulfilment</h2><p>Manage fulfilment and confirm customer payments. Cancelling an unpaid order returns its reserved stock.</p></div><span className="live-badge">● LIVE</span></div>
    <section className="or-summary"><article><span>New</span><b>{counts.newOrders}</b></article><article><span>In progress</span><b>{counts.active}</b></article><article><span>Completed</span><b>{counts.completed}</b></article><article><span>Unconfirmed value</span><b>{money(counts.unpaid)}</b></article></section>
    <section className="inventory-table or-table">
      <div className="or-toolbar"><div><h2>Order queue</h2><span>{visible.length} order(s)</span></div><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></div>
      <div className="form-feedback" aria-live="polite">{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</div>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loadError && orders === null && <p className="table-empty">Loading orders...</p>}
      {!loadError && orders?.length === 0 && <p className="table-empty">No online orders have been placed yet.</p>}
      {orders && orders.length > 0 && visible.length === 0 && <p className="table-empty">No orders have this status.</p>}
      {visible.length > 0 && <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Fulfilment</th><th>Total</th><th>Status</th><th>Payment</th><th>Action</th></tr></thead><tbody>{visible.map((order) => {
        const draft = draftFor(order); return <tr key={order.id}><td><b>{order.orderNumber}</b><small>{order.createdAt?.toDate?.().toLocaleString("en-KE") ?? "New"}</small></td><td><b>{order.customer?.fullName ?? "Customer"}</b><small>{order.customer?.phone}</small><small>{order.customer?.email}</small></td><td className="or-items">{order.items?.map((item, index) => <span key={`${order.id}-${index}`}>{item.productName} × {item.quantity}</span>)}</td><td><b>{pretty(order.fulfilment)}</b><small>{[order.address?.area, order.address?.town].filter(Boolean).join(", ")}</small></td><td><b>{money(order.total)}</b></td><td><select value={draft.status} disabled={order.status === "CANCELLED"} onChange={(event) => updateDraft(order, { status: event.target.value as OrderStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td><select value={draft.paymentStatus} onChange={(event) => updateDraft(order, { paymentStatus: event.target.value as PaymentStatus })}><option>UNPAID</option><option>PENDING_CONFIRMATION</option><option>PAID</option></select><select value={draft.paymentMethod} onChange={(event) => updateDraft(order, { paymentMethod: event.target.value as PaymentMethod })}><option>CASH</option><option>MPESA</option><option>CARD</option><option>BANK</option></select></td><td><button className="button button-red" disabled={saving === order.id} onClick={() => save(order)}>{saving === order.id ? "Saving..." : "Save"}</button></td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
