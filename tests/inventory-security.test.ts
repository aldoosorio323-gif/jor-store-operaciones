import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPrivateNavigationItems } from "@/features/catalogs/permissions";
import { decideRouteAccess } from "@/lib/auth/access";

const actions = readFileSync(path.resolve("src/app/actions/inventory.ts"), "utf8");
const forms = readFileSync(path.resolve("src/components/inventory/inventory-forms.tsx"), "utf8");

describe("fronteras de seguridad de Etapa 3", () => {
  it("muestra operaciÃ³n a ambos roles y ajustes solo al administrador", () => {
    const operator = getPrivateNavigationItems("operator");
    const administrator = getPrivateNavigationItems("administrator");
    for (const href of ["/app/compras", "/app/inventario", "/app/transferencias"]) {
      expect(operator.some((item) => item.href === href)).toBe(true);
      expect(administrator.some((item) => item.href === href)).toBe(true);
    }
    expect(operator.some((item) => item.href === "/app/ajustes")).toBe(false);
    expect(administrator.some((item) => item.href === "/app/ajustes")).toBe(true);
    expect(decideRouteAccess("/app/ajustes", { authenticated: true, active: true, role: "operator" })).toEqual({ action: "redirect", destination: "/app" });
  });

  it("vuelve a autorizar en servidor y no usa service_role", () => {
    expect(actions).toContain("getCurrentUserContext");
    expect(actions).toContain("administratorOnly");
    expect(actions).toContain("createClient()");
    expect(actions).not.toContain("createAdminClient");
    expect(actions).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("usa RPC para cada transiciÃ³n crÃ­tica", () => {
    for (const rpc of [
      "confirm_purchase", "receive_purchase_item", "confirm_inventory_transfer",
      "dispatch_inventory_transfer", "receive_inventory_transfer_item", "adjust_inventory",
    ]) expect(actions).toContain(rpc);
    expect(actions).toContain("supabase.rpc(name");
  });

  it("exige una fila en mutaciones directas y no comunica Ã©xitos con cero filas", () => {
    expect(actions.match(/\.select\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(actions.match(/\.single\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(actions).toContain("Registro no encontrado o no autorizado.");
    expect(actions).toContain("error || !data");
  });

  it("no ofrece ediciÃ³n directa de stock y confirma acciones sensibles", () => {
    expect(forms).not.toContain('register("physicalStock")');
    expect(forms).not.toContain('register("reservedStock")');
    expect(forms).not.toContain('register("availableStock")');
    expect(forms).toContain("El saldo final no es editable");
    expect(forms.match(/window\.confirm/g)?.length).toBeGreaterThanOrEqual(8);
    expect(forms).toContain("useIdempotencyKey");
    expect(forms).toContain("crypto.randomUUID()");
  });
});
