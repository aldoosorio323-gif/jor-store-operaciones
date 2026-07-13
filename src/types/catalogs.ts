import type { Json, LocationType } from "@/types/database";

export const CATALOG_PAGE_SIZE = 20;

export type CatalogFilters = {
  page: number;
  query: string;
  status: "active" | "inactive" | "all";
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type ProductListItem = {
  id: string; name: string; brand: string | null; category: string | null;
  unitCode: string; isActive: boolean;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
};

export type ProductVariant = {
  id: string; productId: string; sku: string; name: string; color: string | null;
  attributes: Json; barcode: string | null; salePrice: number; isActive: boolean;
};

export type WarehouseListItem = {
  id: string; code: string; name: string; description: string | null;
  address: string | null; isActive: boolean;
};

export type WarehouseLocation = {
  id: string; warehouseId: string; code: string; name: string;
  locationType: LocationType; isActive: boolean;
};

export type SupplierListItem = {
  id: string; code: string; businessName: string; taxId: string | null;
  contactName: string | null; email: string | null; phone: string | null;
  notes: string | null; isActive: boolean;
};
