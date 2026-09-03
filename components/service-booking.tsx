"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

const WHATSAPP_NUMBER = "254720831601";

const services = [
  { name: "Tyre fitting", icon: "🔧", desc: "Expert fitting for all tyre brands and sizes with precision balancing included." },
  { name: "Puncture repair", icon: "🛡️", desc: "Fast, reliable puncture repairs to get you back on the road safely." },
  { name: "Wheel balancing", icon: "⚖️", desc: "Smooth rides guaranteed with our computerised wheel balancing system." },
  { name: "Wheel alignment", icon: "🎯", desc: "Laser-guided alignment for even tyre wear and optimal handling." },
  { name: "Brake service", icon: "🛑", desc: "Complete brake inspection, pad replacement, and fluid flush services." },
  { name: "Oil change", icon: "🛢️", desc: "Full synthetic or conventional oil change with filter replacement." },
  { name: "Diagnostics", icon: "🔍", desc: "Advanced OBD-II diagnostics to pinpoint engine and electrical issues." },
  { name: "Mechanical repairs", icon: "⚙️", desc: "Engine, suspension, and drivetrain repairs by certified technicians." },
] as const;

type ServiceRequestResponse = {
  error?: string;
  requestNumber?: string;
};

export function ServiceBooking() {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedService, setSelectedService] = useState<string>(services[0].name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const chooseService = (service: string) => {
    setSelectedService(service);
    window.requestAnimationFrame(() => {
      document.getElementById("service-booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector<HTMLInputElement>("input[name='customerName']")?.focus({ preventScroll: true });
    });
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");

    const payload = {
      serviceName: selectedService,
      customerName: data.get("customerName"),
      customerPhone: data.get("customerPhone"),
      vehicleRegistration: data.get("vehicleRegistration"),
      vehicleDescription: data.get("vehicleDescription") || undefined,
      preferredDate: data.get("preferredDate") || undefined,
      notes: data.get("notes") || undefined,
      website: data.get("website") || undefined,
    };

    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.text();
      let result: ServiceRequestResponse = {};
      try {
        result = body ? JSON.parse(body) as ServiceRequestResponse : {};
      } catch {
        result = { error: body || `Booking failed (${response.status}).` };
      }

      if (!response.ok || !result.requestNumber) {
        setError(result.error ?? "We could not save your request. Please try again.");
        return;
      }

      const vehicleDescription = String(data.get("vehicleDescription") || "Not provided");
      const preferredDate = String(data.get("preferredDate") || "Flexible");
      const notes = String(data.get("notes") || "None");
      const message = [
        "Hello Vitour Xpress, I have submitted a service request.",
        "",
        `Request: ${result.requestNumber}`,
        `Service: ${selectedService}`,
        `Name: ${String(data.get("customerName"))}`,
        `Phone: ${String(data.get("customerPhone"))}`,
        `Vehicle registration: ${String(data.get("vehicleRegistration")).toUpperCase()}`,
        `Vehicle: ${vehicleDescription}`,
        `Preferred date: ${preferredDate}`,
        `Notes: ${notes}`,
      ].join("\n");

      window.location.assign(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
    } catch {
      setError("We could not save your request. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="svc-page">
      <header className="svc-hero">
        <Link href="/" className="svc-back">← Vitour Xpress</Link>
        <p className="eyebrow light">WORKSHOP SERVICES</p>
        <h1>Precision care for every kilometre.</h1>
        <p className="svc-lead">Book a service with experienced technicians and receive a clear assessment before work begins.</p>
      </header>

      <section className="svc-grid-wrap" aria-labelledby="service-options-title">
        <div className="svc-section-heading">
          <div>
            <p className="eyebrow">CHOOSE A SERVICE</p>
            <h2 id="service-options-title">How can we help?</h2>
          </div>
          <p>Select a service, share your vehicle details, then continue the conversation on WhatsApp.</p>
        </div>
        <div className="svc-grid">
          {services.map((service) => (
            <article key={service.name} className={`svc-card${selectedService === service.name ? " selected" : ""}`}>
              <div className="svc-card-icon" aria-hidden="true">{service.icon}</div>
              <h3>{service.name}</h3>
              <p>{service.desc}</p>
              <button type="button" className="svc-card-link" onClick={() => chooseService(service.name)}>
                Book now <span>→</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="svc-booking-wrap" id="service-booking">
        <div className="svc-booking-copy">
          <p className="eyebrow light">BOOK YOUR VISIT</p>
          <h2>Tell us about your vehicle.</h2>
          <p>Your request is recorded for our workshop team before you are redirected to WhatsApp.</p>
          <div className="svc-booking-steps" aria-label="Booking steps">
            <span><b>1</b> Complete the request</span>
            <span><b>2</b> We save it securely</span>
            <span><b>3</b> Continue on WhatsApp</span>
          </div>
        </div>

        <form ref={formRef} className="svc-booking-form" onSubmit={submitBooking}>
          <label className="svc-form-full">
            <span>Service required</span>
            <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
              {services.map((service) => <option key={service.name}>{service.name}</option>)}
              <option>Vehicle inspection</option>
            </select>
          </label>
          <label>
            <span>Your name</span>
            <input name="customerName" minLength={2} maxLength={120} autoComplete="name" required placeholder="e.g. James Mwangi" />
          </label>
          <label>
            <span>Phone number</span>
            <input name="customerPhone" type="tel" minLength={7} maxLength={30} autoComplete="tel" required placeholder="e.g. 0712 345 678" />
          </label>
          <label>
            <span>Vehicle registration</span>
            <input name="vehicleRegistration" minLength={2} maxLength={30} autoCapitalize="characters" required placeholder="e.g. KAB 123C" />
          </label>
          <label>
            <span>Vehicle make / model <small>(optional)</small></span>
            <input name="vehicleDescription" maxLength={120} placeholder="e.g. Toyota Prado" />
          </label>
          <label className="svc-form-full">
            <span>Preferred date <small>(optional)</small></span>
            <input name="preferredDate" type="date" min={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="svc-form-full">
            <span>Anything else we should know? <small>(optional)</small></span>
            <textarea name="notes" rows={4} maxLength={500} placeholder="Describe the issue, tyre size, unusual sound, or any other useful detail." />
          </label>
          <label className="svc-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <div className="svc-form-full svc-form-feedback" aria-live="polite">
            {error && <p role="alert">{error}</p>}
          </div>
          <button className="svc-submit svc-form-full" disabled={saving}>
            {saving ? "Saving your request..." : "Submit & continue to WhatsApp →"}
          </button>
          <small className="svc-form-note svc-form-full">WhatsApp will open with your request details prefilled for +254 720 831 601.</small>
        </form>
      </section>
    </main>
  );
}
