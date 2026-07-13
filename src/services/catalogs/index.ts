import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  CATALOG_PAGE_SIZE,
  type CatalogFilters,
  type PaginatedResult,
  type ProductDetail,
  type ProductListItem,
  type ProductVariant,
  type SupplierListItem,
  type WarehouseListItem,
  type WarehouseLocation,
} from "@/types/catalogs";
import type { Json } from "@/types/database";

const safeSearch = (query: string) => query.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();

function normalizeFilters(filters: CatalogFilters, isAdministrator: boolean) {
  return {
    ...filters,
    status: isAdministrator ? filters.status : ("active" as const),
    from: (filters.page - 1) * CATALOG_PAGE_SIZE,
    to: filters.page * CATALOG_PAGE_SIZE - 1,
  };
}

function paginate<T>(items: T[], total: number, page: number): PaginatedResult<T> {
  return {
    items,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    total,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

export async function listProducts(
  filters: CatalogFilters,
  isAdministrator: boolean,
): Promise<PaginatedResult<ProductListItem>> {
  const supabase = await createClient();
  const normalized = normalizeFilters(filters, isAdministrator);
  const query = safeSearch(normalized.query);
  let productIds: string[] = [];

  if (query) {
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("product_id")
      .or(`sku.ilike.%${query}%,name.ilike.%${query}%,color.ilike.%${query}%`)
      .limit(200);
    if (variantsError) throw new Error("No fue posible buscar productos.");
    productIds = [...new Set(variants.map((variant) => variant.product_id))];
  }

  let request = supabase
    .from("products")
    .select("id, name, brand, category, unit_code, is_active", { count: "exact" });

  if (normalized.status !== "all") {
    request = request.eq("is_active", normalized.status === "active");
  }
  if (query) {
    const conditions = [
      `name.ilike.%${query}%`,
      `brand.ilike.%${query}%`,
      `category.ilike.%${query}%`,
    ];
    if (productIds.length) conditions.push(`id.in.(${productIds.join(",")})`);
    request = request.or(conditions.join(","));
  }

  const { data, error, count } = await request
    .order("name")
    .range(normalized.from, normalized.to);
  if (error) throw new Error("No fue posible cargar los productos.");

  return paginate(
    data.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      unitCode: product.unit_code,
      isActive: product.is_active,
    })),
    count ?? 0,
    normalized.page,
  );
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, brand, category, unit_code, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No fue posible cargar el producto.");
  return data
    ? {
        id: data.id,
        name: data.name,
        description: data.description,
        brand: data.brand,
        category: data.category,
        unitCode: data.unit_code,
        isActive: data.is_active,
      }
    : null;
}

export async function listProductVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, product_id, sku, name, color, attributes, barcode, sale_price, is_active")
    .eq("product_id", productId)
    .order("name")
    .limit(50);
  if (error) throw new Error("No fue posible cargar las variantes.");
  return data.map((variant) => ({
    id: variant.id,
    productId: variant.product_id,
    sku: variant.sku,
    name: variant.name,
    color: variant.color,
    attributes: variant.attributes as Json,
    barcode: variant.barcode,
    salePrice: variant.sale_price,
    isActive: variant.is_active,
  }));
}

export async function listWarehouses(
  filters: CatalogFilters,
  isAdministrator: boolean,
): Promise<PaginatedResult<WarehouseListItem>> {
  const supabase = await createClient();
  const normalized = normalizeFilters(filters, isAdministrator);
  const query = safeSearch(normalized.query);
  let request = supabase
    .from("warehouses")
    .select("id, code, name, description, address, is_active", { count: "exact" });
  if (normalized.status !== "all") request = request.eq("is_active", normalized.status === "active");
  if (query) request = request.or(`code.ilike.%${query}%,name.ilike.%${query}%`);

  const { data, error, count } = await request.order("name").range(normalized.from, normalized.to);
  if (error) throw new Error("No fue posible cargar los almacenes.");
  return paginate(
    data.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description,
      address: warehouse.address,
      isActive: warehouse.is_active,
    })),
    count ?? 0,
    normalized.page,
  );
}

export async function getWarehouse(id: string): Promise<WarehouseListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, description, address, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No fue posible cargar el almacén.");
  return data
    ? {
        id: data.id, code: data.code, name: data.name, description: data.description,
        address: data.address, isActive: data.is_active,
      }
    : null;
}

export async function listWarehouseLocations(warehouseId: string): Promise<WarehouseLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("id, warehouse_id, code, name, location_type, is_active")
    .eq("warehouse_id", warehouseId)
    .order("name")
    .limit(50);
  if (error) throw new Error("No fue posible cargar las ubicaciones.");
  return data.map((location) => ({
    id: location.id,
    warehouseId: location.warehouse_id,
    code: location.code,
    name: location.name,
    locationType: location.location_type,
    isActive: location.is_active,
  }));
}

export async function listSuppliers(
  filters: CatalogFilters,
  isAdministrator: boolean,
): Promise<PaginatedResult<SupplierListItem>> {
  const supabase = await createClient();
  const normalized = normalizeFilters(filters, isAdministrator);
  const query = safeSearch(normalized.query);
  let request = supabase
    .from("suppliers")
    .select("id, code, business_name, tax_id, contact_name, email, phone, notes, is_active", { count: "exact" });
  if (normalized.status !== "all") request = request.eq("is_active", normalized.status === "active");
  if (query) request = request.or(`code.ilike.%${query}%,business_name.ilike.%${query}%`);

  const { data, error, count } = await request.order("business_name").range(normalized.from, normalized.to);
  if (error) throw new Error("No fue posible cargar los proveedores.");
  return paginate(
    data.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      businessName: supplier.business_name,
      taxId: supplier.tax_id,
      contactName: supplier.contact_name,
      email: supplier.email,
      phone: supplier.phone,
      notes: supplier.notes,
      isActive: supplier.is_active,
    })),
    count ?? 0,
    normalized.page,
  );
}

export async function getSupplier(id: string): Promise<SupplierListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, code, business_name, tax_id, contact_name, email, phone, notes, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No fue posible cargar el proveedor.");
  return data
    ? {
        id: data.id, code: data.code, businessName: data.business_name,
        taxId: data.tax_id, contactName: data.contact_name, email: data.email,
        phone: data.phone, notes: data.notes, isActive: data.is_active,
      }
    : null;
}
