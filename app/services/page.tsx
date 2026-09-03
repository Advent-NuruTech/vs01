import Link from "next/link";

const services = [
  { name: "Tyre fitting", icon: "🔧", desc: "Expert fitting for all tyre brands and sizes with precision balancing included." },
  { name: "Puncture repair", icon: "🛡️", desc: "Fast, reliable puncture repairs to get you back on the road safely." },
  { name: "Wheel balancing", icon: "⚖️", desc: "Smooth rides guaranteed with our computerised wheel balancing system." },
  { name: "Wheel alignment", icon: "🎯", desc: "Laser-guided alignment for even tyre wear and optimal handling." },
  { name: "Brake service", icon: "🛑", desc: "Complete brake inspection, pad replacement, and fluid flush services." },
  { name: "Oil change", icon: "🛢️", desc: "Full synthetic or conventional oil change with filter replacement." },
  { name: "Diagnostics", icon: "🔍", desc: "Advanced OBD-II diagnostics to pinpoint engine and electrical issues." },
  { name: "Mechanical repairs", icon: "⚙️", desc: "Engine, suspension, and drivetrain repairs by certified technicians." },
];

export default function ServicesPage() {
  return (
    <main className="svc-page">
      <header className="svc-hero">
        <Link href="/" className="svc-back">← Vitour Xpress</Link>
        <p className="eyebrow light">WORKSHOP SERVICES</p>
        <h1>Precision care for every kilometre.</h1>
        <p className="svc-lead">
          Book a service with experienced technicians and receive a clear
          assessment before work begins.
        </p>
      </header>

      <section className="svc-grid-wrap">
        <div className="svc-grid">
          {services.map((s) => (
            <article key={s.name} className="svc-card">
              <div className="svc-card-icon">{s.icon}</div>
              <h2>{s.name}</h2>
              <p>{s.desc}</p>
              <a
                href={`mailto:hello@vitourxpress.co.ke?subject=Service booking – ${s.name}`}
                className="svc-card-link"
              >
                Book now <span>→</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="svc-cta">
        <h2>Not sure what you need?</h2>
        <p>Our team will inspect your vehicle and recommend the right service.</p>
        <a href="mailto:hello@vitourxpress.co.ke?subject=Vehicle inspection request" className="svc-cta-btn">
          Request an inspection →
        </a>
      </section>
    </main>
  );
}
