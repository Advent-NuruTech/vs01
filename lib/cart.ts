"use client";

import type { CartLine } from "./domain";

const CART_KEY = "vitour-xpress.cart.v1";

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as CartLine[]; } catch { return []; }
}

export function writeCart(lines: CartLine[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("vitour-cart-change"));
}

export function addCartLine(line: CartLine) {
  const lines = readCart();
  const existing = lines.find((item) => item.productId === line.productId);
  writeCart(existing ? lines.map((item) => item.productId === line.productId ? { ...item, quantity: item.quantity + line.quantity } : item) : [...lines, line]);
}
