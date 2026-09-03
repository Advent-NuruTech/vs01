"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary provides the responsive delivery transform. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { addCartLine } from "@/lib/cart";
import { listenToFeaturedProducts, listenToProducts } from "@/lib/catalog";
import type { Product } from "@/lib/domain";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function ProductImage({ product }: { product: Product }) {
  const image = product.featuredImageUrl ?? product.imageUrls[0];
  return image ? <img src={image} alt={product.name} /> : <div className="catalog-image-placeholder" aria-label="Product image placeholder"><span>VX</span></div>;
}

export function CatalogCards({ featured = false }: { featured?: boolean }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setError("The catalogue is taking longer than expected to load."), 12_000);
    const onProducts = (nextProducts: Product[]) => {
      window.clearTimeout(timeout);
      setProducts(nextProducts);
      setError("");
    };
    const onError = () => {
      window.clearTimeout(timeout);
      setError("We could not load the catalogue.");
    };
    const stop = featured ? listenToFeaturedProducts(onProducts, onError) : listenToProducts(onProducts, onError);
    return () => {
      window.clearTimeout(timeout);
      stop();
    };
  }, [featured]);

  if (error) return <p className="catalog-message" role="alert">{error} Please try again shortly.</p>;
  if (!products) return <div className="catalog-grid">{Array.from({ length: 4 }, (_, index) => <div className="catalog-skeleton" key={index} />)}</div>;
  if (!products.length) return <div className="catalog-empty"><b>New stock is being added.</b><span>Our catalogue will appear here as products are uploaded.</span></div>;

  return <div className="catalog-grid">{products.map((product) => {
    const price = product.onlinePrice ?? product.sellingPrice;
    return <article className="catalog-card" key={product.id}><Link href={`/shop/${product.slug}`} className="catalog-image"><ProductImage product={product} />{product.tyreSize && <span>{product.tyreSize}</span>}</Link><div className="catalog-copy"><small>{product.brand} · {product.category}</small><Link href={`/shop/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.tyreType ?? product.vehicleType ?? "Available in store"}</p><div><b>{money(price)}</b><button onClick={() => addCartLine({ productId: product.id, name: product.name, slug: product.slug, sku: product.sku, tyreSize: product.tyreSize, unitPrice: price, quantity: 1, imageUrl: product.featuredImageUrl ?? product.imageUrls[0] })} aria-label={`Add ${product.name} to cart`}>+</button></div></div></article>;
  })}</div>;
}
