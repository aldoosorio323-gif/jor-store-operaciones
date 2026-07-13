import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listSourceFiles(target) : [target];
  });
}

describe("frontera de secretos", () => {
  it("no referencia service role desde componentes cliente", () => {
    const clientFiles = listSourceFiles(path.resolve("src"))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => readFileSync(file, "utf8").startsWith('"use client"'));

    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("createAdminClient");
    }
  });

  it("mantiene el cliente administrativo como server-only", () => {
    const source = readFileSync(
      path.resolve("src/lib/supabase/admin.ts"),
      "utf8",
    );
    expect(source).toContain('import "server-only"');
  });
});
