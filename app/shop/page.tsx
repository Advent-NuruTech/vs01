"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addCartLine } from "@/lib/cart";
import { listenToProducts } from "@/lib/catalog";
import type { Product } from "@/lib/domain";
import { PublicNav } from "@/components/public-nav";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function ProductImage({ product }: { product: Product }) {
  const image = product.featuredImageUrl ?? product.imageUrls[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={product.name} />
  ) : (
    <div className="catalog-image-placeholder" aria-label="Product image placeholder">
      <span>VX</span>
    </div>
  );
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [vehicle, setVehicle] = useState("All");
  const [availability, setAvailability] = useState("in-stock");

  useEffect(() => {
    const timeout = window.setTimeout(() => setError("The catalogue is taking longer than expected to load."), 12_000);
    const onProducts = (next: Product[]) => {
      window.clearTimeout(timeout);
      setProducts(next);
      setError("");
    };
    const onError = () => {
      window.clearTimeout(timeout);
      setError("We could not load the catalogue.");
    };
    const stop = listenToProducts(onProducts, onError);
    return () => { window.clearTimeout(timeout); stop(); };
  }, []);

  const brands = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
  }, [products]);

  const categories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }, [products]);

  const vehicleTypes = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map((p) => p.vehicleType).filter(Boolean))].sort();
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${p.name} ${p.brand} ${p.sku} ${p.tyreSize ?? ""} ${p.vehicleType ?? ""} ${p.tyreType ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (brand !== "All" && p.brand !== brand) return false;
      if (category !== "All" && p.category !== category) return false;
      if (vehicle !== "All" && p.vehicleType !== vehicle) return false;
      if (availability === "in-stock" && p.quantityInStock <= 0) return false;
      if (availability === "out-of-stock" && p.quantityInStock > 0) return false;
      return true;
    });
  }, [products, search, brand, category, vehicle, availability]);

  const resultCount = filtered?.length ?? 0;
  const activeFilters = (brand !== "All" ? 1 : 0) + (category !== "All" ? 1 : 0) + (vehicle !== "All" ? 1 : 0) + (availability !== "all" ? 1 : 0) + (search ? 1 : 0);

  return (
    <main className="shop-page">
      <PublicNav />

      <div className="shop-marquee"><div className="shop-marquee-track"><span>Find the right tyre for your road&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span><span>Find the right tyre for your road&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span><span>Find the right tyre for your road&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span><span>Find the right tyre for your road&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span></div></div>

      <section className="shop-content shop-content-full">
        <div className="shop-toolbar">
          <div className="shop-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" placeholder="Search tyres, brands, sizes..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="shop-search-clear" onClick={() => setSearch("")} aria-label="Clear search">&times;</button>}
          </div>
          <button className="shop-filter-icon" onClick={() => setFilterOpen(!filterOpen)} aria-label="Toggle filters">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </button>
        </div>

        {filterOpen && (
          <div className="shop-filter-drawer">
            <div className="shop-filter-drawer-header">
              <b>Filter tyres</b>
              <button onClick={() => setFilterOpen(false)} aria-label="Close filters">&times;</button>
            </div>
            <label>Brand
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option>All</option>
                {brands.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>All</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Vehicle type
              <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                <option>All</option>
                {vehicleTypes.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Availability
              <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option value="all">All</option>
                <option value="in-stock">In stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </label>
            {activeFilters > 0 && (
              <button className="shop-filter-clear" onClick={() => { setBrand("All"); setCategory("All"); setVehicle("All"); setAvailability("all"); setSearch(""); }}>Clear all filters</button>
            )}
          </div>
        )}

        <div>
          <div className="shop-result-title">
            <h2>{search || activeFilters > 0 ? "Filtered results" : "All products"}</h2>
            <span>{error ? "Error loading" : filtered ? `${resultCount} product${resultCount !== 1 ? "s" : ""}` : "Loading..."}</span>
          </div>

          {error && <p className="catalog-message" role="alert">{error} Please try again shortly.</p>}

          {!products && !error && (
            <div className="catalog-grid">{Array.from({ length: 8 }, (_, i) => <div className="catalog-skeleton" key={i} />)}</div>
          )}

          {products && filtered && filtered.length === 0 && (
            <div className="catalog-empty"><b>No products match your filters.</b><span>Try adjusting your search or filter criteria.</span></div>
          )}

          {filtered && filtered.length > 0 && (
            <div className="catalog-grid">
              {filtered.map((product) => {
                const price = product.onlinePrice ?? product.sellingPrice;
                return (
                  <article className="catalog-card" key={product.id}>
                    <Link href={`/shop/${product.slug}`} className="catalog-image">
                      <ProductImage product={product} />
                      {product.tyreSize && <span>{product.tyreSize}</span>}
                    </Link>
                    <div className="catalog-copy">
                      <small>{product.brand} &middot; {product.category}</small>
                      <Link href={`/shop/${product.slug}`}><h3>{product.name}</h3></Link>
                      <p>{product.tyreType ?? product.vehicleType ?? "Available in store"}</p>
                      <div>
                        <b>{money(price)}</b>
                        <button onClick={() => addCartLine({ productId: product.id, name: product.name, slug: product.slug, sku: product.sku, tyreSize: product.tyreSize, unitPrice: price, quantity: 1, imageUrl: product.featuredImageUrl ?? product.imageUrls[0] })} aria-label={`Add ${product.name} to cart`}>+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
