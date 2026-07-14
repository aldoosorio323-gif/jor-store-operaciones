import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MovementType, PurchaseStatus, TransferStatus } from "@/types/database";
import {
  INVENTORY_PAGE_SIZE,
  type InventoryBalanceItem,
  type InventoryFilters,
  type InventoryMovementItem,
  type LocationOption,
  type PageResult,
  type PurchaseDetail,
  type PurchaseItem,
  type PurchaseListItem,
  type SelectOption,
  type TransferDetail,
  type TransferItem,
  type TransferListItem,
} from "@/types/inventory";

const safeSearch = (value: string) => value.replace(/[^\p{L}\p{N}\s._-]/gu, " ").trim();
const range = (page: number) => ({ from: (page - 1) * INVENTORY_PAGE_SIZE, to: page * INVENTORY_PAGE_SIZE - 1 });
const unique = (values: string[]) => [...new Set(values)];
const pageResult = <T>(items: T[], total: number, page: number): PageResult<T> => ({
  items, page, pageSize: INVENTORY_PAGE_SIZE, total,
  pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
});

export async function listSupplierOptions(): Promise<SelectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("id, code, business_name")
    .eq("is_active", true).order("business_name").limit(200);
  if (error) throw new Error("No fue posible cargar los proveedores.");
  return data.map((item) => ({ id: item.id, label: `${item.code} · ${item.business_name}` }));
}

export async function listVariantOptions(): Promise<SelectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_variants").select("id, sku, name")
    .eq("is_active", true).order("sku").limit(300);
  if (error) throw new Error("No fue posible cargar las variantes.");
  return data.map((item) => ({ id: item.id, label: `${item.sku} · ${item.name}` }));
}

export async function listWarehouseOptions(): Promise<SelectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouses").select("id, code, name")
    .eq("is_active", true).order("name").limit(100);
  if (error) throw new Error("No fue posible cargar los almacenes.");
  return data.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));
}

export async function listLocationOptions(): Promise<LocationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouse_locations")
    .select("id, warehouse_id, code, name, location_type").eq("is_active", true).order("name").limit(300);
  if (error) throw new Error("No fue posible cargar las ubicaciones.");
  const warehouseIds = unique(data.map((item) => item.warehouse_id));
  const warehouses = warehouseIds.length
    ? await supabase.from("warehouses").select("id, code, name").in("id", warehouseIds)
    : { data: [], error: null };
  if (warehouses.error) throw new Error("No fue posible cargar las ubicaciones.");
  const warehouseLabels = new Map((warehouses.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  return data.map((item) => ({
    id: item.id, warehouseId: item.warehouse_id, locationType: item.location_type,
    label: `${warehouseLabels.get(item.warehouse_id) ?? "Almacén"} · ${item.code} · ${item.name}`,
  }));
}

export async function listPurchases(filters: InventoryFilters): Promise<PageResult<PurchaseListItem>> {
  const supabase = await createClient();
  const query = safeSearch(filters.query);
  const limits = range(filters.page);
  let request = supabase.from("purchases")
    .select("id, purchase_number, supplier_id, supplier_reference, status, ordered_at, total_amount", { count: "exact" });
  if (filters.status !== "all") request = request.eq("status", filters.status as PurchaseStatus);
  if (filters.supplierId) request = request.eq("supplier_id", filters.supplierId);
  if (query) request = request.or(`purchase_number.ilike.%${query}%,supplier_reference.ilike.%${query}%`);
  const { data, error, count } = await request.order("ordered_at", { ascending: false }).range(limits.from, limits.to);
  if (error) throw new Error("No fue posible cargar las compras.");
  const supplierIds = unique(data.map((item) => item.supplier_id));
  const suppliers = supplierIds.length
    ? await supabase.from("suppliers").select("id, business_name").in("id", supplierIds)
    : { data: [], error: null };
  if (suppliers.error) throw new Error("No fue posible cargar las compras.");
  const names = new Map((suppliers.data ?? []).map((item) => [item.id, item.business_name]));
  return pageResult(data.map((item) => ({
    id: item.id, purchaseNumber: item.purchase_number, supplierId: item.supplier_id,
    supplierName: names.get(item.supplier_id) ?? "Proveedor no disponible",
    supplierReference: item.supplier_reference, status: item.status, orderedAt: item.ordered_at,
    totalAmount: item.total_amount,
  })), count ?? 0, filters.page);
}

export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const supabase = await createClient();
  const { data: purchase, error } = await supabase.from("purchases")
    .select("id, purchase_number, supplier_id, supplier_reference, status, ordered_at, expected_at, confirmed_at, currency_code, subtotal, tax_amount, total_amount, notes")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("No fue posible cargar la compra.");
  if (!purchase) return null;
  const [{ data: supplier }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from("suppliers").select("business_name").eq("id", purchase.supplier_id).maybeSingle(),
    supabase.from("purchase_items")
      .select("id, purchase_id, line_number, variant_id, ordered_quantity, received_quantity, unit_cost, tax_amount, line_subtotal, line_total")
      .eq("purchase_id", id).order("line_number").limit(200),
  ]);
  if (rowsError) throw new Error("No fue posible cargar las líneas de compra.");
  const variantIds = unique(rows.map((item) => item.variant_id));
  const variants = variantIds.length
    ? await supabase.from("product_variants").select("id, sku, name").in("id", variantIds)
    : { data: [], error: null };
  if (variants.error) throw new Error("No fue posible cargar las variantes.");
  const labels = new Map((variants.data ?? []).map((item) => [item.id, `${item.sku} · ${item.name}`]));
  const items: PurchaseItem[] = rows.map((item) => ({
    id: item.id, purchaseId: item.purchase_id, lineNumber: item.line_number, variantId: item.variant_id,
    variantLabel: labels.get(item.variant_id) ?? "Variante no disponible",
    orderedQuantity: item.ordered_quantity, receivedQuantity: item.received_quantity,
    unitCost: item.unit_cost, taxAmount: item.tax_amount, lineSubtotal: item.line_subtotal, lineTotal: item.line_total,
  }));
  return {
    id: purchase.id, purchaseNumber: purchase.purchase_number, supplierId: purchase.supplier_id,
    supplierName: supplier?.business_name ?? "Proveedor no disponible", supplierReference: purchase.supplier_reference,
    status: purchase.status, orderedAt: purchase.ordered_at, expectedAt: purchase.expected_at,
    confirmedAt: purchase.confirmed_at, currencyCode: purchase.currency_code, subtotal: purchase.subtotal,
    taxAmount: purchase.tax_amount, totalAmount: purchase.total_amount, notes: purchase.notes, items,
  };
}

