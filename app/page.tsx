"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { CatalogCards } from "@/components/catalog-cards";
import { PublicNav } from "@/components/public-nav";

export default function Home() {
  const [query, setQuery] = useState("");
  const [finder, setFinder] = useState({ width: "205", profile: "55", rim: "16" });

  const findTyres = (event: FormEvent) => {
    event.preventDefault();
    setQuery(`${finder.width}/${finder.profile} R${finder.rim}`);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main>
      <div className="topbar"><div className="wrap topbar-inner"><span>Open today <strong>8:00 AM – 6:00 PM</strong></span><span className="top-contact">Need help? <a href="tel:+254700000000">+254 700 000 000</a></span></div></div>
      <PublicNav home />

      <section className="hero"><div className="hero-grid" /><div className="wrap hero-content"><div className="hero-copy"><p className="eyebrow light">VITOUR XPRESS · KENYA</p><h1>Drive with <strong>confidence.</strong></h1><p className="hero-text">Quality tyres, precision fitting and honest automotive care. Get road-ready with the experts who keep Kenya moving.</p><div className="hero-buttons"><a href="#shop" className="button button-red">Shop tyres <span>→</span></a><a href="#services" className="button button-ghost">Explore services</a></div><div className="trust-row"><div><b>10,000+</b><span>Tyres fitted</span></div><div><b>4.9 / 5</b><span>Customer rating</span></div><div><b>6 days</b><span>Here for you</span></div></div></div><div className="hero-visual"><div className="speed-ring ring-one" /><div className="speed-ring ring-two" /><div className="wheel"><div className="wheel-inner"><span /><span /><span /><span /><span /></div></div><div className="floating-card"><span className="check">✓</span><div><b>Fitted with care</b><small>Expert installation included</small></div></div></div></div></section>

      <section className="finder-section" id="tyre-finder"><div className="wrap finder-wrap"><div className="finder-title"><p className="eyebrow">FIND YOUR FIT</p><h2>What size tyre do you need?</h2></div><form className="finder-form" onSubmit={findTyres}><label>Width<select value={finder.width} onChange={(e) => setFinder({ ...finder, width: e.target.value })}><option>205</option><option>195</option><option>225</option><option>265</option></select></label><span className="slash">/</span><label>Profile<select value={finder.profile} onChange={(e) => setFinder({ ...finder, profile: e.target.value })}><option>55</option><option>65</option><option>45</option><option>70</option></select></label><label>Rim<select value={finder.rim} onChange={(e) => setFinder({ ...finder, rim: e.target.value })}><option>16</option><option>15</option><option>17</option><option>18</option></select></label><button className="find-button" type="submit">Find tyres <span>→</span></button></form><p className="finder-help">Not sure what fits? <a href="#contact">Talk to a tyre expert</a></p></div></section>

      <section className="section products" id="shop"><div className="wrap"><div className="section-heading"><div><p className="eyebrow">ROAD-TESTED QUALITY</p><h2>Tyres for every journey.</h2></div><Link className="text-link" href="/shop">View all tyres <span>→</span></Link></div>{query && <div className="search-result">Showing products closest to <b>{query}</b><button onClick={() => setQuery("")}>Clear</button></div>}<CatalogCards featured /></div></section>

      <section className="brand-strip"><div className="wrap"><p>Trusted tyre brands, fitted by experts</p><div className="brands"><b>VITOUR</b><b>MICHELIN</b><b>BRIDGESTONE</b><b>GOODYEAR</b><b>PIRELLI</b></div></div></section>

      <section className="section services" id="services"><div className="wrap services-layout"><div className="service-intro"><p className="eyebrow">BEYOND THE TYRE</p><h2>More miles. Less worry.</h2><p>From a quick puncture repair to wheel alignment, our workshop team brings the right equipment and real experience to every vehicle.</p><a href="#contact" className="button button-blue">Book a service <span>→</span></a></div><div className="service-list"><article><span className="service-icon">◉</span><div><h3>Tyre fitting</h3><p>Safe, precise fitting for a smoother drive.</p></div><span>→</span></article><article><span className="service-icon">◎</span><div><h3>Wheel balancing</h3><p>Reduce vibration and protect your tyres.</p></div><span>→</span></article><article><span className="service-icon">⌁</span><div><h3>Wheel alignment</h3><p>Stay steady, save fuel, extend tyre life.</p></div><span>→</span></article><article><span className="service-icon">✦</span><div><h3>Mechanical care</h3><p>Reliable servicing for the road ahead.</p></div><span>→</span></article></div></div></section>

      <section className="about" id="about"><div className="wrap about-grid"><div className="about-image"><Image src="/images/ceo.webp" alt="Vitour Xpress team leadership" fill sizes="(max-width: 720px) 100vw, 42vw" /><div className="experience"><b>Built on trust</b><span>Expert service, every time.</span></div></div><div className="about-copy"><p className="eyebrow">THE VITOUR XPRESS WAY</p><h2>We know that every journey matters.</h2><p>At Vitour Xpress, we make tyre buying simple and automotive care dependable. Whether you are driving to work, running a fleet, or heading out of town, our team is ready with the right advice and the right fit.</p><div className="benefits"><div><i>✓</i><span><b>Genuine quality</b>Products selected for safety and performance.</span></div><div><i>✓</i><span><b>Transparent advice</b>Clear prices and no confusing jargon.</span></div><div><i>✓</i><span><b>Skilled technicians</b>Careful work from people who know cars.</span></div></div><a href="#contact" className="text-link">Meet the team <span>→</span></a></div></div></section>

      <section className="cta"><div className="wrap cta-inner"><div><p className="eyebrow light">READY WHEN YOU ARE</p><h2>Let&apos;s get you road-ready.</h2><p>Find the perfect tyre or speak to an expert today.</p></div><div className="cta-buttons"><a href="#tyre-finder" className="button button-white">Find my tyres <span>→</span></a><a href="#contact" className="button button-ghost">Contact us</a></div></div></section>

      <footer id="contact"><div className="wrap footer-grid"><div className="footer-brand"><Image src="/images/logo.webp" alt="Vitour Xpress" width={210} height={110} /><p>The Tyre Experts. Quality tyres and professional automotive care for every road.</p></div><div><h3>Explore</h3><a href="#shop">Shop tyres</a><a href="#services">Services</a><a href="#about">About us</a><Link href="/customer">Customer portal</Link></div><div><h3>Visit us</h3><p>Along your road to better driving<br />Nairobi, Kenya</p><a href="tel:+254700000000">+254 700 000 000</a><a href="mailto:hello@vitourxpress.co.ke">hello@vitourxpress.co.ke</a></div><div><h3>Workshop hours</h3><p>Mon – Sat<br /><b>8:00 AM – 6:00 PM</b></p><p>Sunday<br /><b>Closed</b></p></div></div><div className="wrap footer-bottom"><span>© 2026 Vitour Xpress. All rights reserved.</span><span>Designed for the road ahead.</span></div></footer>
    </main>
  );
}
