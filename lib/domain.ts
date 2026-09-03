export type UserRole = "OWNER" | "ADMIN" | "CASHIER" | "STOCK_MANAGER" | "MECHANIC";
export type ProductCategory = "TYRE" | "RIM" | "TUBE" | "VALVE" | "ACCESSORY" | "LUBRICANT" | "PART";
export type StockMovementType = "OPENING_STOCK" | "PURCHASE" | "SALE" | "SALE_RETURN" | "CUSTOMER_RETURN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGED" | "TRANSFER_IN" | "TRANSFER_OUT";
export type PaymentMethod = "CASH" | "MPESA" | "CARD" | "BANK" | "CREDIT" | "MIXED" | "PAY_ON_PICKUP";

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  brand: string;
  model?: string;
  category: ProductCategory;
  description?: string;
  tyreSize?: string;
  width?: number;
  profile?: number;
  rimDiameter?: number;
  tyreType?: string;
  vehicleType?: string;
  loadIndex?: string;
  speedRating?: string;
  costPrice: number;
  sellingPrice: number;
  onlinePrice?: number;
  quantityInStock: number;
  reorderLevel: number;
  supplierId?: string;
  imageUrls: string[];
  featuredImageUrl?: string;
  active: boolean;
  featured: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CartLine = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  tyreSize?: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
};

export type SaleLineInput = { productId: string; quantity: number; actualSellingPrice: number };

export type SaleLineSnapshot = SaleLineInput & {
  productName: string;
  sku: string;
  tyreSize?: string;
  brand: string;
  standardPriceAtSale: number;
  unitCostAtSale: number;
  discountDifference: number;
  lineTotal: number;
  profitAtSale: number;
};
