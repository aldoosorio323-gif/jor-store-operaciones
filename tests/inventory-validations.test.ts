import { describe, expect, it } from "vitest";
import {
  idempotencyKeySchema,
  inventoryAdjustmentSchema,
  purchaseItemSchema,
  purchaseReceiptSchema,
  purchaseSchema,
  transferItemSchema,
  transferSchema,
} from "@/validations/inventory";

const idA = "00000000-0000-4000-8000-000000000101";
const idB = "00000000-0000-4000-8000-000000000102";
const idC = "00000000-0000-4000-8000-000000000103";

describe("validaciones de compras e inventario", () => {
  it("normaliza opcionales de compra y rechaza campos adicionales", () => {
    const value = purchaseSchema.parse({ supplierId: idA, supplierReference: "  ", orderedAt: "2026-07-13T10:00", expectedAt: "", notes: "" });
    expect(value.supplierReference).toBeNull();
    expect(value.expectedAt).toBeNull();
    expect(purchaseSchema.safeParse({ ...value, totalAmount: 99 }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...value, orderedAt: "2026-02-30T10:00" }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...value, orderedAt: "2026-07-13T10:00Z" }).success).toBe(false);
  });

  it("valida cantidades, costos e impuestos con su precisión", () => {
    const base = { purchaseId: idA, lineNumber: 1, variantId: idB, orderedQuantity: 1.125, unitCost: 10.1234, taxAmount: 1.25 };
    expect(purchaseItemSchema.safeParse(base).success).toBe(true);
    expect(purchaseItemSchema.safeParse({ ...base, orderedQuantity: 0 }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ ...base, unitCost: -1 }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ ...base, orderedQuantity: 1.0009 }).success).toBe(false);
  });

  it("exige una clave idempotente segura y cantidad positiva en recepción", () => {
    expect(idempotencyKeySchema.safeParse("idem-test-00000001").success).toBe(true);
    expect(idempotencyKeySchema.safeParse("corta").success).toBe(false);
    expect(purchaseReceiptSchema.safeParse({ purchaseItemId: idA, locationId: idB, quantity: 1, idempotencyKey: "idem-reception-0001" }).success).toBe(true);
    expect(purchaseReceiptSchema.safeParse({ purchaseItemId: idA, locationId: idB, quantity: -1, idempotencyKey: "idem-reception-0001" }).success).toBe(false);
  });

  it("exige almacenes y ubicaciones diferentes en transferencias", () => {
    expect(transferSchema.safeParse({ originWarehouseId: idA, destinationWarehouseId: idB, notes: "" }).success).toBe(true);
    expect(transferSchema.safeParse({ originWarehouseId: idA, destinationWarehouseId: idA, notes: "" }).success).toBe(false);
    const line = { transferId: idA, lineNumber: 1, variantId: idB, originLocationId: idB, destinationLocationId: idC, requestedQuantity: 1 };
    expect(transferItemSchema.safeParse(line).success).toBe(true);
    expect(transferItemSchema.safeParse({ ...line, destinationLocationId: idB }).success).toBe(false);
  });

  it("exige costo solo para entradas y razón para todo ajuste", () => {
    const base = { variantId: idA, locationId: idB, quantity: 1, reason: "Conteo ficticio", idempotencyKey: "idem-adjustment-0001" };
    expect(inventoryAdjustmentSchema.safeParse({ ...base, movementType: "positive_adjustment", unitCost: 3 }).success).toBe(true);
    expect(inventoryAdjustmentSchema.safeParse({ ...base, movementType: "positive_adjustment", unitCost: null }).success).toBe(false);
    expect(inventoryAdjustmentSchema.safeParse({ ...base, movementType: "negative_adjustment", unitCost: null }).success).toBe(true);
    expect(inventoryAdjustmentSchema.safeParse({ ...base, movementType: "lost", unitCost: null, reason: "" }).success).toBe(false);
  });
});
