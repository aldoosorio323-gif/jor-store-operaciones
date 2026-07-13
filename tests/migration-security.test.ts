import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/202607130001_auth_profiles_roles.sql"),
  "utf8",
);

function getFunctionBody(functionName: string): string {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = migration.match(
    new RegExp(
      `create or replace function ${escapedName}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
      "i",
    ),
  );

  expect(match, `No se encontró ${functionName}`).not.toBeNull();
  return match?.[1] ?? "";
}

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

  it("distingue la conexión original sin confiar en current_user", () => {
    const guard = getFunctionBody("private.protect_profile_write");

    expect(guard).toContain("session_user in ('postgres', 'supabase_admin')");
    expect(guard).not.toMatch(/\bif\s+current_user\b/i);
  });

  it("autoriza admin_update_profile solo a administradores activos", () => {
    const updateProfile = getFunctionBody("public.admin_update_profile");
    const currentRole = getFunctionBody("public.current_user_role");

    expect(updateProfile).toContain("actor_id is null");
    expect(updateProfile).toContain("not (select public.current_user_is_admin())");
    expect(currentRole).toContain("and p.is_active");
    expect(currentRole).toContain("and r.is_active");
  });
});
