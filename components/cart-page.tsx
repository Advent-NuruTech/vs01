"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary provides the responsive delivery transform. */

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { emptyCart, readCart, subscribeToCart, writeCart } from "@/lib/cart";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export function CartPage() {
  const lines = useSyncExternalStore(subscribeToCart, readCart, emptyCart);
  const subtotal = useMemo(() => lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0), [lines]);
  const changeQuantity = (productId: string, quantity: number) => { const next = quantity < 1 ? lines.filter((line) => line.productId !== productId) : lines.map((line) => line.productId === productId ? { ...line, quantity } : line); writeCart(next); };
  return <main className="commerce-page"><div className="commerce-header"><Link href="/"><Image src="/images/logo.webp" alt="Vitour Xpress" width={155} height={82} /></Link><Link href="/shop">← Continue shopping</Link></div><section className="commerce-content"><div><p className="eyebrow">YOUR SELECTION</p><h1>Your tyre basket</h1>{!lines.length ? <div className="commerce-empty"><h2>Your basket is empty.</h2><p>Browse our catalogue to add tyres, accessories, and workshop items.</p><Link className="button button-blue" href="/shop">Shop tyres</Link></div> : <div className="cart-lines">{lines.map((line) => <article key={line.productId}><div className="cart-thumb">{line.imageUrl ? <img src={line.imageUrl} alt="" /> : "VX"}</div><div><small>{line.sku}{line.tyreSize ? ` · ${line.tyreSize}` : ""}</small><h2>{line.name}</h2><b>{money(line.unitPrice)}</b></div><div className="quantity"><button onClick={() => changeQuantity(line.productId, line.quantity - 1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.productId, line.quantity + 1)} aria-label="Increase quantity">+</button></div><strong>{money(line.unitPrice * line.quantity)}</strong><button className="remove-line" onClick={() => changeQuantity(line.productId, 0)}>Remove</button></article>)}</div>}</div>{lines.length > 0 && <aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Fitting & delivery</span><span>Selected at checkout</span></div><hr /><div className="summary-total"><span>Total</span><b>{money(subtotal)}</b></div><Link className="button button-red" href="/checkout">Secure checkout <span>→</span></Link><p>Payment on pickup, cash, or M-Pesa confirmation.</p></aside>}</section></main>;
}
