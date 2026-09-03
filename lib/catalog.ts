"use client";

import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Product } from "./domain";

export function listenToFeaturedProducts(callback: (products: Product[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, "products"), where("active", "==", true), where("featured", "==", true), orderBy("updatedAt", "desc"), limit(8)), (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product));
  }, onError);
}

export function listenToProducts(callback: (products: Product[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, "products"), where("active", "==", true), orderBy("name"), limit(48)), (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product));
  }, onError);
}

export async function fetchRelatedProducts(currentProduct: Product): Promise<Product[]> {
  const excludeId = currentProduct.id;
  const results: Product[] = [];
  const seen = new Set<string>([excludeId]);

  const catSnap = await getDocs(query(
    collection(db, "products"),
    where("active", "==", true),
    where("category", "==", currentProduct.category),
    limit(7),
  ));
  for (const doc of catSnap.docs) {
    const p = { id: doc.id, ...doc.data() } as Product;
    if (!seen.has(p.id)) { seen.add(p.id); results.push(p); }
  }

  if (results.length < 6 && currentProduct.brand) {
    const brandSnap = await getDocs(query(
      collection(db, "products"),
      where("active", "==", true),
      where("brand", "==", currentProduct.brand),
      limit(7),
    ));
    for (const doc of brandSnap.docs) {
      if (results.length >= 8) break;
      const p = { id: doc.id, ...doc.data() } as Product;
      if (!seen.has(p.id)) { seen.add(p.id); results.push(p); }
    }
  }

  return results.slice(0, 8);
}
