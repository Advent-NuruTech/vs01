"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/domain";
import { useStaffToken } from "./staff-gate";

type PurchaseMovement = {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  quantity: number;
  unitCost?: number;
  total?: number;
  supplierName?: string;
  reference?: string;
  purchaseNumber?: string;
  timestamp?: { toDate: () => Date };
  type: string;
};

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function dateLabel(timestamp?: PurchaseMovement["timestamp"]) {
  if (!timestamp?.toDate) return "Just now";
  return timestamp.toDate().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export function PurchasesClient() {
  const token = useStaffToken();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [movements, setMovements] = useState<PurchaseMovement[] | null>(null);
  const [productError, setProductError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const productsStop = onSnapshot(
      query(collection(db, "products"), orderBy("name")),
      (snapshot) => {
        setProducts(snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as Product)
          .filter((product) => product.active));
        setProductError("");
      },
      () => setProductError("Unable to load products. Check your connection and refresh the page."),
    );
    const movementsStop = onSnapshot(
      query(collection(db, "inventoryMovements"), orderBy("timestamp", "desc"), limit(200)),
      (snapshot) => {
        setMovements(snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as PurchaseMovement)
          .filter((movement) => movement.type === "PURCHASE"));
        setHistoryError("");
      },
      () => setHistoryError("Unable to load purchase history. Check your connection and refresh the page."),
    );

    return () => {
      productsStop();
      movementsStop();
    };
  }, []);

  const productsById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products],
  );

  const summary = useMemo(() => (movements ?? []).reduce((acc, m) => ({
    count: acc.count + 1,
    units: acc.units + Math.abs(m.quantity),
    value: acc.value + (m.total ?? (m.unitCost !== undefined ? m.unitCost * Math.abs(m.quantity) : 0)),
  }), { count: 0, units: 0, value: 0 }), [movements]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const quantity = Number(data.get("quantity"));
    const unitCost = Number(data.get("unitCost"));
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Unit cost cannot be empty or negative.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/manage/purchases", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          productId: data.get("productId"),
          quantity,
          unitCost,
          supplierName: data.get("supplierName"),
          reference: data.get("reference") || undefined,
          notes: data.get("notes") || undefined,
        }),
      });
      const body = await response.text();
      let result: { error?: string; purchaseNumber?: string } = {};
      try {
        result = body ? JSON.parse(body) as typeof result : {};
      } catch {
        result = { error: body || `Purchase failed (${response.status}).` };
      }
      if (!response.ok) {
        setError(result.error ?? `Purchase failed (${response.status}).`);
        return;
      }
      if (!result.purchaseNumber) {
        setError("The purchase was received but no reference number was returned. Check the history before trying again.");
        return;
      }
      form.reset();
      setSuccess(`Purchase received successfully - ${result.purchaseNumber}`);
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError"
        ? "The purchase request timed out. Check the history before trying again."
        : reason instanceof Error && reason.message
          ? `Purchase could not be received: ${reason.message}`
          : "Purchase could not be received. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  };

  return (
    <div className="pc-view">
      <section className="pc-panel">
        <div className="pc-panel-intro">
          <p className="eyebrow">RESTOCKING</p>
          <h2>Receive a purchase</h2>
          <p>Record supplier stock as it arrives. This increases available stock and updates the product&apos;s current cost while preserving historic sale margins.</p>
        </div>
        <form onSubmit={submit} className="pc-form">
          <fieldset className="pc-fieldset">
            <legend>Stock details</legend>
            <label className="pc-select-field">
              <span>Product</span>
              <select name="productId" required defaultValue="">
                <option value="" disabled>{products === null ? "Loading products..." : "Select a product"}</option>
                {(products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.sku} ({product.quantityInStock} in stock)
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quantity received</span>
              <input name="quantity" type="number" min="1" step="1" required placeholder="e.g. 20" />
            </label>
            <label>
              <span>Unit cost (KES)</span>
              <input name="unitCost" type="number" min="0" step="0.01" required placeholder="e.g. 4500" />
            </label>
          </fieldset>

          <fieldset className="pc-fieldset">
            <legend>Supplier details</legend>
            <label>
              <span>Supplier name</span>
              <input name="supplierName" minLength={2} required placeholder="e.g. Kenway Autospares" />
            </label>
            <label className="pc-opt-field">
              <span>Invoice / reference <small>(optional)</small></span>
              <input name="reference" maxLength={100} placeholder="INV-2024-001" />
            </label>
            <label className="pc-opt-field">
              <span>Notes <small>(optional)</small></span>
              <input name="notes" maxLength={300} placeholder="Delivery notes, batch info..." />
            </label>
          </fieldset>

          <div className="pc-total">
            <div className="pc-total-row">
              <span>Stock levels</span>
              <b>{products === null ? "..." : `${products.length} active product(s)`}</b>
            </div>
            <div className="pc-total-row pc-total-sub">
              <span>Data updates live</span>
              <b>✓</b>
            </div>
          </div>

          <div className="form-feedback" aria-live="polite">
            {productError && <p className="form-error" role="alert">{productError}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="form-success" role="status">{success}</p>}
          </div>
          <button className="pc-submit" disabled={saving || products === null || products.length === 0}>
            {saving ? "Receiving..." : "Receive purchase"}
          </button>
        </form>
      </section>

      <section className="pc-summary" aria-label="Purchase summary">
        <article className="pc-stat">
          <div className="pc-stat-icon pc-stat-blue">📦</div>
          <div>
            <span>Purchases shown</span>
            <b>{movements === null ? "—" : summary.count}</b>
          </div>
        </article>
        <article className="pc-stat">
          <div className="pc-stat-icon pc-stat-amber">🔢</div>
          <div>
            <span>Units received</span>
            <b>{summary.units}</b>
          </div>
        </article>
        <article className="pc-stat">
          <div className="pc-stat-icon pc-stat-green">💰</div>
          <div>
            <span>Total stock value</span>
            <b>{money(summary.value)}</b>
          </div>
        </article>
      </section>

      <section className="pc-history">
        <div className="pc-history-header">
          <h2>Purchase history</h2>
          <span className="pc-history-count">{movements === null ? "Loading..." : `${movements.length} purchase(s)`}</span>
        </div>
        {historyError && <p className="form-error" role="alert">{historyError}</p>}
        {!historyError && movements === null && <p className="pc-empty">Loading purchase history...</p>}
        {!historyError && movements?.length === 0 && <p className="pc-empty">No purchases have been received yet.</p>}
        {movements && movements.length > 0 && (
          <div className="pc-history-scroll">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const product = productsById.get(movement.productId);
                  const unitCost = movement.unitCost ?? product?.costPrice;
                  const total = movement.total ?? (unitCost === undefined ? undefined : unitCost * Math.abs(movement.quantity));
                  return (
                    <tr key={movement.id}>
                      <td className="pc-td-date">{dateLabel(movement.timestamp)}</td>
                      <td className="pc-td-ref">
                        <b>{movement.purchaseNumber ?? movement.reference ?? "-"}</b>
                      </td>
                      <td className="pc-td-product">
                        <b>{movement.productName ?? product?.name ?? "Unknown product"}</b>
                        <small>{movement.sku ?? product?.sku ?? movement.productId}</small>
                      </td>
                      <td className="pc-td-supplier">{movement.supplierName ?? "-"}</td>
                      <td className="pc-td-qty">
                        <span className="pc-qty-badge">+{Math.abs(movement.quantity)}</span>
                      </td>
                      <td className="pc-td-cost">{unitCost === undefined ? "-" : money(unitCost)}</td>
                      <td className="pc-td-total"><b>{total === undefined ? "-" : money(total)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
