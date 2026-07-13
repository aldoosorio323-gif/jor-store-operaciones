import { describe, expect, it } from "vitest";
import { getSafeInternalRedirect } from "@/lib/auth/redirects";

describe("redirecciones permitidas", () => {
  it("acepta solamente rutas internas conocidas", () => {
    expect(getSafeInternalRedirect("/app/perfil")).toBe("/app/perfil");
    expect(getSafeInternalRedirect("/reset-password?token=omitido")).toBe(
      "/reset-password",
    );
  });

  it("rechaza URLs externas y rutas no autorizadas", () => {
    expect(getSafeInternalRedirect("https://example.invalid/robo")).toBe("/app");
    expect(getSafeInternalRedirect("//example.invalid/robo")).toBe("/app");
    expect(getSafeInternalRedirect("/ruta-inexistente")).toBe("/app");
  });
});
