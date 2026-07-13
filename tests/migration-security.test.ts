import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/202607130001_auth_profiles_roles.sql"),
  "utf8",
);

describe("migración de autenticación", () => {
  it("activa RLS en todas las tablas de Etapa 1", () => {
    for (const table of ["roles", "profiles", "audit_logs"]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });

  it("no crea políticas universales", () => {
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("protege al último administrador y niega borrado de perfiles", () => {
    expect(migration).toContain("último administrador activo");
    expect(migration).toContain(
      "revoke all on table public.profiles from anon, authenticated",
    );
    expect(migration).not.toMatch(/create policy[\s\S]*profiles[\s\S]*for delete/i);
  });

  it("fija search_path vacío en funciones security definer", () => {
    const securityDefiners = migration.split("security definer").slice(1);
    expect(securityDefiners.length).toBeGreaterThanOrEqual(8);
    securityDefiners.forEach((definition) => {
      expect(definition.slice(0, 120)).toContain("set search_path = ''");
    });
  });
});
