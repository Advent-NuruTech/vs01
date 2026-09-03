"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary provides the responsive delivery transform. */

import Link from "next/link";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { addCartLine } from "@/lib/cart";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/domain";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined); const [quantity, setQuantity] = useState(1);
  useEffect(() => { getDocs(query(collection(db, "products"), where("slug", "==", slug), where("active", "==", true), limit(1))).then((snapshot) => setProduct(snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product))).catch(() => setProduct(null)); }, [slug]);
  if (product === undefined) return <main className="product-detail"><p>Loading product…</p></main>;
  if (!product) return <main className="product-detail"><h1>Product not found</h1><Link href="/shop">Return to catalogue</Link></main>;
  const price = product.onlinePrice ?? product.sellingPrice; const image = product.featuredImageUrl ?? product.imageUrls[0];
  return <main className="product-detail"><Link href="/shop">← Catalogue</Link><div className="product-detail-grid"><div className="product-gallery">{image ? <img src={image} alt={product.name} /> : <div className="catalog-image-placeholder"><span>VX</span></div>}</div><div><p className="eyebrow">{product.brand} · {product.category}</p><h1>{product.name}</h1>{product.tyreSize && <strong className="tyre-size">{product.tyreSize}</strong>}<p>{product.description ?? "Detailed product information will be available from Vitour Xpress."}</p><b className="detail-price">{money(price)}</b><p className={product.quantityInStock > 0 ? "availability" : "availability sold"}>{product.quantityInStock > 0 ? `${product.quantityInStock} available` : "Currently out of stock"}</p><div className="detail-actions"><input type="number" min="1" max={product.quantityInStock} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><button className="button button-red" disabled={!product.quantityInStock} onClick={() => addCartLine({ productId: product.id, name: product.name, slug: product.slug, sku: product.sku, tyreSize: product.tyreSize, unitPrice: price, quantity, imageUrl: image })}>Add to basket</button></div><dl>{product.loadIndex && <><dt>Load index</dt><dd>{product.loadIndex}</dd></>}{product.speedRating && <><dt>Speed rating</dt><dd>{product.speedRating}</dd></>}{product.tyreType && <><dt>Tyre type</dt><dd>{product.tyreType}</dd></>}{product.vehicleType && <><dt>Vehicle</dt><dd>{product.vehicleType}</dd></>}</dl><small>Fitting and delivery options are selected at checkout.</small></div></div></main>;
}
