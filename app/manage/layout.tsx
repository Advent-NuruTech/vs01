"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [["/manage", "Dashboard"], ["/manage/sell", "Sell / POS"], ["/manage/sales", "Sales History"], ["/manage/orders", "Orders"], ["/manage/inventory", "Inventory"], ["/manage/garage", "Services / Garage"], ["/manage/customers", "Customers"], ["/manage/purchases", "Purchases"], ["/manage/expenses", "Expenses"], ["/manage/finance", "Finance"], ["/manage/reports", "Reports"], ["/manage/settings", "Settings"]];

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return <div className="manage-shell">
    <aside className={menuOpen ? "open" : ""} aria-label="Operations navigation">
      <Link href="/" onClick={() => setMenuOpen(false)}><Image src="/images/logo-transparent.png" alt="Vitour Xpress" width={170} height={90} /></Link>
      <p>OPERATIONS</p>
      <nav>{links.map(([href, label]) => <Link className={path === href ? "active" : ""} href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>
    </aside>
    {menuOpen && <button className="manage-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close operations navigation" />}
    <main><header><button className="manage-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle operations navigation" aria-expanded={menuOpen}>{menuOpen ? "×" : "☰"}</button><div><small>VITOUR XPRESS</small><h1>Operations</h1></div><Link href="/">View website ↗</Link></header>{children}</main>
  </div>;
}
