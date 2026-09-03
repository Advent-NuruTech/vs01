"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useStaffToken } from "./staff-gate";

type PaymentMethod = "CASH" | "MPESA" | "CARD" | "BANK";

type ServiceJob = {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string;
  vehicleDescription?: string | null;
  serviceDescription: string;
  labourCharge: number;
  partsCharge: number;
  total: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  createdAt?: { toDate: () => Date };
};

type PaymentDraft = { amount: string; method: PaymentMethod };

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function dateLabel(timestamp?: ServiceJob["createdAt"]) {
  if (!timestamp?.toDate) return "Just now";
  return timestamp.toDate().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: ServiceJob["status"]) {
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "COMPLETED") return "Completed";
  return "Open";
}

function paymentLabel(status: ServiceJob["paymentStatus"]) {
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "UNPAID") return "Unpaid";
  return "Paid";
}

export function GarageClient() {
  const token = useStaffToken();
  const [jobs, setJobs] = useState<ServiceJob[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [labourCharge, setLabourCharge] = useState(0);
  const [partsCharge, setPartsCharge] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "serviceJobs"), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => {
      setJobs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ServiceJob));
      setLoadError("");
    },
    () => setLoadError("Unable to load service jobs. Check your connection and refresh the page."),
  ), []);

  const summary = useMemo(() => (jobs ?? []).reduce((current, job) => ({
    open: current.open + (job.status === "COMPLETED" ? 0 : 1),
    value: current.value + (job.total ?? 0),
    outstanding: current.outstanding + (job.outstandingBalance ?? 0),
  }), { open: 0, value: 0, outstanding: 0 }), [jobs]);

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
      return;
    }
    const total = labourCharge + partsCharge;
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a labour or parts charge greater than zero.");
      return;
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
      setError("The initial payment must be between zero and the job total.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    setSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/manage/service-jobs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          customer: { name: data.get("customerName"), phone: data.get("customerPhone") },
          vehicleRegistration: data.get("vehicleRegistration"),
          vehicleDescription: data.get("vehicleDescription") || undefined,
          serviceDescription: data.get("serviceDescription"),
          labourCharge,
          partsCharge,
          amountPaid,
          paymentMethod: data.get("paymentMethod"),
          status: data.get("status"),
        }),
      });
      const body = await response.text();
      let result: { error?: string; jobNumber?: string } = {};
      try {
        result = body ? JSON.parse(body) as typeof result : {};
      } catch {
        result = { error: body || `Service job failed (${response.status}).` };
      }
      if (!response.ok) {
        setError(result.error ?? `Service job failed (${response.status}).`);
        return;
      }
      if (!result.jobNumber) {
        setError("The job was accepted but no job number was returned. Check the job list before trying again.");
        return;
      }
      form.reset();
      setLabourCharge(0);
      setPartsCharge(0);
      setAmountPaid(0);
      setSuccess(`Service job created successfully - ${result.jobNumber}`);
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError"
        ? "The service request timed out. Check the job list before trying again."
        : reason instanceof Error && reason.message
          ? `Service job could not be created: ${reason.message}`
          : "Service job could not be created. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  };

  const updateDraft = (jobId: string, update: Partial<PaymentDraft>) => {
    setPaymentDrafts((current) => {
      const previous = current[jobId] ?? { amount: "", method: "CASH" as const };
      return { ...current, [jobId]: { ...previous, ...update } };
    });
  };

  const recordPayment = async (job: ServiceJob) => {
    if (!token) {
      setPaymentError("Your staff sign-in is still being verified. Please wait a moment, then try again.");
      return;
    }
    const draft = paymentDrafts[job.id] ?? { amount: "", method: "CASH" as const };
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > job.outstandingBalance) {
      setPaymentError(`Enter a payment between KES 1 and ${money(job.outstandingBalance)}.`);
      return;
    }

    setSavingPayment(job.id);
    setPaymentError("");
    setPaymentSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/manage/service-jobs/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ jobId: job.id, amount, method: draft.method }),
      });
      const body = await response.text();
      let result: { error?: string; outstandingBalance?: number } = {};
      try {
        result = body ? JSON.parse(body) as typeof result : {};
      } catch {
        result = { error: body || `Payment failed (${response.status}).` };
      }
      if (!response.ok) {
        setPaymentError(result.error ?? `Payment failed (${response.status}).`);
        return;
      }
      setPaymentDrafts((current) => ({ ...current, [job.id]: { ...draft, amount: "" } }));
      setPaymentSuccess(`Payment recorded for ${job.jobNumber}. Balance: ${money(result.outstandingBalance ?? 0)}.`);
    } catch (reason) {
      setPaymentError(reason instanceof DOMException && reason.name === "AbortError"
        ? "The payment request timed out. Check the updated balance before trying again."
        : reason instanceof Error && reason.message
          ? `Payment could not be recorded: ${reason.message}`
          : "Payment could not be recorded. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setSavingPayment(null);
    }
  };

  return (
    <div className="gr-view">
      <section className="gr-panel">
        <div className="gr-panel-intro">
          <p className="eyebrow">WORKSHOP CONTROL</p>
          <h2>New service job</h2>
          <p>Create a job card, capture the customer and vehicle details, set charges, and record any payment received.</p>
        </div>
        <form className="gr-form" onSubmit={createJob}>
          <fieldset className="gr-fieldset">
            <legend>Customer details</legend>
            <label>
              <span>Customer name</span>
              <input name="customerName" minLength={2} required placeholder="e.g. James Mwangi" />
            </label>
            <label>
              <span>Phone number</span>
              <input name="customerPhone" type="tel" minLength={7} required placeholder="0712 345 678" />
            </label>
          </fieldset>

          <fieldset className="gr-fieldset">
            <legend>Vehicle information</legend>
            <label>
              <span>Registration number</span>
              <input name="vehicleRegistration" minLength={2} required placeholder="KAB 123C" />
            </label>
            <label>
              <span>Make / model <small>(optional)</small></span>
              <input name="vehicleDescription" placeholder="Toyota Prado" />
            </label>
          </fieldset>

          <fieldset className="gr-fieldset gr-fieldset-full">
            <legend>Service details</legend>
            <label className="gr-textarea-field">
              <span>Work performed</span>
              <textarea name="serviceDescription" rows={3} minLength={3} required placeholder="Wheel alignment, tyre fitting, puncture repair..." />
            </label>
          </fieldset>

          <fieldset className="gr-fieldset">
            <legend>Charges</legend>
            <label>
              <span>Labour (KES)</span>
              <input type="number" min="0" step="0.01" placeholder="0" value={labourCharge || ""} onChange={(event) => setLabourCharge(Number(event.target.value))} />
            </label>
            <label>
              <span>Parts (KES)</span>
              <input type="number" min="0" step="0.01" placeholder="0" value={partsCharge || ""} onChange={(event) => setPartsCharge(Number(event.target.value))} />
            </label>
          </fieldset>

          <fieldset className="gr-fieldset">
            <legend>Payment &amp; status</legend>
            <label>
              <span>Initial payment (KES)</span>
              <input type="number" min="0" step="0.01" max={labourCharge + partsCharge || undefined} value={amountPaid || ""} onChange={(event) => setAmountPaid(Number(event.target.value))} />
            </label>
            <label>
              <span>Payment method</span>
              <select name="paymentMethod" defaultValue="CASH"><option>CASH</option><option>MPESA</option><option>CARD</option><option>BANK</option></select>
            </label>
            <label>
              <span>Job status</span>
              <select name="status" defaultValue="COMPLETED"><option value="OPEN">OPEN</option><option value="IN_PROGRESS">IN PROGRESS</option><option value="COMPLETED">COMPLETED</option></select>
            </label>
          </fieldset>

          <div className="gr-total">
            <div className="gr-total-row">
              <span>Job total</span>
              <b>{money(labourCharge + partsCharge)}</b>
            </div>
            <div className="gr-total-row gr-total-sub">
              <span>Balance after payment</span>
              <b>{money(Math.max(0, labourCharge + partsCharge - amountPaid))}</b>
            </div>
          </div>

          <div className="form-feedback" aria-live="polite">
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="form-success" role="status">{success}</p>}
          </div>
          <button className="gr-submit" disabled={saving}>
            {saving ? "Saving..." : "Create service job"}
          </button>
        </form>
      </section>

      <section className="gr-summary" aria-label="Service job summary">
        <article className="gr-stat">
          <div className="gr-stat-icon gr-stat-blue">📋</div>
          <div>
            <span>Jobs shown</span>
            <b>{jobs === null ? "—" : jobs.length}</b>
          </div>
        </article>
        <article className="gr-stat">
          <div className="gr-stat-icon gr-stat-amber">⏳</div>
          <div>
            <span>Open / in progress</span>
            <b>{summary.open}</b>
          </div>
        </article>
        <article className="gr-stat">
          <div className="gr-stat-icon gr-stat-green">💰</div>
          <div>
            <span>Total value</span>
            <b>{money(summary.value)}</b>
          </div>
        </article>
        <article className="gr-stat">
          <div className="gr-stat-icon gr-stat-red">📉</div>
          <div>
            <span>Outstanding</span>
            <b>{money(summary.outstanding)}</b>
          </div>
        </article>
      </section>

      <section className="gr-jobs">
        <div className="gr-jobs-header">
          <div>
            <h2>Service job cards</h2>
            <span className="gr-live-badge">● Live</span>
          </div>
          <span className="gr-jobs-count">{jobs === null ? "Loading..." : `${jobs.length} job(s)`}</span>
        </div>
        <div className="form-feedback" aria-live="polite">
          {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
          {paymentSuccess && <p className="form-success" role="status">{paymentSuccess}</p>}
        </div>
        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        {!loadError && jobs === null && <p className="gr-empty">Loading service jobs...</p>}
        {!loadError && jobs?.length === 0 && <p className="gr-empty">No service jobs have been recorded yet.</p>}
        {jobs && jobs.length > 0 && (
          <div className="gr-jobs-scroll">
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer / vehicle</th>
                  <th>Service</th>
                  <th>Charges</th>
                  <th>Status</th>
                  <th>Record payment</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const draft = paymentDrafts[job.id] ?? { amount: "", method: "CASH" as const };
                  const paymentClass = job.paymentStatus === "PAID" ? "in" : job.paymentStatus === "PARTIALLY_PAID" ? "low" : "out";
                  return (
                    <tr key={job.id}>
                      <td className="gr-td-job">
                        <b>{job.jobNumber}</b>
                        <small>{dateLabel(job.createdAt)}</small>
                      </td>
                      <td className="gr-td-customer">
                        <b>{job.customerName}</b>
                        <small>{job.customerPhone}</small>
                        <small>{job.vehicleRegistration}{job.vehicleDescription ? ` · ${job.vehicleDescription}` : ""}</small>
                      </td>
                      <td className="gr-td-desc">{job.serviceDescription}</td>
                      <td className="gr-td-charges">
                        <b>{money(job.total)}</b>
                        <small>Paid: {money(job.paidAmount)}</small>
                        <small>Balance: {money(job.outstandingBalance)}</small>
                      </td>
                      <td className="gr-td-status">
                        <span className={`gr-badge gr-badge-${job.status === "COMPLETED" ? "green" : "amber"}`}>
                          {statusLabel(job.status)}
                        </span>
                        <span className={`gr-payment-label gr-payment-${paymentClass}`}>
                          {paymentLabel(job.paymentStatus)}
                        </span>
                      </td>
                      <td className="gr-td-payment">
                        {job.outstandingBalance > 0 ? (
                          <div className="gr-payment-form">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={job.outstandingBalance}
                              placeholder={String(job.outstandingBalance)}
                              value={draft.amount}
                              onChange={(event) => updateDraft(job.id, { amount: event.target.value })}
                              aria-label={`Payment amount for ${job.jobNumber}`}
                            />
                            <select
                              value={draft.method}
                              onChange={(event) => updateDraft(job.id, { method: event.target.value as PaymentMethod })}
                              aria-label={`Payment method for ${job.jobNumber}`}
                            >
                              <option>CASH</option>
                              <option>MPESA</option>
                              <option>CARD</option>
                              <option>BANK</option>
                            </select>
                            <button
                              className="gr-pay-btn"
                              type="button"
                              disabled={savingPayment === job.id}
                              onClick={() => recordPayment(job)}
                            >
                              {savingPayment === job.id ? "..." : "Record"}
                            </button>
                          </div>
                        ) : (
                          <span className="gr-fully-paid">✓ Fully paid</span>
                        )}
                      </td>
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
