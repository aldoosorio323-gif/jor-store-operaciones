import type { InventoryFilters } from "@/types/inventory";
import { inventoryFiltersSchema } from "@/validations/inventory";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function parseInventoryFilters(searchParams: SearchParams): InventoryFilters {
  const parsed = inventoryFiltersSchema.safeParse({
    page: first(searchParams.page) ?? 1,
    query: first(searchParams.query) ?? "",
    status: first(searchParams.status) ?? "all",
    supplierId: first(searchParams.supplierId) ?? "",
    warehouseId: first(searchParams.warehouseId) ?? "",
    locationId: first(searchParams.locationId) ?? "",
    variantId: first(searchParams.variantId) ?? "",
    movementType: first(searchParams.movementType) ?? "",
    positiveOnly: first(searchParams.positiveOnly) ?? false,
    dateFrom: first(searchParams.dateFrom) ?? "",
    dateTo: first(searchParams.dateTo) ?? "",
  });
  return parsed.success ? parsed.data : {
    page: 1, query: "", status: "all", supplierId: "", warehouseId: "", locationId: "",
    variantId: "", movementType: "", positiveOnly: false, dateFrom: "", dateTo: "",
  };
}
