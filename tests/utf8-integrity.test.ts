import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const textExtensions = new Set([".css", ".json", ".md", ".sql", ".ts", ".tsx", ".yml", ".yaml"]);
const suspiciousCharacters = [0x00c3, 0x00c2, 0xfffd].map((codePoint) => String.fromCodePoint(codePoint));

function collectTextFiles(target: string): string[] {
  const absolute = path.resolve(target);
  const entries = readdirSync(absolute, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith(".") ? [] : collectTextFiles(child);
    return entry.isFile() && textExtensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

describe("integridad UTF-8 del repositorio", () => {
  it("no contiene patrones típicos de mojibake en archivos de texto", () => {
    const files = [path.resolve("README.md"), ...["docs", "src", "supabase", "tests"].flatMap(collectTextFiles)];
    const affected = files
      .filter((file) => suspiciousCharacters.some((character) => readFileSync(file, "utf8").includes(character)))
      .map((file) => path.relative(process.cwd(), file));
    expect(affected).toEqual([]);
  });
});
