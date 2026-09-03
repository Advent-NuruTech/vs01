"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useStaffToken } from "./staff-gate";

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  paymentMethod: string;
  expenseDate: string;
  reference?: string | null;
  createdAt?: { toDate: () => Date };
};

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function ExpensesClient() {
  const token = useStaffToken();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(500)),
    (snapshot) => {
      setExpenses(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Expense));
      setLoadError("");
    },
    () => setLoadError("Unable to load expenses. Check your connection and refresh the page."),
  ), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return expenses ?? [];
    return (expenses ?? []).filter((expense) => `${expense.description} ${expense.vendor} ${expense.category} ${expense.reference ?? ""}`.toLowerCase().includes(term));
  }, [expenses, search]);

  const total = useMemo(() => (expenses ?? []).reduce((sum, expense) => sum + (expense.amount ?? 0), 0), [expenses]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return setError("Expense amount must be greater than zero.");

    setSaving(true);
    setError("");
    setSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/manage/expenses", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          category: data.get("category"), description: data.get("description"), amount,
          vendor: data.get("vendor"), paymentMethod: data.get("paymentMethod"),
          expenseDate: data.get("expenseDate"), reference: data.get("reference") || undefined,
        }),
      });
      const body = await response.text();
      const result = body ? JSON.parse(body) as { error?: string } : {};
      if (!response.ok) return setError(result.error ?? `Expense failed (${response.status}).`);
      form.reset();
      setSuccess("Expense recorded successfully.");
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError" ? "The expense request timed out. Check the list before trying again." : reason instanceof Error ? reason.message : "Expense could not be recorded.");
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  };

  return <div className="ex-view">
    <section className="ex-panel">
      <div><p className="eyebrow">OPERATING COSTS</p><h2>Record expense</h2><p>Record paid business costs. Expenses reduce net profit without changing sales revenue.</p></div>
      <form onSubmit={submit} className="ex-form">
        <label>Category<select name="category" defaultValue="SUPPLIES"><option>RENT</option><option>UTILITIES</option><option>SALARIES</option><option>TRANSPORT</option><option>MARKETING</option><option>MAINTENANCE</option><option>TAX</option><option>SUPPLIES</option><option>OTHER</option></select></label>
        <label>Vendor / payee<input name="vendor" minLength={2} required /></label>
        <label>Amount (KES)<input name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label>Payment method<select name="paymentMethod" defaultValue="CASH"><option>CASH</option><option>MPESA</option><option>CARD</option><option>BANK</option></select></label>
        <label>Date<input name="expenseDate" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} required /></label>
        <label>Receipt / reference <small>(optional)</small><input name="reference" maxLength={100} /></label>
        <label className="ex-description">Description<textarea name="description" rows={3} minLength={3} required /></label>
        <div className="form-feedback" aria-live="polite">{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</div>
        <button className="button button-red" disabled={saving}>{saving ? "Recording..." : "Record expense"}</button>
      </form>
    </section>
    <section className="ex-summary"><article><span>Expenses shown</span><b>{expenses === null ? "-" : expenses.length}</b></article><article><span>Total expenses</span><b>{money(total)}</b></article></section>
    <section className="inventory-table ex-table">
      <div className="ex-toolbar"><div><h2>Expense history</h2><span>Latest 500 records</span></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></div>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!loadError && expenses === null && <p className="table-empty">Loading expenses...</p>}
      {!loadError && expenses?.length === 0 && <p className="table-empty">No expenses have been recorded yet.</p>}
      {expenses && expenses.length > 0 && filtered.length === 0 && <p className="table-empty">No expenses match your search.</p>}
      {filtered.length > 0 && <div className="table-scroll"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{filtered.map((expense) => <tr key={expense.id}><td>{expense.expenseDate}</td><td><span className="status low">{label(expense.category)}</span></td><td>{expense.description}</td><td>{expense.vendor}</td><td>{expense.paymentMethod}</td><td>{expense.reference || "-"}</td><td><b>{money(expense.amount)}</b></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
