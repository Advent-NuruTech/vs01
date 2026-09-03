"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

type FirestoreDate = { toDate: () => Date };
type FinanceRecord = { id: string; total?: number; amount?: number; cogs?: number; paidAmount?: number; outstandingBalance?: number; partsCharge?: number; status?: string; type?: string; category?: string; expenseDate?: string; createdAt?: FirestoreDate };
type Period = "TODAY" | "MONTH" | "ALL";

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

function included(record: FinanceRecord, period: Period) {
  if (period === "ALL") return true;
  const date = record.createdAt?.toDate?.() ?? (record.expenseDate ? new Date(`${record.expenseDate}T00:00:00`) : null);
  if (!date) return false;
  const now = new Date();
  if (period === "TODAY") return date.toDateString() === now.toDateString();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function FinanceClient() {
  const [sales, setSales] = useState<FinanceRecord[]>([]);
  const [orders, setOrders] = useState<FinanceRecord[]>([]);
  const [jobs, setJobs] = useState<FinanceRecord[]>([]);
  const [expenses, setExpenses] = useState<FinanceRecord[]>([]);
  const [purchases, setPurchases] = useState<FinanceRecord[]>([]);
  const [payments, setPayments] = useState<FinanceRecord[]>([]);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("MONTH");

  useEffect(() => {
    const listen = (name: string, setter: (records: FinanceRecord[]) => void) => onSnapshot(
      query(collection(db, name), orderBy("createdAt", "desc"), limit(1000)),
      (snapshot) => { setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FinanceRecord)); setLoaded((current) => new Set(current).add(name)); },
      () => setError(`Unable to load ${name}. Check your connection and refresh the page.`),
    );
    const stops = [listen("sales", setSales), listen("orders", setOrders), listen("serviceJobs", setJobs), listen("expenses", setExpenses), listen("purchases", setPurchases), listen("payments", setPayments)];
    return () => stops.forEach((stop) => stop());
  }, []);

  const report = useMemo(() => {
    const periodSales = sales.filter((record) => included(record, period) && record.status !== "CANCELLED");
    const periodOrders = orders.filter((record) => included(record, period) && record.status === "COMPLETED");
    const periodJobs = jobs.filter((record) => included(record, period) && record.status === "COMPLETED");
    const periodExpenses = expenses.filter((record) => included(record, period));
    const periodPurchases = purchases.filter((record) => included(record, period));
    const periodPayments = payments.filter((record) => included(record, period) && record.status === "COMPLETED");
    const productRevenue = [...periodSales, ...periodOrders].reduce((sum, record) => sum + (record.total ?? 0), 0);
    const serviceRevenue = periodJobs.reduce((sum, record) => sum + (record.total ?? 0), 0);
    const cogs = [...periodSales, ...periodOrders].reduce((sum, record) => sum + (record.cogs ?? 0), 0);
    const expenseTotal = periodExpenses.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const revenue = productRevenue + serviceRevenue;
    const grossProfit = revenue - cogs;
    const cashReceived = periodPayments.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const purchaseSpend = periodPurchases.reduce((sum, record) => sum + (record.total ?? 0), 0);
    const receivables = [...periodSales, ...periodJobs, ...periodOrders].reduce((sum, record) => sum + (record.outstandingBalance ?? (record.status === "COMPLETED" ? Math.max(0, (record.total ?? 0) - (record.paidAmount ?? 0)) : 0)), 0);
    const categories = new Map<string, number>();
    periodExpenses.forEach((record) => categories.set(record.category ?? "OTHER", (categories.get(record.category ?? "OTHER") ?? 0) + (record.amount ?? 0)));
    return { productRevenue, serviceRevenue, revenue, cogs, grossProfit, expenseTotal, netProfit: grossProfit - expenseTotal, cashReceived, purchaseSpend, receivables, categories: [...categories.entries()].sort((a, b) => b[1] - a[1]) };
  }, [expenses, jobs, orders, payments, period, purchases, sales]);

  return <div className="fi-view">
    <div className="fi-heading"><div><p className="eyebrow">FINANCIAL CONTROL</p><h2>Finance</h2><p>Live transaction-led performance from completed sales, services, payments, purchases, and expenses.</p></div><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="TODAY">Today</option><option value="MONTH">This month</option><option value="ALL">All time</option></select></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loaded.size < 6 && !error && <p className="table-empty">Loading finance records...</p>}
    <section className="fi-kpis"><article><span>Total revenue</span><b>{money(report.revenue)}</b><small>Products {money(report.productRevenue)} · Services {money(report.serviceRevenue)}</small></article><article><span>Gross profit</span><b>{money(report.grossProfit)}</b><small>Revenue less product COGS</small></article><article><span>Operating expenses</span><b>{money(report.expenseTotal)}</b><small>Recorded paid expenses</small></article><article className={report.netProfit < 0 ? "negative" : "positive"}><span>Net profit</span><b>{money(report.netProfit)}</b><small>Gross profit less expenses</small></article></section>
    <section className="fi-grid"><article><h3>Profit & loss</h3><dl><div><dt>Product revenue</dt><dd>{money(report.productRevenue)}</dd></div><div><dt>Service revenue</dt><dd>{money(report.serviceRevenue)}</dd></div><div><dt>Cost of goods sold</dt><dd>- {money(report.cogs)}</dd></div><div><dt>Gross profit</dt><dd>{money(report.grossProfit)}</dd></div><div><dt>Operating expenses</dt><dd>- {money(report.expenseTotal)}</dd></div><div className="fi-total"><dt>Net profit</dt><dd>{money(report.netProfit)}</dd></div></dl></article><article><h3>Cash & commitments</h3><dl><div><dt>Payments received</dt><dd>{money(report.cashReceived)}</dd></div><div><dt>Customer receivables</dt><dd>{money(report.receivables)}</dd></div><div><dt>Stock purchases</dt><dd>{money(report.purchaseSpend)}</dd></div></dl><p>Stock purchases increase inventory assets and are shown separately from operating expenses.</p></article></section>
    <section className="inventory-table fi-expenses"><div className="table-heading"><h2>Expense breakdown</h2><span>{report.categories.length} categories</span></div>{report.categories.length === 0 ? <p className="table-empty">No expenses in this period.</p> : <table><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead><tbody>{report.categories.map(([category, amount]) => <tr key={category}><td><b>{pretty(category)}</b></td><td>{money(amount)}</td><td>{report.expenseTotal ? `${((amount / report.expenseTotal) * 100).toFixed(1)}%` : "0%"}</td></tr>)}</tbody></table>}</section>
  </div>;
}
