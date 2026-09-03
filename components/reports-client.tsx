"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

type FirestoreDate = { toDate: () => Date };
type ReportType = "SALES" | "EXPENSES" | "PURCHASES" | "SERVICES" | "MECHANICS" | "INVENTORY" | "CUSTOMERS";
type RecordData = {
  id: string; createdAt?: FirestoreDate; expenseDate?: string; status?: string; paymentStatus?: string;
  receiptNumber?: string; orderNumber?: string; purchaseNumber?: string; jobNumber?: string; source?: string;
  customerId?: string; customerName?: string; customerPhone?: string; customer?: { fullName?: string; phone?: string };
  supplierName?: string; productName?: string; sku?: string; name?: string; fullName?: string; phone?: string; email?: string;
  category?: string; description?: string; vendor?: string; paymentMethod?: string; reference?: string;
  total?: number; amount?: number; cogs?: number; grossProfit?: number; profit?: number; paidAmount?: number; outstandingBalance?: number;
  totalPurchases?: number;
  quantity?: number; unitCost?: number; quantityInStock?: number; costPrice?: number; sellingPrice?: number; reorderLevel?: number;
  serviceDescription?: string; vehicleRegistration?: string; assignedEmployeeId?: string; role?: string; active?: boolean;
};

const reportTypes: Array<{ value: ReportType; label: string }> = [
  { value: "SALES", label: "Sales & profit" }, { value: "EXPENSES", label: "Expenses" },
  { value: "PURCHASES", label: "Supplier purchases" }, { value: "SERVICES", label: "Services" },
  { value: "MECHANICS", label: "Mechanics" }, { value: "INVENTORY", label: "Inventory" },
  { value: "CUSTOMERS", label: "Customer balances" },
];
const money = (value: number) => `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const pretty = (value?: string) => (value ?? "-").replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const isoDate = (date: Date) => date.toLocaleDateString("en-CA");

function recordDate(record: RecordData) {
  return record.createdAt?.toDate?.() ?? (record.expenseDate ? new Date(`${record.expenseDate}T00:00:00`) : null);
}

function inRange(record: RecordData, from: string, to: string) {
  const date = recordDate(record);
  if (!date) return false;
  const value = isoDate(date);
  return value >= from && value <= to;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function ReportsClient() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [type, setType] = useState<ReportType>("SALES");
  const [from, setFrom] = useState(isoDate(monthStart));
  const [to, setTo] = useState(isoDate(now));
  const [records, setRecords] = useState<Record<string, RecordData[]>>({});
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    const timed = ["sales", "orders", "expenses", "purchases", "serviceJobs"];
    const plain = ["products", "customers", "users"];
    const listen = (name: string, ordered: boolean) => onSnapshot(
      ordered ? query(collection(db, name), orderBy("createdAt", "desc"), limit(1000)) : collection(db, name),
      (snapshot) => {
        setRecords((current) => ({ ...current, [name]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as RecordData) }));
        setLoaded((current) => new Set(current).add(name));
      },
      () => setError(`Unable to load ${name} report data. Check your connection and refresh the page.`),
    );
    const stops = [...timed.map((name) => listen(name, true)), ...plain.map((name) => listen(name, false))];
    return () => stops.forEach((stop) => stop());
  }, []);

  const customersById = useMemo(() => new Map((records.customers ?? []).map((customer) => [customer.id, customer])), [records.customers]);
  const usersById = useMemo(() => new Map((records.users ?? []).map((user) => [user.id, user])), [records.users]);

  const report = useMemo(() => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let primaryLabel = "Records";
    let primaryValue = "0";
    let secondaryLabel = "Total value";
    let secondaryValue = money(0);
    let tertiaryLabel = "Outstanding";
    let tertiaryValue = money(0);

    if (type === "SALES") {
      headers = ["Date", "Reference", "Source", "Customer", "Revenue", "COGS", "Gross profit", "Paid", "Balance"];
      const sales = (records.sales ?? []).filter((item) => item.status !== "CANCELLED" && inRange(item, from, to));
      const orders = (records.orders ?? []).filter((item) => item.status === "COMPLETED" && inRange(item, from, to));
      const combined = [...sales.map((item) => ({ ...item, source: item.source ?? "POS" })), ...orders.map((item) => ({ ...item, source: "ONLINE" }))].sort((a, b) => (recordDate(b)?.getTime() ?? 0) - (recordDate(a)?.getTime() ?? 0));
      rows = combined.map((item) => {
        const customer = item.customerId ? customersById.get(item.customerId) : undefined;
        const paid = item.paidAmount ?? (item.paymentStatus === "PAID" ? item.total ?? 0 : 0);
        const balance = item.outstandingBalance ?? Math.max(0, (item.total ?? 0) - paid);
        return [recordDate(item)?.toLocaleDateString("en-KE") ?? "-", item.receiptNumber ?? item.orderNumber ?? item.id, item.source ?? "-", item.customerName ?? item.customer?.fullName ?? customer?.name ?? customer?.fullName ?? "Walk-in", money(item.total ?? 0), money(item.cogs ?? 0), money(item.grossProfit ?? item.profit ?? ((item.total ?? 0) - (item.cogs ?? 0))), money(paid), money(balance)];
      });
      const revenue = combined.reduce((sum, item) => sum + (item.total ?? 0), 0);
      const profit = combined.reduce((sum, item) => sum + (item.grossProfit ?? item.profit ?? ((item.total ?? 0) - (item.cogs ?? 0))), 0);
      const balance = combined.reduce((sum, item) => sum + (item.outstandingBalance ?? Math.max(0, (item.total ?? 0) - (item.paidAmount ?? 0))), 0);
      primaryValue = String(combined.length); secondaryValue = money(revenue); tertiaryLabel = "Gross profit"; tertiaryValue = money(profit);
      if (balance > 0) tertiaryLabel = `Gross profit · ${money(balance)} due`;
    } else if (type === "EXPENSES") {
      headers = ["Date", "Category", "Description", "Vendor", "Method", "Reference", "Amount"];
      const items = (records.expenses ?? []).filter((item) => inRange(item, from, to));
      rows = items.map((item) => [item.expenseDate ?? recordDate(item)?.toLocaleDateString("en-KE") ?? "-", pretty(item.category), item.description ?? "-", item.vendor ?? "-", item.paymentMethod ?? "-", item.reference ?? "-", money(item.amount ?? 0)]);
      primaryValue = String(items.length); secondaryLabel = "Expense total"; secondaryValue = money(items.reduce((sum, item) => sum + (item.amount ?? 0), 0)); tertiaryLabel = "Categories"; tertiaryValue = String(new Set(items.map((item) => item.category)).size);
    } else if (type === "PURCHASES") {
      headers = ["Date", "Purchase", "Supplier", "Product", "SKU", "Quantity", "Unit cost", "Total"];
      const items = (records.purchases ?? []).filter((item) => inRange(item, from, to));
      rows = items.map((item) => [recordDate(item)?.toLocaleDateString("en-KE") ?? "-", item.purchaseNumber ?? item.id, item.supplierName ?? "-", item.productName ?? "-", item.sku ?? "-", String(item.quantity ?? 0), money(item.unitCost ?? 0), money(item.total ?? 0)]);
      primaryValue = String(items.length); secondaryLabel = "Stock purchased"; secondaryValue = money(items.reduce((sum, item) => sum + (item.total ?? 0), 0)); tertiaryLabel = "Units received"; tertiaryValue = String(items.reduce((sum, item) => sum + (item.quantity ?? 0), 0));
    } else if (type === "SERVICES") {
      headers = ["Date", "Job", "Customer", "Vehicle", "Service", "Status", "Total", "Paid", "Balance"];
      const items = (records.serviceJobs ?? []).filter((item) => inRange(item, from, to));
      rows = items.map((item) => [recordDate(item)?.toLocaleDateString("en-KE") ?? "-", item.jobNumber ?? item.id, item.customerName ?? "-", item.vehicleRegistration ?? "-", item.serviceDescription ?? "-", pretty(item.status), money(item.total ?? 0), money(item.paidAmount ?? 0), money(item.outstandingBalance ?? 0)]);
      primaryValue = String(items.length); secondaryLabel = "Service value"; secondaryValue = money(items.reduce((sum, item) => sum + (item.total ?? 0), 0)); tertiaryValue = money(items.reduce((sum, item) => sum + (item.outstandingBalance ?? 0), 0));
    } else if (type === "MECHANICS") {
      headers = ["Mechanic / staff", "Role", "Jobs", "Service value", "Paid", "Outstanding"];
      const jobs = (records.serviceJobs ?? []).filter((item) => inRange(item, from, to));
      const grouped = new Map<string, { jobs: number; total: number; paid: number; balance: number }>();
      jobs.forEach((job) => { const id = job.assignedEmployeeId ?? "unassigned"; const current = grouped.get(id) ?? { jobs: 0, total: 0, paid: 0, balance: 0 }; current.jobs += 1; current.total += job.total ?? 0; current.paid += job.paidAmount ?? 0; current.balance += job.outstandingBalance ?? 0; grouped.set(id, current); });
      rows = [...grouped.entries()].map(([id, values]) => { const user = usersById.get(id); return [user?.name ?? user?.fullName ?? user?.email ?? (id === "unassigned" ? "Unassigned" : id.slice(0, 8)), pretty(user?.role ?? "STAFF"), String(values.jobs), money(values.total), money(values.paid), money(values.balance)]; });
      primaryLabel = "Staff with jobs"; primaryValue = String(grouped.size); secondaryLabel = "Jobs completed/created"; secondaryValue = String(jobs.length); tertiaryLabel = "Service value"; tertiaryValue = money(jobs.reduce((sum, job) => sum + (job.total ?? 0), 0));
    } else if (type === "INVENTORY") {
      headers = ["Product", "SKU", "Stock", "Cost price", "Selling price", "Inventory value", "Reorder level", "Status"];
      const items = records.products ?? [];
      rows = items.map((item) => [item.name ?? "-", item.sku ?? "-", String(item.quantityInStock ?? 0), money(item.costPrice ?? 0), money(item.sellingPrice ?? 0), money((item.quantityInStock ?? 0) * (item.costPrice ?? 0)), String(item.reorderLevel ?? 0), (item.quantityInStock ?? 0) <= 0 ? "Out of stock" : (item.quantityInStock ?? 0) <= (item.reorderLevel ?? 0) ? "Low stock" : "In stock"]);
      primaryLabel = "Products"; primaryValue = String(items.length); secondaryLabel = "Inventory value"; secondaryValue = money(items.reduce((sum, item) => sum + (item.quantityInStock ?? 0) * (item.costPrice ?? 0), 0)); tertiaryLabel = "Low / out of stock"; tertiaryValue = String(items.filter((item) => (item.quantityInStock ?? 0) <= (item.reorderLevel ?? 0)).length);
    } else {
      headers = ["Customer", "Phone", "Email", "POS purchase value", "Outstanding balance"];
      const items = records.customers ?? [];
      rows = items.map((item) => [item.name ?? item.fullName ?? "Unnamed", item.phone ?? "-", item.email ?? "-", money(item.totalPurchases ?? 0), money(item.outstandingBalance ?? 0)]);
      primaryLabel = "Customers"; primaryValue = String(items.length); secondaryLabel = "Outstanding"; secondaryValue = money(items.reduce((sum, item) => sum + (item.outstandingBalance ?? 0), 0)); tertiaryLabel = "Customers with balances"; tertiaryValue = String(items.filter((item) => (item.outstandingBalance ?? 0) > 0).length);
    }
    return { headers, rows, primaryLabel, primaryValue, secondaryLabel, secondaryValue, tertiaryLabel, tertiaryValue };
  }, [customersById, from, records, to, type, usersById]);

  const downloadCsv = () => {
    const csv = [report.headers, ...report.rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${type.toLowerCase()}-report-${from}-to-${to}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const dated = !["INVENTORY", "CUSTOMERS"].includes(type);
  return <div className="rp-view">
    <div className="rp-heading"><div><p className="eyebrow">REPORTING</p><h2>Reports</h2><p>Live operational and financial reports generated from recorded transactions.</p></div><button className="button button-blue" onClick={downloadCsv} disabled={!report.rows.length}>Export CSV</button></div>
    <nav className="rp-tabs" aria-label="Report type">{reportTypes.map((item) => <button key={item.value} className={type === item.value ? "active" : ""} onClick={() => setType(item.value)}>{item.label}</button>)}</nav>
    {dated && <div className="rp-filters"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label></div>}
    {error && <p className="form-error" role="alert">{error}</p>}{loaded.size < 8 && !error && <p className="table-empty">Loading report data...</p>}
    <section className="rp-summary"><article><span>{report.primaryLabel}</span><b>{report.primaryValue}</b></article><article><span>{report.secondaryLabel}</span><b>{report.secondaryValue}</b></article><article><span>{report.tertiaryLabel}</span><b>{report.tertiaryValue}</b></article></section>
    <section className="inventory-table rp-table"><div className="table-heading"><h2>{reportTypes.find((item) => item.value === type)?.label}</h2><span>{report.rows.length} row(s)</span></div>{report.rows.length === 0 ? <p className="table-empty">No records found for this report and date range.</p> : <div className="table-scroll"><table><thead><tr>{report.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row, rowIndex) => <tr key={`${type}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>}</section>
  </div>;
}
