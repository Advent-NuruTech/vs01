"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

type SaleLine = {
  productName: string;
  sku?: string;
  quantity: number;
  actualSellingPrice: number;
  lineTotal: number;
};

type SaleRecord = {
  id: string;
  receiptNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  lines: SaleLine[];
  total: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  status: string;
  source?: string;
  createdAt?: { toDate: () => Date };
};

type CustomerRecord = { id: string; name?: string; phone?: string };

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function dateLabel(timestamp?: SaleRecord["createdAt"]) {
  if (!timestamp?.toDate) return "Just now";
  return timestamp.toDate().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function paymentLabel(status: SaleRecord["paymentStatus"]) {
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "UNPAID") return "Unpaid";
  return "Paid";
}

export function SalesClient() {
  const [sales, setSales] = useState<SaleRecord[] | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [salesError, setSalesError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const salesStop = onSnapshot(
      query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(100)),
      (snapshot) => {
        setSales(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SaleRecord));
        setSalesError("");
      },
      () => setSalesError("Unable to load sales. Check your connection and refresh the page."),
    );
    const customersStop = onSnapshot(
      collection(db, "customers"),
      (snapshot) => {
        setCustomers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CustomerRecord));
        setCustomerError("");
      },
      () => setCustomerError("Some older customer names could not be loaded."),
    );

    return () => {
      salesStop();
      customersStop();
    };
  }, []);

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales ?? [];
    return (sales ?? []).filter((sale) => {
      const customer = sale.customerId ? customersById.get(sale.customerId) : undefined;
      const searchable = [
        sale.receiptNumber,
        sale.customerName,
        sale.customerPhone,
        customer?.name,
        customer?.phone,
        ...sale.lines.flatMap((line) => [line.productName, line.sku]),
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(term);
    });
  }, [customersById, sales, search]);

  const totals = useMemo(() => (sales ?? []).reduce(
    (summary, sale) => ({
      revenue: summary.revenue + (sale.total ?? 0),
      paid: summary.paid + (sale.paidAmount ?? 0),
      outstanding: summary.outstanding + (sale.outstandingBalance ?? 0),
    }),
    { revenue: 0, paid: 0, outstanding: 0 },
  ), [sales]);

  return <div className="sales-view">
    <div className="sales-heading">
      <div><p className="eyebrow">LIVE SALES RECORDS</p><h2>Sales history</h2><p>Completed POS sales appear here immediately.</p></div>
      <span className="live-badge">● LIVE</span>
    </div>

    <section className="sales-summary" aria-label="Totals for the latest sales shown">
      <article><span>Sales shown</span><b>{sales === null ? "-" : sales.length}</b></article>
      <article><span>Total value</span><b>{money(totals.revenue)}</b></article>
      <article><span>Amount paid</span><b>{money(totals.paid)}</b></article>
      <article><span>Outstanding</span><b>{money(totals.outstanding)}</b></article>
    </section>

    <section className="inventory-table sales-table">
      <div className="sales-toolbar">
        <div><h2>Recent sales</h2><span>Latest 100 transactions</span></div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipt, customer or product" aria-label="Search sales" />
      </div>
      {salesError && <p className="form-error" role="alert">{salesError}</p>}
      {customerError && <p className="form-error" role="alert">{customerError}</p>}
      {!salesError && sales === null && <p className="table-empty">Loading sales...</p>}
      {!salesError && sales?.length === 0 && <p className="table-empty">No completed sales have been recorded yet.</p>}
      {!salesError && sales && sales.length > 0 && filtered.length === 0 && <p className="table-empty">No sales match your search.</p>}
      {filtered.length > 0 && <div className="table-scroll"><table>
        <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment</th></tr></thead>
        <tbody>{filtered.map((sale) => {
          const customer = sale.customerId ? customersById.get(sale.customerId) : undefined;
          const customerName = sale.customerName || customer?.name || "Walk-in";
          const customerPhone = sale.customerPhone || customer?.phone;
          const paymentClass = sale.paymentStatus === "PAID" ? "in" : sale.paymentStatus === "PARTIALLY_PAID" ? "low" : "out";
          return <tr key={sale.id}>
            <td>{dateLabel(sale.createdAt)}</td>
            <td><b>{sale.receiptNumber}</b><small>{sale.source ?? "POS"}</small></td>
            <td><b>{customerName}</b>{customerPhone && <small>{customerPhone}</small>}</td>
            <td className="sale-items">{sale.lines.map((line) => <span key={`${sale.id}-${line.productName}-${line.quantity}`}>{line.productName} × {line.quantity}</span>)}</td>
            <td><b>{money(sale.total ?? 0)}</b></td>
            <td>{money(sale.paidAmount ?? 0)}</td>
            <td>{money(sale.outstandingBalance ?? 0)}</td>
            <td><span className={`status ${paymentClass}`}>{paymentLabel(sale.paymentStatus)}</span></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
