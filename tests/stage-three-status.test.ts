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
      expect(source, file).not.toMatch(/Etapa 3[^.\n]*(implementada en código|no terminada)/i);
    }
  });

  it("mantiene pendiente solo la concurrencia real y no inicia Etapa 4", () => {
    for (const { file, source } of files) {
      expect(source, file).toMatch(/pruebas reales de concurrencia[^\n]*conexiones independientes[^\n]*continúan pendientes/i);
      expect(source, file).not.toMatch(/concurrencia real (?:fue |ha sido )?(?:ejecutada|aprobada|validada)/i);
      expect(source, file).toMatch(/Etapa 4[^\n]*todavía no ha sido iniciada/i);
    }
    expect(files[0]?.source).toContain("No se implementaron devoluciones a proveedor, clientes, pedidos");
    expect(files[5]?.source).toContain("supplier_return");
  });
});
