import { describe, expect, it } from "vitest";
import { formatDateTimeLocalInLima, limaDateTimeLocalToUtc } from "@/features/inventory/lima-time";

describe("fechas operativas en America/Lima", () => {
  it("convierte una hora local de Lima al instante UTC exacto", () => {
    expect(limaDateTimeLocalToUtc("2026-07-13T20:00")).toBe("2026-07-14T01:00:00.000Z");
    expect(limaDateTimeLocalToUtc("2026-01-13T00:15")).toBe("2026-01-13T05:15:00.000Z");
  });

  it("presenta instantes UTC como valores datetime-local de Lima", () => {
    expect(formatDateTimeLocalInLima("2026-07-14T01:00:00.000Z")).toBe("2026-07-13T20:00");
    expect(formatDateTimeLocalInLima("2026-01-13T05:15:00.000Z")).toBe("2026-01-13T00:15");
  });

  it("rechaza fechas locales inexistentes o ambiguas para el formato", () => {
    expect(limaDateTimeLocalToUtc("2026-02-30T20:00")).toBeNull();
    expect(limaDateTimeLocalToUtc("2026-07-13T24:00")).toBeNull();
    expect(limaDateTimeLocalToUtc("2026-07-13T20:00Z")).toBeNull();
    expect(formatDateTimeLocalInLima("fecha-inválida")).toBeNull();
  });
});
