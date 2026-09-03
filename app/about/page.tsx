import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="about-page">
      <Link href="/">← Vitour Xpress</Link>
      <div>
        <Image
          src="/images/ceo.webp"
          alt="Raphael Okumu Opany, CEO of Vitour Xpress"
          width={600}
          height={500}
          priority
        />
        <section>
          <p className="eyebrow">ABOUT OUR CEO</p>
          <h1>Raphael Okumu Opany</h1>
          <p>
            Raphael Okumu Opany is an experienced sales and operations
            professional with a Bachelor&apos;s Degree in Business Administration
            from Gulu University. He brings extensive experience in management,
            sales, transport, and the tyre industry.
          </p>
          <p>
            He has worked with reputable organizations including City Tyres
            Uganda, Sameer Africa, and Kingsway Tyres Kenya, serving in various
            management roles. He also served as an external directing staff
            member at the Kenya Defence Forces School of Transport (SOT),
            Kahawa Barracks, where he participated in training activities.
          </p>
          <p>
            With strong industry experience, leadership skills, and a solid
            business background, Raphael brings valuable expertise to Vitour
            Xpress and is well positioned to support its growth and operational
            excellence.
          </p>
        </section>
      </div>
    </main>
  );
}
