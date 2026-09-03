import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Raphael Okumu Opany | CEO of Vitour Xpress",
  description:
    "Meet Raphael Okumu Opany, an experienced sales and operations professional and CEO of Vitour Xpress.",
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <Link href="/">← Vitour Xpress</Link>
      <div>
        <div style={{ position: "relative", width: "100%", height: 440 }}>
          <Image
            src="/images/ceo.webp"
            alt="Raphael Okumu Opany, CEO of Vitour Xpress"
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            style={{ objectFit: "contain", background: "#fff" }}
            priority
          />
        </div>
        <section>
          <p className="eyebrow">ABOUT OUR CEO</p>
          <h1>Raphael Okumu Opany</h1>
          <p>
            Raphael Okumu Opany is an experienced sales and operations
            professional with a <strong>Bachelor&apos;s Degree in Business
            Administration from Gulu University</strong>. He brings extensive
            experience in management, sales, transport, and the tyre industry.
          </p>
          <p>
            He has worked with reputable organizations including <strong>City
            Tyres Uganda, Sameer Africa, and Kingsway Tyres Kenya</strong>,
            serving in various management roles. He also served as an external
            directing staff member at the <strong>Kenya Defence Forces School
            of Transport (SOT), Kahawa Barracks</strong>, where he participated
            in training activities.
          </p>
          <p>
            With strong industry experience, leadership skills, and a solid
            business background, Raphael brings valuable expertise to Vitour
            Xpress and is well positioned to support its growth and operational
            excellence.
          </p>
          <div className="ceo-contact">
            <span>Contact Raphael</span>
            <a href="mailto:rafopany@gmail.com">rafopany@gmail.com</a>
          </div>
        </section>
      </div>
    </main>
  );
}
