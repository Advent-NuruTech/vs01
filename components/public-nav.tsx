"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCart } from "@/lib/cart";

function CartIcon({ count }: { count: number }) {
  return (
    <Link href="/cart" className="pn-cart" aria-label={`Cart (${count} items)`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {count > 0 && <span className="pn-cart-count">{count}</span>}
    </Link>
  );
}

export function PublicNav({ home = false }: { home?: boolean }) {
  const [cart, setCart] = useState(0);
  const [menu, setMenu] = useState(false);
  const cartQty = useMemo(() => cart, [cart]);

  useEffect(() => {
    const sync = () => setCart(readCart().reduce((n, l) => n + l.quantity, 0));
    sync();
    window.addEventListener("vitour-cart-change", sync);
    return () => window.removeEventListener("vitour-cart-change", sync);
  }, []);

  return (
    <header className="pn-header">
      <div className="pn-inner">
        <Link href="/" className="pn-logo" aria-label="Vitour Xpress home">
          <Image src="/images/logo-transparent.png" alt="Vitour Xpress" width={150} height={80} priority />
        </Link>

        <div className={menu ? "pn-backdrop open" : "pn-backdrop"} onClick={() => setMenu(false)} />
        <nav className={menu ? "pn-nav open" : "pn-nav"}>
          {home ? (
            <>
              <a href="#shop" onClick={() => setMenu(false)}>Shop tyres</a>
              <a href="#services" onClick={() => setMenu(false)}>Services</a>
              <a href="#about" onClick={() => setMenu(false)}>Our story</a>
              <a href="#contact" onClick={() => setMenu(false)}>Contact</a>
            </>
          ) : (
            <>
              <Link href="/" onClick={() => setMenu(false)}>Home</Link>
              <Link href="/shop" onClick={() => setMenu(false)}>Shop tyres</Link>
              <Link href="/services" onClick={() => setMenu(false)}>Services</Link>
            </>
          )}
        </nav>

        <div className="pn-actions">
          <CartIcon count={cartQty} />
          <button className="pn-menu-btn" onClick={() => setMenu(!menu)} aria-label="Toggle menu">
            {menu ? "\u00d7" : "\u2630"}
          </button>
        </div>
      </div>
    </header>
  );
}
