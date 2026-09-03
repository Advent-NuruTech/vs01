"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["/manage", "Dashboard"], ["/manage/sell", "Sell / POS"], ["/manage/orders", "Orders"], ["/manage/inventory", "Inventory"], ["/manage/garage", "Services / Garage"], ["/manage/customers", "Customers"], ["/manage/purchases", "Purchases"], ["/manage/expenses", "Expenses"], ["/manage/finance", "Finance"], ["/manage/reports", "Reports"], ["/manage/settings", "Settings"]];
export default function ManageLayout({ children }: { children: React.ReactNode }) { const path = usePathname(); return <div className="manage-shell"><aside><Link href="/"><Image src="/images/logo.webp" alt="Vitour Xpress" width={170} height={90} /></Link><p>OPERATIONS</p><nav>{links.map(([href, label]) => <Link className={path === href ? "active" : ""} href={href} key={href}>{label}</Link>)}</nav></aside><main><header><div><small>VITOUR XPRESS</small><h1>Operations</h1></div><Link href="/">View website ↗</Link></header>{children}</main></div>; }