async function resolveInventorySearch(query: string) {
  const supabase = await createClient();
  const clean = safeSearch(query);
  if (!clean) return { variantIds: [] as string[], locationIds: [] as string[] };
  const [variantResult, productResult, locationResult] = await Promise.all([
    supabase.from("product_variants").select("id, product_id").or(`sku.ilike.%${clean}%,name.ilike.%${clean}%`).limit(300),
    supabase.from("products").select("id").ilike("name", `%${clean}%`).limit(200),
    supabase.from("warehouse_locations").select("id").or(`code.ilike.%${clean}%,name.ilike.%${clean}%`).limit(200),
  ]);
  if (variantResult.error || productResult.error || locationResult.error) throw new Error("No fue posible buscar inventario.");
  const productIds = productResult.data.map((item) => item.id);
  let variantsByProduct: { id: string }[] = [];
  if (productIds.length) {
    const result = await supabase.from("product_variants").select("id").in("product_id", productIds).limit(300);
    if (result.error) throw new Error("No fue posible buscar inventario.");
    variantsByProduct = result.data;
  }
  return {
    variantIds: unique([...variantResult.data.map((item) => item.id), ...variantsByProduct.map((item) => item.id)]),
    locationIds: locationResult.data.map((item) => item.id),
  };
}

export async function listInventoryBalances(filters: InventoryFilters): Promise<PageResult<InventoryBalanceItem>> {
  const supabase = await createClient();
  const limits = range(filters.page);
  const matches = await resolveInventorySearch(filters.query);
  if (filters.query && !matches.variantIds.length && !matches.locationIds.length) return pageResult([], 0, filters.page);
  let request = supabase.from("inventory_balances")
    .select("id, variant_id, warehouse_id, location_id, physical_stock, reserved_stock, available_stock, average_unit_cost, version", { count: "exact" });
  if (filters.warehouseId) request = request.eq("warehouse_id", filters.warehouseId);
  if (filters.locationId) request = request.eq("location_id", filters.locationId);
  if (filters.variantId) request = request.eq("variant_id", filters.variantId);
  if (filters.positiveOnly) request = request.gt("available_stock", 0);
  if (filters.query) {
    const conditions = [];
    if (matches.variantIds.length) conditions.push(`variant_id.in.(${matches.variantIds.join(",")})`);
    if (matches.locationIds.length) conditions.push(`location_id.in.(${matches.locationIds.join(",")})`);
    request = request.or(conditions.join(","));
  }
  const { data, error, count } = await request.order("updated_at", { ascending: false }).range(limits.from, limits.to);
  if (error) throw new Error("No fue posible cargar los balances.");
  return pageResult(await decorateBalances(data), count ?? 0, filters.page);
}

