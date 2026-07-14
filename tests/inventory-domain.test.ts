import { describe, expect, it } from "vitest";
import {
  calculateWeightedAverage,
  canDispatchTransfer,
  canEditPurchase,
  canEditTransfer,
  canReceivePurchase,
  canReceiveTransfer,
} from "@/features/inventory/domain";

describe("reglas de dominio de inventario", () => {
  it("calcula promedio ponderado con redondeo exacto a cuatro decimales", () => {
    expect(calculateWeightedAverage(2, 10, 2, 14)).toBe(12);
    expect(calculateWeightedAverage(3, 10.1111, 2, 12.2222)).toBe(10.9555);
    expect(calculateWeightedAverage(0, 0, 5, 7.12346)).toBe(7.1235);
  });

  it("rechaza valores negativos o entradas vacías", () => {
    expect(() => calculateWeightedAverage(-1, 0, 1, 1)).toThrow();
    expect(() => calculateWeightedAverage(0, 0, 0, 1)).toThrow();
    expect(() => calculateWeightedAverage(1, 1, 1, -1)).toThrow();
  });

  it("mantiene cerradas las transiciones de compra y transferencia", () => {
    expect(canEditPurchase("draft")).toBe(true);
    expect(canEditPurchase("confirmed")).toBe(false);
    expect(canReceivePurchase("confirmed")).toBe(true);
    expect(canReceivePurchase("partially_received")).toBe(true);
    expect(canReceivePurchase("received")).toBe(false);
    expect(canEditTransfer("draft")).toBe(true);
    expect(canEditTransfer("in_transit")).toBe(false);
    expect(canDispatchTransfer("confirmed")).toBe(true);
    expect(canReceiveTransfer("in_transit")).toBe(true);
    expect(canReceiveTransfer("partially_received")).toBe(true);
  });
});
