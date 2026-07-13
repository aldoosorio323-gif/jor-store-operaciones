import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(path.resolve("src/app/actions/catalogs.ts"), "utf8");
const forms = readFileSync(path.resolve("src/components/catalogs/catalog-forms.tsx"), "utf8");

function actionSource(name: string): string {
  const start = actions.indexOf(`export async function ${name}`);
  expect(start, `No se encontró ${name}`).toBeGreaterThanOrEqual(0);
  const next = actions.indexOf("\nexport async function ", start + 1);
  return actions.slice(start, next === -1 ? actions.length : next);
}

describe("integridad de mutaciones de catálogos", () => {
  it("no ofrece cambios de estado dentro de formularios y preserva el estado existente", () => {
    expect(forms).not.toContain('register("isActive")');
    for (const preservedState of [
      "product?.isActive ?? true",
      "variant?.isActive ?? true",
      "warehouse?.isActive ?? true",
      "location?.isActive ?? true",
      "supplier?.isActive ?? true",
    ]) {
      expect(forms).toContain(preservedState);
    }
  });

  it("mantiene confirmación explícita antes de desactivar", () => {
    expect(forms).toContain(
      'if (isActive && !window.confirm("¿Confirmas que deseas desactivar este registro?")) return;',
    );
    expect(forms).toContain("CatalogStatusButton");
  });

  it("omite is_active en ediciones normales y lo cambia solo en acciones específicas", () => {
    for (const name of [
      "saveProductAction",
      "saveVariantAction",
      "saveWarehouseAction",
      "saveLocationAction",
      "saveSupplierAction",
    ]) {
      const source = actionSource(name);
      const updateValues = source.match(/const updateValues = \{([\s\S]*?)\n    \};/)?.[1] ?? "";
      expect(updateValues, name).not.toContain("is_active");
      expect(source, name).toContain(".update(updateValues)");
    }

    const statusUpdates = actions.match(/\.update\(\{ is_active: parsed\.data\.isActive \}\)/g) ?? [];
    expect(statusUpdates).toHaveLength(5);
  });

  it("exige una fila en cada UPDATE y evita éxitos con cero filas", () => {
    for (const name of [
      "saveProductAction",
      "setProductStatusAction",
      "saveVariantAction",
      "setVariantStatusAction",
      "saveWarehouseAction",
      "setWarehouseStatusAction",
      "saveLocationAction",
      "setLocationStatusAction",
      "saveSupplierAction",
      "setSupplierStatusAction",
    ]) {
      const source = actionSource(name);
      expect(source, name).toContain(".select(");
      expect(source, name).toContain(".single()");
      expect(source, name).toContain("mutationMessage(");
    }
    expect(actions).toContain('error.code === "PGRST116"');
    expect(actions).toContain('return "Registro no encontrado o no autorizado.";');
  });
});
