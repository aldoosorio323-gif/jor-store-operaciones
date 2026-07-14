import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve("supabase/migrations/202607130005_customers_orders_payments.sql"), "utf8");
const sql = readFileSync(path.resolve("supabase/tests/rls_sales.sql"), "utf8");

describe("migración de ventas", () => {
  it("es una única transacción y reemplaza movement_type de forma atómica", () => {
    expect(migration.match(/^begin;/gim)).toHaveLength(1);
    expect(migration.match(/^commit;/gim)).toHaveLength(1);
    expect(migration).toContain("rename to movement_type_stage_three");
    expect(migration).toContain("alter column movement_type type public.movement_type");
    expect(migration).toContain("drop type public.movement_type_stage_three");
    expect(migration).not.toMatch(/alter type public\.movement_type add value/i);
  });

  it("crea tablas con RLS y sin DELETE", () => {
    for (const table of ["customers", "orders", "order_items", "payments"]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/grant[^;]*delete/i);
  });

  it("protege el libro mayor y congela el costo de la venta", () => {
    for (const value of ["sale_reservation", "reservation_release", "sale_dispatch", "customer_return"]) {
      expect(migration).toContain(value);
    }
    expect(migration).toContain("unit_cost_snapshot numeric(14,4)");
    expect(migration).toContain("item.unit_cost_snapshot");
    expect(migration).toContain("app.order_confirmation");
    expect(migration).toContain("version=version+1");
    expect(migration).toContain("purchase_item_id is null");
    expect(migration).toContain("transfer_item_id is null");
  });

  it("endurece cancelación, vuelta a borrador y devolución", () => {
    expect(migration).toContain("dispatched_quantity>0");
    expect(migration).toContain("importe pagado pendiente de reembolso");
    expect(migration).toContain("status in ('pending','paid','refunded')");
    expect(migration).toContain("p_location_id uuid,p_quantity numeric");
    expect(migration).toContain("status not in ('shipped','delivered')");
    expect(migration).toContain("apply_sales_return_movement");
    expect(migration).toContain("returned_quantity<dispatched_quantity");
    expect(migration.lastIndexOf("drop function public.return_order_item(uuid,numeric,text,text)")).toBeGreaterThan(migration.lastIndexOf("create or replace function public.return_order_item(p_order_item_id uuid,p_quantity numeric"));
  });

  it("calcula el despacho parcial con cantidades ya persistidas", () => {
    const dispatch = migration.slice(migration.indexOf("function public.dispatch_order_item"), migration.indexOf("function public.dispatch_order(", migration.indexOf("function public.dispatch_order_item")));
    expect(dispatch).toContain("dispatched_quantity<quantity");
    expect(dispatch).not.toContain("dispatched_quantity+p_quantity<quantity");
    expect(dispatch).toContain("then next_status:='preparing'; else next_status:='shipped'");
    expect(dispatch).toContain("then now() else null");
    expect(dispatch).toContain("then actor else null");
    expect(dispatch).not.toContain("public.payments");
  });

  it("valida pagos pending contra estado y saldo bloqueado", () => {
    const prepare = migration.slice(migration.lastIndexOf("function private.prepare_payment"), migration.indexOf("function private.recalculate_order_payment", migration.lastIndexOf("function private.prepare_payment")));
    expect(prepare).toContain("select status,balance_due into order_state,available_balance");
    expect(prepare).toContain("for update");
    expect(prepare).toContain("order_state in ('cancelled','returned')");
    expect(prepare).toContain("new.amount>available_balance");
    expect(prepare).toContain("new.refunded_payment_id is null and new.status='pending'");
    const confirm = migration.slice(migration.indexOf("function public.confirm_payment"), migration.indexOf("function public.cancel_payment"));
    expect(confirm).toContain("select balance_due into available_balance");
    expect(confirm).toContain("for update");
    expect(confirm).toContain("payment.amount>available_balance");
  });

  it("limita el descuento al subtotal antes de impuestos", () => {
    expect(migration).toContain("constraint order_items_discount_within_subtotal check (discount_amount <= line_subtotal)");
    expect(migration).toContain("if new.discount_amount>expected_subtotal then");
    expect(migration).toContain("El descuento no puede superar el subtotal de la línea.");
  });

  it("modela reembolsos inmutables y saldo derivado", () => {
    expect(migration).toContain("refunded_payment_id uuid");
    expect(migration).toContain("payments_refund_same_order_fkey");
    expect(migration).toContain("payments_external_reference_unique_idx");
    expect(migration).toContain("balance_due numeric(14,2)");
    expect(migration).toContain("orders_balance_due_equation");
    expect(migration).toContain("Un pago procesado es inmutable");
    expect(migration).toContain("insert into public.payments(order_id,amount,method,status,refunded_payment_id");
    expect(migration.lastIndexOf("drop function public.refund_payment(uuid,text)")).toBeGreaterThan(migration.lastIndexOf("create or replace function public.refund_payment(p_payment_id uuid,p_idempotency_key text)"));
  });

  it("protege clientes, secuencias y conciliación", () => {
    expect(migration).toContain("customers_select_active_operator");
    expect(migration).toContain("and is_active");
    expect(migration).toContain("check_customer_duplicate_candidates");
    expect(migration).toContain("returns table(document_match boolean,email_match boolean,phone_match boolean,name_match boolean)");
    expect(migration).toContain("create sequence private.customer_code_seq");
    expect(migration).not.toMatch(/grant usage on sequence/i);
    for (const issue of ["net_paid_mismatch", "balance_due_mismatch", "payment_status_mismatch", "excess_refund", "cross_order_refund", "incompatible_refund_fields"]) {
      expect(migration).toContain(issue);
    }
  });

  it("mantiene pruebas SQL ficticias, transaccionales y de concurrencia documentada", () => {
    for (const scenario of ["single_line_partial_preparing", "single_line_complete_shipped", "two_lines_partial_preparing", "two_lines_complete_shipped", "dispatch_retry_idempotent", "pending_over_balance_rejected", "pending_edit_over_balance_rejected", "pending_cancelled_order_rejected", "pending_returned_order_rejected", "pending_equal_balance_allowed", "pending_partial_allowed", "pending_concurrency_overpayment_rejected", "pending_payment_concurrency_two_connections", "discount_above_subtotal_rejected", "discount_edit_rejected", "confirm_order_concurrency_two_connections"]) {
      expect(sql).toContain(scenario);
    }
    expect(sql.toLowerCase()).toContain("rollback;");
  });
});
