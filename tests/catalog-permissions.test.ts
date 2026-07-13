import { describe, expect, it } from "vitest";
import { canManageCatalogs, getPrivateNavigationItems } from "@/features/catalogs/permissions";
import { decideRouteAccess } from "@/lib/auth/access";

describe("permisos de catálogos", () => {
  it("reserva mutaciones y controles administrativos al administrador", () => {
    expect(canManageCatalogs("administrator")).toBe(true);
    expect(canManageCatalogs("operator")).toBe(false);
  });

  it("muestra catálogos a ambos roles y usuarios solo al administrador", () => {
    const operator = getPrivateNavigationItems("operator");
    const administrator = getPrivateNavigationItems("administrator");
    for (const href of ["/app/productos", "/app/almacenes", "/app/proveedores"]) {
      expect(operator.some((item) => item.href === href)).toBe(true);
      expect(administrator.some((item) => item.href === href)).toBe(true);
    }
    expect(operator.some((item) => item.href === "/app/usuarios")).toBe(false);
    expect(administrator.some((item) => item.href === "/app/usuarios")).toBe(true);
  });

  it("permite al operador activo entrar a rutas de consulta", () => {
    expect(decideRouteAccess("/app/productos", { authenticated: true, active: true, role: "operator" })).toEqual({ action: "allow" });
    expect(decideRouteAccess("/app/almacenes", { authenticated: true, active: true, role: "operator" })).toEqual({ action: "allow" });
    expect(decideRouteAccess("/app/proveedores", { authenticated: true, active: true, role: "operator" })).toEqual({ action: "allow" });
  });
});
