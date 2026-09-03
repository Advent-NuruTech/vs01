import Image from "next/image";
import Link from "next/link";

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <main className="success-page"><Image src="/images/logo.webp" alt="Vitour Xpress" width={190} height={100} /><div><span>✓</span><p className="eyebrow">ORDER RECEIVED</p><h1>Thank you. You&apos;re road-ready.</h1><p>Your order <b>{order ?? ""}</b> has been received. Our team will confirm the next step shortly.</p><Link className="button button-blue" href="/">Back to Vitour Xpress</Link></div></main>;
}
