import type { CatalogFilters } from "@/types/catalogs";
import { catalogFiltersSchema } from "@/validations/catalogs";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function parseCatalogFilters(searchParams: SearchParams): CatalogFilters {
  const parsed = catalogFiltersSchema.safeParse({
    page: first(searchParams.page) ?? 1,
    query: first(searchParams.query) ?? "",
    status: first(searchParams.status) ?? "active",
  });
  return parsed.success ? parsed.data : { page: 1, query: "", status: "active" };
}
