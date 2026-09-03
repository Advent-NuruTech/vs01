"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
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
  const add = (product: Product) => setLines((current) => {
    const existing = current.find((line) => line.id === product.id);
    return existing
      ? current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { ...product, quantity: 1, actualSellingPrice: product.sellingPrice }];
  });

  const complete = async () => {
    if (!token || !lines.length) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/manage/sales", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customer.name && customer.phone ? customer : undefined,
        lines: lines.map((line) => ({ productId: line.id, quantity: line.quantity, actualSellingPrice: line.actualSellingPrice })),
        payments: [{ method, amount: method === "CREDIT" ? 0 : paid || total }],
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "Sale failed.");
    setSuccess(`Sale completed - ${result.receiptNumber}`);
    setLines([]);
    setCustomer({ name: "", phone: "" });
    setPaid(0);
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
      {error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}
      <button className="button button-red" disabled={saving || !lines.length} onClick={complete}>{saving ? "Completing..." : "Complete sale"}</button>
    </aside>
  </div>;
}
