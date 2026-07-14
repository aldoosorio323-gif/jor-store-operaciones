import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve("supabase/migrations/202607130004_purchases_inventory.sql"), "utf8");
const sqlChecks = readFileSync(path.resolve("supabase/tests/rls_inventory.sql"), "utf8");
const tables = ["purchases", "purchase_items", "inventory_balances", "inventory_movements", "inventory_transfers", "inventory_transfer_items"];

describe("migraciÃ³n de compras e inventario", () => {
  it("crea tipos, tablas, RLS y ninguna polÃ­tica DELETE universal", () => {
    for (const type of ["purchase_status", "transfer_status", "movement_type"]) expect(migration).toContain(`create type public.${type}`);
    for (const table of tables) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).not.toMatch(new RegExp(`create policy[\\s\\S]{0,180}on public\\.${table}[\\s\\S]{0,100}for delete`, "i"));
    }
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/grant[^;]*delete/i);
    for (const forbidden of ["sale_reservation", "sale_dispatch", "reservation_release", "customer_return"]) expect(migration).not.toContain(`'${forbidden}'`);
  });

  it("impide escrituras directas de balance y mantiene movimientos append-only", () => {
    expect(migration).toContain("revoke all on table public.purchases, public.purchase_items, public.inventory_balances");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)[^;]*inventory_balances/i);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)[^;]*inventory_movements/i);
    expect(migration).toContain("inventory_movements_reject_update");
    expect(migration).toContain("inventory_movements_reject_delete");
    expect(migration).toContain("Los movimientos de inventario son inmutables");
  });

  it("centraliza balance y movimiento con bloqueo, versiÃ³n y promedio ponderado", () => {
    const body = migration.match(/create or replace function private\.apply_inventory_movement\([\s\S]*?\n\$\$;/)?.[0] ?? "";
    expect(body).toContain("for update");
    expect(body).toContain("version = version + 1");
    expect(body).toContain("insert into public.inventory_movements");
    expect(body).toContain("balance_row.physical_stock * balance_row.average_unit_cost");
    expect(body).toContain("round(");
    expect(body).toContain("resulting_physical < balance_row.reserved_stock");
    expect(body).toContain("p_movement_type = 'initial_stock'");
    expect(body).toContain("select 1 from public.inventory_movements");
    expect(migration).toContain("revoke all on function private.apply_inventory_movement");
  });

  it("protege cantidades, unicidad, referencias y granularidad", () => {
    for (const fragment of [
      "purchase_items_received_range", "inventory_balances_stocks_valid",
      "inventory_balances_granularity_unique", "inventory_movements_physical_equation",
      "inventory_movements_reserved_equation", "inventory_movements_reference_valid",
      "inventory_movements_idempotency_unique_idx", "warehouse_locations_warehouse_id_id_unique",
    ]) expect(migration).toContain(fragment);
    expect(migration).toContain("reserved_delta = 0");
  });

  it("implementa RPC crÃ­ticas, estados cerrados y congelamiento", () => {
    for (const rpc of [
      "confirm_purchase", "receive_purchase_item", "confirm_inventory_transfer",
      "dispatch_inventory_transfer", "receive_inventory_transfer_item", "adjust_inventory",
      "admin_inventory_reconciliation",
    ]) expect(migration).toContain(`function public.${rpc}`);
    expect(migration).toContain("Una compra confirmada no admite cambios comerciales");
    expect(migration).toContain("Las lÃ­neas de una compra confirmada estÃ¡n congeladas");
    expect(migration).toContain("Una transferencia confirmada no admite cambios comerciales");
    expect(migration).toContain("Retira o actualiza las lÃ­neas antes de cambiar los almacenes");
    expect(migration).toContain("order by i.origin_location_id, i.variant_id, i.id");
  });

  it("hace idempotentes recepciones, despachos y ajustes sin filtrar claves a auditorÃ­a", () => {
    expect(migration).toContain("private.inventory_commands");
    expect(migration).toContain("payload_hash");
    expect(migration).toContain("extensions.digest(p_payload::text, 'sha256')");
    expect(migration).toContain("La clave de idempotencia ya fue utilizada con otros datos");
    const auditInserts = migration.match(/insert into public\.audit_logs[\s\S]{0,500}?;/g) ?? [];
    for (const insert of auditInserts) expect(insert).not.toContain("p_idempotency_key");
  });

  it("aplica permisos operativos y reserva ajustes/conciliaciÃ³n al administrador", () => {
    expect(migration).toContain("current_user_role()) in ('administrator', 'operator')");
    expect(migration).toContain("private.assert_inventory_operator(true)");
    expect(migration).toContain("inventory_balances_select_active_staff");
    expect(migration).toContain("inventory_movements_select_active_staff");
  });

  it("fija search_path seguro en todas las funciones security definer", () => {
    const definitions = migration.split("security definer").slice(1);
    expect(definitions.length).toBeGreaterThanOrEqual(20);
    for (const definition of definitions) expect(definition.slice(0, 100)).toContain("set search_path = ''");
  });

  it("incluye pruebas SQL ficticias, idempotencia, RLS y ROLLBACK", () => {
    for (const fragment of [
      "operator_id", "inactive_id", "set local role anon", "weighted_average_exact",
      "idempotent_replay", "destination_still_empty", "operator_adjustment",
      "direct_balance_update", "movement_delete", "admin_inventory_reconciliation",
      "multiline_rollback_complete", "one_transfer_out",
    ]) expect(sqlChecks).toContain(fragment);
    expect(sqlChecks).toContain("completamente fictici");
    expect(sqlChecks.toLowerCase()).toContain("rollback;");
  });
});
