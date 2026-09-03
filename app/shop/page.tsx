import Image from "next/image";
import Link from "next/link";
import { CatalogCards } from "@/components/catalog-cards";

export default function ShopPage() {
  return <main className="shop-page"><header className="shop-header"><Link href="/"><Image src="/images/logo-transparent.png" width={165} height={88} alt="Vitour Xpress" /></Link><nav><Link href="/">Home</Link><Link href="/services">Services</Link><Link href="/cart">Basket</Link></nav></header><section className="shop-hero"><p className="eyebrow">THE VITOUR XPRESS CATALOGUE</p><h1>Find the right tyre for your road.</h1><p>Browse live inventory. Size, availability, and online prices update directly from our catalogue.</p></section><section className="shop-content"><aside><b>Filter tyres</b><label>Tyre size<input placeholder="e.g. 205/55 R16" /></label><label>Brand<select><option>All brands</option></select></label><label>Vehicle<select><option>All vehicles</option></select></label><label>Availability<select><option>In stock</option></select></label></aside><div><div className="shop-result-title"><h2>All products</h2><span>Live stock</span></div><CatalogCards /></div></section></main>;
}
