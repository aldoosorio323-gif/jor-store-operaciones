import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(path.resolve("src/app/actions/sales.ts"), "utf8");
const forms = readFileSync(path.resolve("src/components/sales/sales-forms.tsx"), "utf8");
const nav = readFileSync(path.resolve("src/features/catalogs/permissions.ts"), "utf8");

describe("fronteras de ventas", () => {
  it("autoriza en servidor y exige fila en updates", () => {
    expect(actions).toContain("getCurrentUserContext");
    expect(actions.match(/\.select\("id/g)?.length).toBeGreaterThanOrEqual(4);
    expect(actions.match(/\.single\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("consulta duplicados mediante una RPC sin leer clientes directamente", () => {
    const body = actions.slice(actions.indexOf("checkCustomerDuplicatesAction"), actions.indexOf("saveCustomerAction"));
    expect(body).toContain('rpc("check_customer_duplicate_candidates"');
    expect(body).not.toContain('.from("customers")');
  });

  it("confirma operaciones destructivas y solicita los datos requeridos", () => {
    expect(forms).toContain("¿Cancelar el pedido y liberar sus reservas?");
    expect(forms).toContain("¿Registrar la devolución en la ubicación seleccionada?");
    expect(forms).toContain("¿Registrar este reembolso sin modificar el pago original?");
    expect(forms).toContain('aria-label="Ubicación de devolución"');
    expect(forms).toContain("Descuento (máximo: subtotal)");
    expect(actions).toContain("El descuento no puede superar el subtotal de la línea.");
  });

  it("no usa service role y conserva la navegación", () => {
    expect(actions).not.toMatch(/service[_-]?role/i);
    for (const value of ["Clientes", "Pedidos", "Pagos"]) expect(nav).toContain(value);
  });
});
