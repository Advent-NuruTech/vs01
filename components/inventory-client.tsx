"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded Cloudinary previews are displayed from runtime URLs. */

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/domain";
import { useStaffToken } from "./staff-gate";

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const MAX_PRODUCT_IMAGES = 8;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function InventoryClient() {
  const token = useStaffToken();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [inventoryError, setInventoryError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setInventoryError("Inventory is taking longer than expected to load. Please refresh the page.");
    }, 12_000);
    const stop = onSnapshot(query(collection(db, "products"), orderBy("name")), (snapshot) => {
      window.clearTimeout(timeout);
      setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product));
      setInventoryError("");
    }, () => {
      window.clearTimeout(timeout);
      setInventoryError("Unable to load inventory. Please refresh the page.");
    });

    return () => {
      window.clearTimeout(timeout);
      stop();
    };
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    setError("");
    setUploadStatus("");

    if (!token) {
      setError("Your staff session is not ready. Please sign in again before uploading.");
      input.value = "";
      return;
    }

    if (images.length + files.length > MAX_PRODUCT_IMAGES) {
      setError(`You can upload up to ${MAX_PRODUCT_IMAGES} product images.`);
      input.value = "";
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE);
    if (invalidFile) {
      setError(!invalidFile.type.startsWith("image/")
        ? `${invalidFile.name} is not an image.`
        : `${invalidFile.name} is larger than 10 MB.`);
      input.value = "";
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      const signature = await fetch("/api/cloudinary/signature", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "product" }) });
      const signed = await signature.json().catch(() => ({}));
      if (!signature.ok) { setError(signed.error ?? "Image upload is unavailable."); return; }

      for (const [index, file] of files.entries()) {
        setUploadStatus(`Uploading image ${index + 1} of ${files.length}...`);
        const data = new FormData();
        data.set("file", file);
        data.set("api_key", signed.apiKey);
        data.set("timestamp", String(signed.timestamp));
        data.set("folder", signed.folder);
        data.set("signature", signed.signature);
        const uploaded = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: "POST", body: data });
        const result = await uploaded.json().catch(() => ({}));
        if (!uploaded.ok || typeof result.secure_url !== "string") {
          throw new Error(result.error?.message ?? `${file.name} could not be uploaded.`);
        }
        uploadedUrls.push(result.secure_url);
      }

      setImages((current) => [...current, ...uploadedUrls]);
      setUploadStatus(`${uploadedUrls.length} image${uploadedUrls.length === 1 ? "" : "s"} uploaded successfully.`);
    } catch (uploadError) {
      if (uploadedUrls.length) {
        setImages((current) => [...current, ...uploadedUrls]);
        setUploadStatus(`${uploadedUrls.length} image${uploadedUrls.length === 1 ? "" : "s"} uploaded successfully before the upload stopped.`);
      } else {
        setUploadStatus("");
      }
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const removeImage = (url: string) => {
    setImages((current) => current.filter((image) => image !== url));
    setUploadStatus("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || uploading) return;
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const number = (key: string) => Number(data.get(key) || 0);
    const response = await fetch("/api/manage/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), sku: data.get("sku"), brand: data.get("brand"), category: data.get("category"), tyreSize: data.get("tyreSize") || undefined, tyreType: data.get("tyreType") || undefined, vehicleType: data.get("vehicleType") || undefined, costPrice: number("costPrice"), sellingPrice: number("sellingPrice"), onlinePrice: data.get("onlinePrice") ? number("onlinePrice") : undefined, reorderLevel: number("reorderLevel"), initialStock: number("initialStock"), imageUrls: images, featured: data.get("featured") === "on" }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error ?? "Could not save product.");
    event.currentTarget.reset();
    setImages([]);
    setUploadStatus("");
  };

  const inventoryMessage = inventoryError || (products === null ? "Loading inventory..." : !products.length ? "No products have been added yet." : "");

  return <div className="inventory-view">
    <section className="manager-panel">
      <div><p className="eyebrow">CATALOGUE CONTROL</p><h2>Add stock product</h2><p>Adding opening stock creates a permanent inventory movement. Uploaded images replace image placeholders immediately.</p></div>
      <form onSubmit={submit} className="inventory-form">
        <label>Product name<input name="name" required /></label><label>SKU<input name="sku" required /></label><label>Brand<input name="brand" required /></label>
        <label>Category<select name="category" defaultValue="TYRE"><option>TYRE</option><option>RIM</option><option>TUBE</option><option>VALVE</option><option>ACCESSORY</option><option>LUBRICANT</option><option>PART</option></select></label>
        <label>Tyre size <small>(optional)</small><input name="tyreSize" placeholder="205/55 R16" /></label><label>Type / vehicle <input name="tyreType" placeholder="SUV, all-season..." /></label>
        <label>Cost price<input name="costPrice" type="number" min="0" required /></label><label>Selling price<input name="sellingPrice" type="number" min="1" required /></label><label>Online price <small>(optional)</small><input name="onlinePrice" type="number" min="1" /></label>
        <label>Opening stock<input name="initialStock" type="number" min="0" required /></label><label>Reorder level<input name="reorderLevel" type="number" min="0" required /></label>
        <label className="image-upload">Product images<input type="file" accept="image/*" multiple onChange={upload} disabled={uploading || images.length >= MAX_PRODUCT_IMAGES} /><span>{images.length ? `${images.length} of ${MAX_PRODUCT_IMAGES} images ready` : "Upload up to 8 images (10 MB each)"}</span></label>
        {images.length > 0 && <div className="image-previews" aria-label="Uploaded product images">
          {images.map((url, index) => <figure key={url}>
            <img src={url} alt={`Product preview ${index + 1}`} />
            <button type="button" onClick={() => removeImage(url)} aria-label={`Remove product image ${index + 1}`}>Remove</button>
          </figure>)}
        </div>}
        {uploadStatus && <p className="image-upload-status" role="status">{uploadStatus}</p>}
        <label className="check-label"><input type="checkbox" name="featured" /> Feature on website</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-red" disabled={saving || uploading}>{saving ? "Saving..." : uploading ? "Uploading image..." : "Save product"}</button>
      </form>
    </section>
    <section className="inventory-table">
      <div className="table-heading"><h2>Live inventory</h2><span>{products === null ? "Loading..." : `${products.length} product(s)`}</span></div>
      {inventoryMessage && <p className="form-error" role={inventoryError ? "alert" : undefined}>{inventoryMessage}</p>}
      {products && products.length > 0 && <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Cost</th><th>Selling</th><th>Stock</th><th>Value</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b>{product.name}</b><small>{product.brand}{product.tyreSize ? ` - ${product.tyreSize}` : ""}</small></td><td>{product.sku}</td><td>{money(product.costPrice)}</td><td>{money(product.sellingPrice)}</td><td>{product.quantityInStock}</td><td>{money(product.quantityInStock * product.costPrice)}</td><td><span className={product.quantityInStock <= 0 ? "status out" : product.quantityInStock <= product.reorderLevel ? "status low" : "status in"}>{product.quantityInStock <= 0 ? "Out" : product.quantityInStock <= product.reorderLevel ? "Low" : "In stock"}</span></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
