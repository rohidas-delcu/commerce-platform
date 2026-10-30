export type StoreStatus = "DRAFT" | "PUBLISHED";
export type ProductStatus = "DRAFT" | "ACTIVE";
export type InventoryReason = "STOCK_COUNT" | "RECEIVED" | "DAMAGED" | "RETURNED" | "OTHER";

export interface Store {
  id: string;
  ownerSubjectId: string;
  name: string;
  handle: string;
  countryCode: string;
  currencyCode: string;
  status: StoreStatus;
  createdAt: string;
}

export interface Variant {
  id: string;
  name: string;
  sku: string;
  stock: number;
}

export interface Product {
  version: number;
  id: string;
  storeId: string;
  name: string;
  handle: string;
  description: string;
  collection: string;
  priceMinor: string;
  compareMinor: string | null;
  status: ProductStatus;
  variants: Variant[];
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  storeId: string;
  variantId: string;
  before: number;
  after: number;
  delta: number;
  reason: InventoryReason;
  note: string;
  actorSubjectId: string;
  createdAt: string;
}

export class DomainError extends Error {
  readonly code: "INVALID" | "CONFLICT" | "NOT_FOUND" | "FORBIDDEN";
  constructor(code: "INVALID" | "CONFLICT" | "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function normalizeHandle(input: string): string {
  const handle = input.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) || handle.length > 63) {
    throw new DomainError("INVALID", "Use a 1–63 character handle with lowercase letters, digits and hyphens.");
  }
  return handle;
}

export function normalizeSku(input: string): string {
  const sku = input.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,80}$/.test(sku)) {
    throw new DomainError("INVALID", "SKU must have 2–80 letters, numbers, underscores or hyphens.");
  }
  return sku;
}

export function normalizeMoneyMinor(value: string, label = "Price"): string {
  if (typeof value !== "string" || !/^[0-9]{1,18}$/.test(value) || BigInt(value) <= 0n) {
    throw new DomainError("INVALID", `${label} must be a positive integer amount in minor units.`);
  }
  return BigInt(value).toString();
}

export function validateProductInput(input: {
  name: string;
  handle: string;
  priceMinor: string;
  compareMinor?: string | null;
  variants: Array<{ name: string; sku: string; stock: number }>;
}) {
  if (!input.name.trim() || input.name.trim().length > 150) throw new DomainError("INVALID", "Product name is required (up to 150 characters).");
  const handle = normalizeHandle(input.handle);
  const priceMinor = normalizeMoneyMinor(input.priceMinor);
  const compareMinor = input.compareMinor ? normalizeMoneyMinor(input.compareMinor, "Compare price") : null;
  if (compareMinor && BigInt(compareMinor) <= BigInt(priceMinor)) throw new DomainError("INVALID", "Compare price must exceed selling price.");
  if (!input.variants.length || input.variants.length > 100) throw new DomainError("INVALID", "A product requires 1–100 variants.");
  const names = new Set<string>(), skus = new Set<string>();
  const variants = input.variants.map(v => {
    const name = v.name.trim();
    const sku = normalizeSku(v.sku);
    if (!name || name.length > 100) throw new DomainError("INVALID", "Every variant needs a name of at most 100 characters.");
    if (!Number.isSafeInteger(v.stock) || v.stock < 0 || v.stock > 2_000_000_000) throw new DomainError("INVALID", "Stock must be a non-negative integer.");
    if (names.has(name.toLowerCase()) || skus.has(sku)) throw new DomainError("CONFLICT", "Variant names and SKUs must be unique within a product.");
    names.add(name.toLowerCase()); skus.add(sku);
    return { name, sku, stock: v.stock };
  });
  return { name: input.name.trim(), handle, priceMinor, compareMinor, variants };
}

export function checkedStockChange(before: number, after: number, reason: string): number {
  if (!Number.isSafeInteger(before) || before < 0 || before > 2_000_000_000 || !Number.isSafeInteger(after) || after < 0 || after > 2_000_000_000) {
    throw new DomainError("INVALID", "Stock must be a non-negative integer.");
  }
  if (before === after) throw new DomainError("INVALID", "Inventory is unchanged.");
  if (!["STOCK_COUNT", "RECEIVED", "DAMAGED", "RETURNED", "OTHER"].includes(reason)) {
    throw new DomainError("INVALID", "A recognized stock adjustment reason is required.");
  }
  return after - before;
}
