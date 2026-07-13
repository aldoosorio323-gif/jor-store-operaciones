import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  productSchema,
  productVariantSchema,
  supplierSchema,
  warehouseLocationSchema,
  warehouseSchema,
} from "@/validations/catalogs";

describe("validaciones de catálogos", () => {
  it("normaliza SKU, códigos y cadenas opcionales", () => {
    const variant = productVariantSchema.parse({
      productId: randomUUID(), sku: "  sku-ficticio  ", name: " Variante ", color: " ",
      attributes: {}, barcode: "  BARRA-01  ", salePrice: 12.5, isActive: true,
    });
    const warehouse = warehouseSchema.parse({ code: "  alm-01 ", name: " Almacén ", description: "", address: "", isActive: true });
    expect(variant.sku).toBe("SKU-FICTICIO");
    expect(variant.color).toBeNull();
    expect(variant.barcode).toBe("BARRA-01");
    expect(warehouse.code).toBe("ALM-01");
    expect(warehouse.description).toBeNull();
  });

  it("rechaza precios negativos y atributos que no son objeto", () => {
    const base = { productId: randomUUID(), sku: "SKU-01", name: "Variante", barcode: "", color: "", isActive: true };
    expect(productVariantSchema.safeParse({ ...base, attributes: {}, salePrice: -0.01 }).success).toBe(false);
    expect(productVariantSchema.safeParse({ ...base, attributes: [], salePrice: 0 }).success).toBe(false);
  });

  it("acepta correo opcional válido y rechaza correo inválido", () => {
    const base = { code: "PROV-01", businessName: "Proveedor ficticio", taxId: "", contactName: "", phone: "", notes: "", isActive: true };
    expect(supplierSchema.parse({ ...base, email: "" }).email).toBeNull();
    expect(supplierSchema.safeParse({ ...base, email: "correo-invalido" }).success).toBe(false);
  });

  it("rechaza campos adicionales y relaciones inválidas", () => {
    expect(productSchema.safeParse({ name: "Producto", unitCode: "UND", isActive: true, createdBy: randomUUID() }).success).toBe(false);
    expect(warehouseLocationSchema.safeParse({ warehouseId: "no-es-uuid", code: "A", name: "A", locationType: "storage", isActive: true }).success).toBe(false);
  });
});
