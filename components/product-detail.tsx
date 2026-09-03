"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary provides the responsive delivery transform. */

import Link from "next/link";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { addCartLine, readCart } from "@/lib/cart";
import { fetchRelatedProducts } from "@/lib/catalog";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/domain";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<Product[]>([]);
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    getDocs(query(collection(db, "products"), where("slug", "==", slug), where("active", "==", true), limit(1)))
      .then((snapshot) => {
        if (snapshot.empty) { setProduct(null); return; }
        const p = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
        setProduct(p);
        fetchRelatedProducts(p).then(setRelated).catch(() => {});
      })
      .catch(() => setProduct(null));
  }, [slug]);

  const handleAdd = useCallback(() => {
    if (!product) return;
    const image = product.featuredImageUrl ?? product.imageUrls[0];
    addCartLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      tyreSize: product.tyreSize,
      unitPrice: product.onlinePrice ?? product.sellingPrice,
      quantity,
      imageUrl: image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [product, quantity]);

  useEffect(() => { setQuantity(1); setAdded(false); setImgIdx(0); }, [slug]);

  if (product === undefined) {
    return (
      <main className="pd-page">
        <div className="pd-loading">
          <div className="pd-skeleton-img" />
          <div style={{ flex: 1 }}>
            <div className="pd-skeleton-line w40" />
            <div className="pd-skeleton-line w80 h-lg" />
            <div className="pd-skeleton-line w60" />
            <div className="pd-skeleton-line w50" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="pd-page">
        <div className="pd-not-found">
          <span className="pd-nf-icon">!</span>
          <h1>Product not found</h1>
          <p>The product you are looking for may no longer be available.</p>
          <Link href="/shop" className="button button-red">Back to Shop</Link>
        </div>
      </main>
    );
  }

  const price = product.onlinePrice ?? product.sellingPrice;
  const images = product.imageUrls.length ? product.imageUrls : [];
  const currentImage = images[imgIdx] ?? product.featuredImageUrl ?? null;
  const inStock = product.quantityInStock > 0;
  const cartCount = readCart().reduce((n, l) => n + l.quantity, 0);

  return (
    <main className="pd-page">
      <div className="pd-top-bar">
        <Link href="/shop" className="pd-back">&larr; Shop</Link>
        <Link href="/cart" className="pd-cart-link">
          Cart {cartCount > 0 && <span className="pd-cart-badge">{cartCount}</span>}
        </Link>
      </div>

      <section className="pd-hero">
        <div className="pd-gallery">
          {currentImage
            ? <img src={currentImage} alt={product.name} className="pd-main-img" />
            : <div className="catalog-image-placeholder pd-placeholder"><span>VX</span></div>
          }
          {images.length > 1 && (
            <div className="pd-thumbs">
              {images.map((url, i) => (
                <button key={i} className={`pd-thumb ${i === imgIdx ? "active" : ""}`} onClick={() => setImgIdx(i)}>
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <span className="eyebrow">{product.brand} &middot; {product.category}</span>
          <h1 className="pd-name">{product.name}</h1>

          {product.tyreSize && <span className="pd-tyre-badge">{product.tyreSize}</span>}

          <p className="pd-desc">{product.description ?? "Premium quality product from Vitour Xpress. Visit us in-store or order online for fast delivery and professional fitting."}</p>

          <div className="pd-price-block">
            <span className="pd-price">{money(price)}</span>
            {inStock
              ? <span className="pd-stock in">{product.quantityInStock} in stock</span>
              : <span className="pd-stock out">Out of stock</span>
            }
          </div>

          {inStock && (
            <div className="pd-buy">
              <div className="pd-qty">
                <button className="pd-qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">&minus;</button>
                <input type="number" min="1" max={product.quantityInStock} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(product.quantityInStock, Number(e.target.value))))} aria-label="Quantity" />
                <button className="pd-qty-btn" onClick={() => setQuantity((q) => Math.min(product.quantityInStock, q + 1))} aria-label="Increase quantity">+</button>
              </div>
              <button className="button button-red pd-add-btn" onClick={handleAdd}>
                {added ? "Added!" : "Add to Cart"}
              </button>
            </div>
          )}

          <dl className="pd-specs">
            {product.loadIndex && <><dt>Load index</dt><dd>{product.loadIndex}</dd></>}
            {product.speedRating && <><dt>Speed rating</dt><dd>{product.speedRating}</dd></>}
            {product.tyreType && <><dt>Tyre type</dt><dd>{product.tyreType}</dd></>}
            {product.vehicleType && <><dt>Vehicle</dt><dd>{product.vehicleType}</dd></>}
          </dl>

          <p className="pd-note">Fitting and delivery options are selected at checkout.</p>
        </div>
      </section>

      {related.length > 0 && (
        <section className="pd-related">
          <div className="pd-related-head">
            <h2>You may also need</h2>
            <Link href="/shop" className="pd-view-all">View all &rarr;</Link>
          </div>
          <div className="pd-related-grid">
            {related.map((p) => {
              const rp = p.onlinePrice ?? p.sellingPrice;
              const img = p.featuredImageUrl ?? p.imageUrls[0];
              return (
                <Link href={`/shop/${p.slug}`} className="pd-rel-card" key={p.id}>
                  <div className="pd-rel-img">
                    {img ? <img src={img} alt={p.name} /> : <div className="catalog-image-placeholder pd-rel-ph"><span>VX</span></div>}
                  </div>
                  <div className="pd-rel-info">
                    <small>{p.brand} &middot; {p.category}</small>
                    <h3>{p.name}</h3>
                    <b>{money(rp)}</b>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {inStock && (
        <div className="pd-floating">
          <div className="pd-float-inner">
            <div className="pd-float-info">
              <span className="pd-float-name">{product.name}</span>
              <span className="pd-float-price">{money(price)}</span>
            </div>
            <div className="pd-float-actions">
              <button className="button button-red pd-float-add" onClick={handleAdd}>
                {added ? "Added!" : "Add to Cart"}
              </button>
              <Link href="/cart" className="button button-blue pd-float-checkout">
                Checkout {cartCount > 0 && `(${cartCount})`}
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
