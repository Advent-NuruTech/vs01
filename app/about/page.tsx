import Image from "next/image";
import Link from "next/link";
export default function AboutPage() { return <main className="about-page"><Link href="/">← Vitour Xpress</Link><div><Image src="/images/ceo.webp" alt="Vitour Xpress leadership" width={600} height={500} /><section><p className="eyebrow">THE TYRE EXPERTS</p><h1>Built on trust. Ready for the road.</h1><p>Vitour Xpress combines carefully selected tyres, practical technical knowledge, and a service-first approach to keep people and businesses moving.</p></section></div></main>; }
