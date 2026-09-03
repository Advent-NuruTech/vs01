"use client";

import type { CartLine } from "./domain";

const CART_KEY = "vitour-xpress.cart.v1";
let cache: CartLine[] | undefined;

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  try { cache = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as CartLine[]; } catch { cache = []; }
  return cache;
}

export function writeCart(lines: CartLine[]) {
  cache = lines;
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("vitour-cart-change"));
}

export function subscribeToCart(callback: () => void) {
  const handler = () => { cache = undefined; callback(); };
  window.addEventListener("vitour-cart-change", handler);
  window.addEventListener("storage", handler);
  return () => { window.removeEventListener("vitour-cart-change", handler); window.removeEventListener("storage", handler); };
}

export const emptyCart = () => [] as CartLine[];

export function addCartLine(line: CartLine) {
  const lines = readCart();
  const existing = lines.find((item) => item.productId === line.productId);
  writeCart(existing ? lines.map((item) => item.productId === line.productId ? { ...item, quantity: item.quantity + line.quantity } : item) : [...lines, line]);
}
