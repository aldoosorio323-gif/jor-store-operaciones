import { describe, expect, it } from "vitest";
import {
  APP_CURRENCY,
  APP_TIMEZONE,
  calculateAvailableStock,
} from "@/lib/constants";

describe("configuración base de JOR Store", () => {
  it("usa PEN y America/Lima", () => {
    expect(APP_CURRENCY).toBe("PEN");
    expect(APP_TIMEZONE).toBe("America/Lima");
  });

  it("calcula stock disponible y rechaza valores negativos", () => {
    expect(calculateAvailableStock(12, 5)).toBe(7);
    expect(() => calculateAvailableStock(2, 3)).toThrow(RangeError);
  });
});
