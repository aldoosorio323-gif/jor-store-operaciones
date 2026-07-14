import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const documentation = [
  "README.md",
  "docs/arquitectura.md",
  "docs/modelo-datos.md",
  "docs/plan-implementacion.md",
  "docs/seguridad.md",
].map((file) => ({
  file,
  source: readFileSync(path.resolve(file), "utf8"),
}));

describe("estado documental de Etapa 2", () => {
  it("registra la migración 003 aplicada y no conserva estados remotos pendientes", () => {
    for (const { file, source } of documentation) {
      expect(source, file).toContain("003");
      expect(source, file).not.toMatch(/migración\s+003\s+(pendiente|sin aplicar)/i);
    }

    expect(documentation[0]?.source).toContain("Etapa 3 completada y validada con Supabase real");
    expect(documentation[3]?.source).toContain(
      "completada y validada con Supabase real; migración 003 aplicada local y remotamente",
    );
  });
});
