"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/domain";
import { useStaffToken } from "./staff-gate";

type PosLine = Product & { quantity: number; actualSellingPrice: number };

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export function PosClient() {
  const token = useStaffToken();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productError, setProductError] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [method, setMethod] = useState<"CASH" | "MPESA" | "CARD" | "BANK" | "CREDIT">("CASH");
  const [paid, setPaid] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setProductError("Products are taking longer than expected to load. Please refresh the page.");
    }, 12_000);
    const stop = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
      window.clearTimeout(timeout);
      setProducts(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as Product)
        .filter((product) => product.active && product.quantityInStock > 0));
      setProductError("");
    }, () => {
      window.clearTimeout(timeout);
      setProductError("Unable to load products. Please refresh the page.");
    });

    return () => {
      window.clearTimeout(timeout);
      stop();
    };
  }, []);

  const filtered = (products ?? []).filter((product) => `${product.name} ${product.sku} ${product.barcode ?? ""} ${product.brand} ${product.tyreSize ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.actualSellingPrice * line.quantity, 0), [lines]);
  const add = (product: Product) => {
    const existing = lines.find((line) => line.id === product.id);
    if (existing && existing.quantity >= product.quantityInStock) {
      setError(`Only ${product.quantityInStock} unit(s) of ${product.name} are in stock.`);
      return;
    }
    setError("");
    setLines((current) => existing
      ? current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { ...product, quantity: 1, actualSellingPrice: product.sellingPrice }]);
  };

  const complete = async () => {
    if (!lines.length) return setError("Add at least one product before completing the sale.");
    if (!token) return setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
    if ((customer.name && !customer.phone) || (!customer.name && customer.phone)) {
      return setError("Enter both the customer name and phone number, or leave both fields empty for a walk-in sale.");
    }
    if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.quantityInStock)) {
      return setError("Check the quantities. Each quantity must be a whole number within the available stock.");
    }
    if (lines.some((line) => !Number.isFinite(line.actualSellingPrice) || line.actualSellingPrice < 0)) {
      return setError("Check the selling prices. Prices cannot be empty or negative.");
    }
    if (method !== "CREDIT" && paid > total) {
      return setError("Amount received cannot be greater than the sale total.");
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/manage/sales", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          customer: customer.name && customer.phone ? customer : undefined,
          lines: lines.map((line) => ({ productId: line.id, quantity: line.quantity, actualSellingPrice: line.actualSellingPrice })),
          payments: [{ method, amount: method === "CREDIT" ? 0 : paid || total }],
        }),
      });
      const body = await response.text();
      let result: { error?: string; receiptNumber?: string } = {};
      try {
        result = body ? JSON.parse(body) as { error?: string; receiptNumber?: string } : {};
      } catch {
        result = { error: body || `Sale failed (${response.status}).` };
      }
      if (!response.ok) return setError(result.error ?? `Sale failed (${response.status}).`);
      if (!result.receiptNumber) return setError("The sale was accepted but no receipt number was returned. Please check Sales before trying again.");
      setSuccess(`Sale completed - ${result.receiptNumber}`);
      setLines([]);
      setCustomer({ name: "", phone: "" });
      setPaid(0);
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError"
        ? "The sale request timed out. Check your connection and Sales history before trying again."
        : reason instanceof Error && reason.message
          ? `Sale could not be completed: ${reason.message}`
          : "Sale could not be completed. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  };

  const productContent = productError
    ? <p className="pos-empty" role="alert">{productError}</p>
    : products === null
      ? <p className="pos-empty">Loading products...</p>
      : filtered.length
        ? <div className="pos-grid">{filtered.map((product) => <button key={product.id} onClick={() => add(product)}><small>{product.brand} - {product.tyreSize ?? product.category}</small><b>{product.name}</b><span>{money(product.sellingPrice)} - {product.quantityInStock} in stock</span></button>)}</div>
        : <p className="pos-empty">{search ? "No products match your search." : "No products are currently in stock."}</p>;

  return <div className="pos-layout">
    <section className="pos-products">
      <div className="pos-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU, barcode, brand or tyre size" /><span>{products === null ? "Loading..." : `${filtered.length} available`}</span></div>
      {productContent}
    </section>
    <aside className="pos-sale">
      <p className="eyebrow">CURRENT SALE</p><h2>Walk-in sale</h2>
      <div className="pos-customer"><input placeholder="Customer name (optional)" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /><input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></div>
      {lines.length ? <div className="pos-lines">{lines.map((line) => <div key={line.id}><div><b>{line.name}</b><small>{line.tyreSize ?? line.sku}</small></div><input aria-label="Quantity" type="number" min="1" max={line.quantityInStock} value={line.quantity} onChange={(event) => setLines(lines.map((item) => item.id === line.id ? { ...item, quantity: Number(event.target.value) } : item))} /><input aria-label="Actual selling price" type="number" min="0" value={line.actualSellingPrice} onChange={(event) => setLines(lines.map((item) => item.id === line.id ? { ...item, actualSellingPrice: Number(event.target.value) } : item))} /><button onClick={() => setLines(lines.filter((item) => item.id !== line.id))}>x</button></div>)}</div> : <p className="pos-empty">Search and select products to begin.</p>}
      <div className="pos-payment"><label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option>CASH</option><option>MPESA</option><option>CARD</option><option>BANK</option><option>CREDIT</option></select></label><label>Amount received<input type="number" min="0" value={paid || ""} placeholder={String(total)} onChange={(event) => setPaid(Number(event.target.value))} /></label></div>
      <div className="pos-total"><span>Total</span><b>{money(total)}</b></div>
      <div className="form-feedback" aria-live="polite">
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success" role="status">{success} <Link href="/manage/sales">View sales history</Link></p>}
      </div>
      <button className="button button-red" disabled={saving || !lines.length} onClick={complete}>{saving ? "Completing..." : "Complete sale"}</button>
    </aside>
  </div>;
}
