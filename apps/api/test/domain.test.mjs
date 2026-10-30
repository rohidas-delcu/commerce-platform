import assert from "node:assert/strict";
import test from "node:test";
import {
  DomainError, checkedStockChange, normalizeHandle, normalizeMoneyMinor,
  normalizeSku, validateProductInput
} from "../src/domain/commerce.ts";

function validProduct() {
  return { name: "  Everyday backpack  ", handle: "everyday-backpack", priceMinor: "199900",
    compareMinor: "249900", variants: [{ name: "Black", sku: "bag-001", stock: 10 }] };
}

test("normalizes handles and rejects invalid navigation handles", () => {
  assert.equal(normalizeHandle(" Northline-Goods "), "northline-goods");
  for (const bad of ["../admin", "a--b", "a b", "école", "a_b"]) {
    assert.throws(() => normalizeHandle(bad), DomainError);
  }
});

test("prices remain exact strings of minor currency units", () => {
  assert.equal(normalizeMoneyMinor("000199900"), "199900");
  for (const bad of ["0", "-20", "19.99", "3e4", "9999999999999999999"]) {
    assert.throws(() => normalizeMoneyMinor(bad), DomainError);
  }
});

test("product validation enforces merchant SKU and pricing invariants", () => {
  const product = validateProductInput(validProduct());
  assert.equal(product.name, "Everyday backpack");
  assert.equal(product.variants[0].sku, "BAG-001");
  assert.equal(normalizeSku(" sku-a1 "), "SKU-A1");
  assert.throws(() => validateProductInput({ ...validProduct(), compareMinor: "99900" }), DomainError);
  assert.throws(() => validateProductInput({ ...validProduct(), variants: [] }), DomainError);
  assert.throws(() => validateProductInput({ ...validProduct(), variants: [
    { name: "Black", sku: "SKU-1", stock: 2 }, { name: "White", sku: "sku-1", stock: 3 }
  ] }), DomainError);
  assert.throws(() => validateProductInput({ ...validProduct(), variants: [
    { name: "Black", sku: "SKU-1", stock: -1 }
  ] }), DomainError);
});

test("stock changes validate reasons, bounds and no-op movements", () => {
  assert.equal(checkedStockChange(10, 15, "RECEIVED"), 5);
  assert.equal(checkedStockChange(10, 2, "DAMAGED"), -8);
  assert.throws(() => checkedStockChange(-1, 10, "RECEIVED"), DomainError);
  assert.throws(() => checkedStockChange(2_000_000_001, 10, "DAMAGED"), DomainError);
  assert.throws(() => checkedStockChange(10, 10, "STOCK_COUNT"), DomainError);
  assert.throws(() => checkedStockChange(10, -1, "OTHER"), DomainError);
  assert.throws(() => checkedStockChange(10, 11, "NOT_ALLOWED"), DomainError);
  assert.throws(() => checkedStockChange(10, 11.5, "RETURNED"), DomainError);
});
