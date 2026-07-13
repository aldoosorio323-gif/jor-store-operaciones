import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve("supabase/migrations/202607130003_catalogs.sql"), "utf8");
const sqlChecks = readFileSync(path.resolve("supabase/tests/rls_catalogs.sql"), "utf8");
const tables = ["products", "product_variants", "warehouses", "warehouse_locations", "suppliers"];

describe("migración de catálogos", () => {
  it("crea las tablas, activa RLS y no define políticas DELETE", () => {
    for (const table of tables) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).not.toMatch(new RegExp(`create policy[\\s\\S]{0,160}on public\\.${table}[\\s\\S]{0,100}for delete`, "i"));
    }
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/grant[^;]*delete/i);
  });

  it("separa lectura y escritura por rol y protege padres activos", () => {
    expect(migration).toContain("products_select_active_or_admin");
    expect(migration).toContain("products_insert_admin");
    expect(migration).toContain("products_update_admin");
    expect(migration).toContain("p.id = product_id and p.is_active");
    expect(migration).toContain("w.id = warehouse_id and w.is_active");
    expect(migration).toContain("current_user_is_admin()");
  });

  it("implementa unicidad, relaciones inmutables y bloqueo de desactivación", () => {
    for (const index of [
      "product_variants_sku_unique_idx", "product_variants_barcode_unique_idx",
      "warehouses_code_unique_idx", "warehouse_locations_code_unique_idx",
      "suppliers_code_unique_idx", "suppliers_tax_id_unique_idx",
    ]) expect(migration).toContain(`create unique index ${index}`);
    expect(migration).toContain("new.product_id is distinct from old.product_id");
    expect(migration).toContain("new.warehouse_id is distinct from old.warehouse_id");
    expect(migration).toContain("producto con variantes activas");
    expect(migration).toContain("almacén con ubicaciones activas");
  });

  it("protege el identificador estable de las cinco tablas", () => {
    const prepareWrite = migration.match(
      /create or replace function private\.prepare_catalog_write\(\)[\s\S]*?\$\$;\s*\n/,
    )?.[0] ?? "";
    expect(prepareWrite).toContain("new.id is distinct from old.id");
    expect(prepareWrite).toContain("No se puede cambiar el identificador del registro.");
    expect(prepareWrite).toContain("new.created_at := old.created_at");
    expect(prepareWrite).toContain("new.created_by := old.created_by");
    expect(prepareWrite).toContain("new.updated_at := now()");
    expect(prepareWrite).toContain("new.updated_by := actor_id");

    for (const table of tables) {
      expect(migration).toMatch(
        new RegExp(
          `create trigger [a-z_]+_prepare_write before insert or update on public\\.${table}\\s+for each row execute function private\\.prepare_catalog_write\\(\\)`,
        ),
      );
      expect(sqlChecks).toContain(`update public.${table} set id = gen_random_uuid()`);
    }
  });

  it("protege auditoría y registra todas las acciones solicitadas", () => {
    expect(migration).toContain("new.created_by := actor_id");
    expect(migration).toContain("new.updated_by := actor_id");
    expect(migration).toContain("private.audit_catalog_change");
    for (const prefix of ["product", "variant", "warehouse", "location", "supplier"]) {
      for (const suffix of ["created", "updated", "activated", "deactivated"]) {
        expect(migration).toContain(`'${prefix}_${suffix}'`);
      }
    }
    const auditBody = migration.match(/create or replace function private\.audit_catalog_change\(\)[\s\S]*?\$\$;\s*\n/)?.[0] ?? "";
    expect(auditBody).not.toContain("new.email");
    expect(auditBody).not.toContain("new.phone");
  });

  it("incluye verificaciones SQL reproducibles que siempre revierten", () => {
    for (const scenario of ["anon", "operator_id", "inactive_id", "SKU", "barcode", "tax_id", "product_id", "warehouse_id", "delete from"]) {
      expect(sqlChecks.toLowerCase()).toContain(scenario.toLowerCase());
    }
    expect(sqlChecks.trimEnd().toLowerCase()).toContain("rollback;");
  });
});