async function decorateBalances(rows: Array<{
  id: string; variant_id: string; warehouse_id: string; location_id: string; physical_stock: number;
  reserved_stock: number; available_stock: number; average_unit_cost: number; version: number;
}>): Promise<InventoryBalanceItem[]> {
  const supabase = await createClient();
  const [variants, warehouses, locations] = await Promise.all([
    rows.length ? supabase.from("product_variants").select("id, sku, name").in("id", unique(rows.map((item) => item.variant_id))) : Promise.resolve({ data: [], error: null }),
    rows.length ? supabase.from("warehouses").select("id, code, name").in("id", unique(rows.map((item) => item.warehouse_id))) : Promise.resolve({ data: [], error: null }),
    rows.length ? supabase.from("warehouse_locations").select("id, code, name").in("id", unique(rows.map((item) => item.location_id))) : Promise.resolve({ data: [], error: null }),
  ]);
  if (variants.error || warehouses.error || locations.error) throw new Error("No fue posible completar los balances.");
  const variantMap = new Map((variants.data ?? []).map((item) => [item.id, item]));
  const warehouseMap = new Map((warehouses.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  const locationMap = new Map((locations.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  return rows.map((item) => {
    const variant = variantMap.get(item.variant_id);
    return {
      id: item.id, variantId: item.variant_id, variantLabel: variant?.name ?? "Variante no disponible",
      sku: variant?.sku ?? "—", warehouseId: item.warehouse_id,
      warehouseLabel: warehouseMap.get(item.warehouse_id) ?? "Almacén no disponible",
      locationId: item.location_id, locationLabel: locationMap.get(item.location_id) ?? "Ubicación no disponible",
      physicalStock: item.physical_stock, reservedStock: item.reserved_stock,
      availableStock: item.available_stock, averageUnitCost: item.average_unit_cost, version: item.version,
    };
  });
}

export async function listInventoryMovements(filters: InventoryFilters): Promise<PageResult<InventoryMovementItem>> {
  const supabase = await createClient();
  const limits = range(filters.page);
  const matches = await resolveInventorySearch(filters.query);
  if (filters.query && !matches.variantIds.length && !matches.locationIds.length) return pageResult([], 0, filters.page);
  let request = supabase.from("inventory_movements")
    .select("id, movement_type, variant_id, warehouse_id, location_id, previous_physical, physical_delta, resulting_physical, previous_reserved, reserved_delta, resulting_reserved, unit_cost_snapshot, reason, occurred_at", { count: "exact" });
  if (filters.warehouseId) request = request.eq("warehouse_id", filters.warehouseId);
  if (filters.locationId) request = request.eq("location_id", filters.locationId);
  if (filters.variantId) request = request.eq("variant_id", filters.variantId);
  if (filters.movementType) request = request.eq("movement_type", filters.movementType as MovementType);
  if (filters.dateFrom) request = request.gte("occurred_at", `${filters.dateFrom}T00:00:00-05:00`);
  if (filters.dateTo) request = request.lte("occurred_at", `${filters.dateTo}T23:59:59-05:00`);
  if (filters.query) {
    const conditions = [];
    if (matches.variantIds.length) conditions.push(`variant_id.in.(${matches.variantIds.join(",")})`);
    if (matches.locationIds.length) conditions.push(`location_id.in.(${matches.locationIds.join(",")})`);
    request = request.or(conditions.join(","));
  }
  const { data, error, count } = await request.order("occurred_at", { ascending: false }).range(limits.from, limits.to);
  if (error) throw new Error("No fue posible cargar los movimientos.");
  const decorated = await decorateBalances(data.map((item) => ({
    id: item.id, variant_id: item.variant_id, warehouse_id: item.warehouse_id, location_id: item.location_id,
    physical_stock: item.resulting_physical, reserved_stock: item.resulting_reserved,
    available_stock: item.resulting_physical - item.resulting_reserved,
    average_unit_cost: item.unit_cost_snapshot, version: 0,
  })));
  const labels = new Map(decorated.map((item) => [item.id, item]));
  return pageResult(data.map((item) => {
    const label = labels.get(item.id);
    return {
      id: item.id, movementType: item.movement_type, variantLabel: label?.variantLabel ?? "—",
      sku: label?.sku ?? "—", warehouseLabel: label?.warehouseLabel ?? "—",
      locationLabel: label?.locationLabel ?? "—", previousPhysical: item.previous_physical,
      physicalDelta: item.physical_delta, resultingPhysical: item.resulting_physical,
      previousReserved: item.previous_reserved, reservedDelta: item.reserved_delta,
      resultingReserved: item.resulting_reserved, unitCostSnapshot: item.unit_cost_snapshot,
      reason: item.reason, occurredAt: item.occurred_at,
    };
  }), count ?? 0, filters.page);
}

export async function listTransfers(filters: InventoryFilters): Promise<PageResult<TransferListItem>> {
  const supabase = await createClient();
  const limits = range(filters.page);
  let request = supabase.from("inventory_transfers")
    .select("id, transfer_number, origin_warehouse_id, destination_warehouse_id, status, created_at", { count: "exact" });
  if (filters.status !== "all") request = request.eq("status", filters.status as TransferStatus);
  if (filters.warehouseId) request = request.or(`origin_warehouse_id.eq.${filters.warehouseId},destination_warehouse_id.eq.${filters.warehouseId}`);
  if (filters.query) request = request.ilike("transfer_number", `%${safeSearch(filters.query)}%`);
  const { data, error, count } = await request.order("created_at", { ascending: false }).range(limits.from, limits.to);
  if (error) throw new Error("No fue posible cargar las transferencias.");
  const ids = unique(data.flatMap((item) => [item.origin_warehouse_id, item.destination_warehouse_id]));
  const warehouses = ids.length ? await supabase.from("warehouses").select("id, code, name").in("id", ids) : { data: [], error: null };
  if (warehouses.error) throw new Error("No fue posible cargar las transferencias.");
  const names = new Map((warehouses.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  return pageResult(data.map((item) => ({
    id: item.id, transferNumber: item.transfer_number, originWarehouseId: item.origin_warehouse_id,
    originWarehouseName: names.get(item.origin_warehouse_id) ?? "—",
    destinationWarehouseId: item.destination_warehouse_id,
    destinationWarehouseName: names.get(item.destination_warehouse_id) ?? "—",
    status: item.status, createdAt: item.created_at,
  })), count ?? 0, filters.page);
}

export async function getTransfer(id: string): Promise<TransferDetail | null> {
  const supabase = await createClient();
  const { data: transfer, error } = await supabase.from("inventory_transfers")
    .select("id, transfer_number, origin_warehouse_id, destination_warehouse_id, status, confirmed_at, dispatched_at, received_at, notes, created_at")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("No fue posible cargar la transferencia.");
  if (!transfer) return null;
  const { data: rows, error: rowsError } = await supabase.from("inventory_transfer_items")
    .select("id, transfer_id, line_number, variant_id, origin_location_id, destination_location_id, requested_quantity, dispatched_quantity, received_quantity")
    .eq("transfer_id", id).order("line_number").limit(200);
  if (rowsError) throw new Error("No fue posible cargar las líneas de transferencia.");
  const [warehouses, variants, locations] = await Promise.all([
    supabase.from("warehouses").select("id, code, name").in("id", [transfer.origin_warehouse_id, transfer.destination_warehouse_id]),
    rows.length ? supabase.from("product_variants").select("id, sku, name").in("id", unique(rows.map((item) => item.variant_id))) : Promise.resolve({ data: [], error: null }),
    rows.length ? supabase.from("warehouse_locations").select("id, code, name").in("id", unique(rows.flatMap((item) => [item.origin_location_id, item.destination_location_id]))) : Promise.resolve({ data: [], error: null }),
  ]);
  if (warehouses.error || variants.error || locations.error) throw new Error("No fue posible completar la transferencia.");
  const warehouseMap = new Map((warehouses.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  const variantMap = new Map((variants.data ?? []).map((item) => [item.id, `${item.sku} · ${item.name}`]));
  const locationMap = new Map((locations.data ?? []).map((item) => [item.id, `${item.code} · ${item.name}`]));
  const items: TransferItem[] = rows.map((item) => ({
    id: item.id, transferId: item.transfer_id, lineNumber: item.line_number, variantId: item.variant_id,
    variantLabel: variantMap.get(item.variant_id) ?? "—", originLocationId: item.origin_location_id,
    originLocationName: locationMap.get(item.origin_location_id) ?? "—",
    destinationLocationId: item.destination_location_id,
    destinationLocationName: locationMap.get(item.destination_location_id) ?? "—",
    requestedQuantity: item.requested_quantity, dispatchedQuantity: item.dispatched_quantity,
    receivedQuantity: item.received_quantity,
  }));
  return {
    id: transfer.id, transferNumber: transfer.transfer_number,
    originWarehouseId: transfer.origin_warehouse_id,
    originWarehouseName: warehouseMap.get(transfer.origin_warehouse_id) ?? "—",
    destinationWarehouseId: transfer.destination_warehouse_id,
    destinationWarehouseName: warehouseMap.get(transfer.destination_warehouse_id) ?? "—",
    status: transfer.status, createdAt: transfer.created_at, confirmedAt: transfer.confirmed_at,
    dispatchedAt: transfer.dispatched_at, receivedAt: transfer.received_at, notes: transfer.notes, items,
  };
}
