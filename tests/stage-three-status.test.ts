import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "README.md", "docs/arquitectura.md", "docs/modelo-datos.md",
  "docs/plan-implementacion.md", "docs/seguridad.md", "docs/reglas-inventario.md",
].map((file) => ({ file, source: readFileSync(path.resolve(file), "utf8") }));

describe("estado documental de Etapa 3", () => {
  it("registra el cierre real y la migración 004 aplicada", () => {
    for (const { file, source } of files) {
      expect(source, file).toContain("004");
      expect(source, file).toMatch(/Etapa 3|Etapas 1, 2 y 3/i);
      expect(source, file).toMatch(/completad[ao]|validad[ao]s?/i);
      expect(source, file).toContain("Supabase real");
      expect(source, file).toMatch(/(?:migración\s+)?004[^\n]*aplicada[^\n]*(local y remotamente|local[^\n]*remot)/i);
      expect(source, file).not.toMatch(/migración\s+004[^.\n]*(pendiente|aún no está aplicada)/i);
      expect(source, file).not.toMatch(/004[^.\n]*aplicación remota[^.\n]*pendiente/i);
    }
  });

  it("mantiene el cierre de Etapa 3 durante la implementación de Etapa 4", () => {
    for (const { file, source } of files) {
      expect(source, file).toMatch(/(?:concurrencia real|pruebas reales de concurrencia)[^\n]*pendiente/i);
      expect(source, file).not.toMatch(/concurrencia real (?:fue |ha sido )?(?:ejecutada|aprobada|validada)/i);
      expect(source, file).toMatch(/Etapa 4[\s\S]{0,100}implementada en código/i);
    }
    expect(files[0]?.source).toContain("migración 005");
    expect(files[5]?.source).toContain("sale_reservation");
  });
});
