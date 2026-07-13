import { describe, expect, it } from "vitest";
import { decideRouteAccess } from "@/lib/auth/access";

describe("protección de rutas", () => {
  it("envía al usuario anónimo al login", () => {
    expect(
      decideRouteAccess("/app", {
        authenticated: false,
        active: false,
        role: null,
      }),
    ).toEqual({ action: "redirect", destination: "/login?next=%2Fapp" });
  });

  it("bloquea una sesión desactivada", () => {
    expect(
      decideRouteAccess("/app/perfil", {
        authenticated: true,
        active: false,
        role: "operator",
      }),
    ).toEqual({ action: "redirect", destination: "/login?error=inactive" });
  });

  it("impide que el operador abra administración de usuarios", () => {
    expect(
      decideRouteAccess("/app/usuarios", {
        authenticated: true,
        active: true,
        role: "operator",
      }),
    ).toEqual({ action: "redirect", destination: "/app" });
  });

  it("permite administración a un administrador activo", () => {
    expect(
      decideRouteAccess("/app/usuarios", {
        authenticated: true,
        active: true,
        role: "administrator",
      }),
    ).toEqual({ action: "allow" });
  });
});
