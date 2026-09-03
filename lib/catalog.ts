"use client";

import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
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
