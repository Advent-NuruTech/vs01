"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { useStaffToken } from "./staff-gate";

type BusinessSettings = {
  businessName: string; phone: string; email: string; address: string; taxPin: string; mpesaTill: string;
  currency: "KES"; receiptFooter: string; receiptPrefix: string; orderPrefix: string;
  purchasePrefix: string; serviceJobPrefix: string; maxDiscountPercent: number;
};

const defaults: BusinessSettings = {
  businessName: "Vitour Xpress", phone: "", email: "", address: "", taxPin: "", mpesaTill: "",
  currency: "KES", receiptFooter: "Thank you for choosing Vitour Xpress.", receiptPrefix: "VX",
  orderPrefix: "VX", purchasePrefix: "PUR", serviceJobPrefix: "JOB", maxDiscountPercent: 100,
};

export function SettingsClient() {
  const token = useStaffToken();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(doc(db, "settings", "business"), (snapshot) => {
    setSettings({ ...defaults, ...(snapshot.exists() ? snapshot.data() : {}) } as BusinessSettings);
    setLoadError("");
  }, () => setLoadError("Unable to load business settings. Check your connection and refresh the page.")), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
    const data = new FormData(event.currentTarget);
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/manage/settings", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({
        businessName: data.get("businessName"), phone: data.get("phone"), email: data.get("email"), address: data.get("address"),
        taxPin: data.get("taxPin") || undefined, mpesaTill: data.get("mpesaTill") || undefined, currency: "KES",
        receiptFooter: data.get("receiptFooter"), receiptPrefix: data.get("receiptPrefix"), orderPrefix: data.get("orderPrefix"),
        purchasePrefix: data.get("purchasePrefix"), serviceJobPrefix: data.get("serviceJobPrefix"), maxDiscountPercent: Number(data.get("maxDiscountPercent")),
      }) });
      const body = await response.text(); const result = body ? JSON.parse(body) as { error?: string } : {};
      if (!response.ok) return setError(result.error ?? `Settings failed (${response.status}).`);
      setSuccess("Settings saved successfully. New transaction numbers will use the configured prefixes.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Settings could not be saved."); }
    finally { setSaving(false); }
  };

  return <div className="se-view"><div className="se-heading"><p className="eyebrow">BUSINESS SETTINGS</p><h2>Settings</h2><p>Manage business details, document numbering, receipt text, and POS discount limits.</p></div>{loadError && <p className="form-error" role="alert">{loadError}</p>}{settings === null && !loadError && <p className="table-empty">Loading settings...</p>}{settings && <form className="se-form" onSubmit={submit} key={`${settings.businessName}-${settings.receiptPrefix}`}>
    <fieldset><legend>Business profile</legend><label>Business name<input name="businessName" defaultValue={settings.businessName} required /></label><label>Phone<input name="phone" defaultValue={settings.phone} minLength={7} required /></label><label>Email<input name="email" type="email" defaultValue={settings.email} /></label><label>Tax PIN<input name="taxPin" defaultValue={settings.taxPin} /></label><label>M-Pesa till / paybill<input name="mpesaTill" defaultValue={settings.mpesaTill} /></label><label className="se-wide">Business address<textarea name="address" rows={3} defaultValue={settings.address} required /></label></fieldset>
    <fieldset><legend>Documents and sales</legend><label>POS receipt prefix<input name="receiptPrefix" defaultValue={settings.receiptPrefix} pattern="[A-Za-z0-9-]{2,10}" required /></label><label>Online order prefix<input name="orderPrefix" defaultValue={settings.orderPrefix} pattern="[A-Za-z0-9-]{2,10}" required /></label><label>Purchase prefix<input name="purchasePrefix" defaultValue={settings.purchasePrefix} pattern="[A-Za-z0-9-]{2,10}" required /></label><label>Service job prefix<input name="serviceJobPrefix" defaultValue={settings.serviceJobPrefix} pattern="[A-Za-z0-9-]{2,10}" required /></label><label>Maximum POS discount (%)<input name="maxDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue={settings.maxDiscountPercent} required /></label><label>Currency<input value="KES" readOnly /></label><label className="se-wide">Receipt footer<textarea name="receiptFooter" rows={3} maxLength={250} defaultValue={settings.receiptFooter} /></label></fieldset>
    <div className="form-feedback" aria-live="polite">{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</div><button className="button button-red" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button>
  </form>}</div>;
}
