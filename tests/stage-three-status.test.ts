import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "README.md", "docs/arquitectura.md", "docs/modelo-datos.md",
  "docs/plan-implementacion.md", "docs/seguridad.md", "docs/reglas-inventario.md",
].map((file) => ({ file, source: readFileSync(path.resolve(file), "utf8") }));

describe("estado documental de Etapa 3", () => {
  it("registra implementación local y migración 004 pendiente", () => {
    for (const { file, source } of files) {
      expect(source, file).toContain("004");
      expect(source, file).toMatch(/004[^\n]*(pendiente|aún no está aplicada)/i);
    }
  });

  it("declara límites de alcance y pruebas SQL no ejecutadas", () => {
    expect(files[0]?.source).toContain("No se implementaron devoluciones a proveedor, clientes, pedidos");
    expect(files[5]?.source).toContain("supplier_return");
    expect(files[5]?.source).toContain("No se ejecutó en remoto");
  });
});
