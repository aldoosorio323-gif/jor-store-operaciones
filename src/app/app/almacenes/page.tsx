import Link from "next/link";
import { CatalogFiltersForm, EmptyState, Pagination, StatusBadge } from "@/components/catalogs/catalog-ui";
import { parseCatalogFilters } from "@/features/catalogs/filters";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { listWarehouses } from "@/services/catalogs";

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  const isAdministrator = canManageCatalogs(user.role);
  const filters = parseCatalogFilters(await searchParams);
  let result;
  try { result = await listWarehouses(filters, isAdministrator); }
  catch { return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h1 className="text-2xl font-semibold">Almacenes</h1><p className="mt-2">No fue posible cargar el catálogo. Verifica la migración 003.</p></section>; }
  return <section><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">Almacenes</h1><p className="mt-2 text-neutral-600">Espacios operativos y ubicaciones internas.</p></div>{isAdministrator ? <Link href="/app/almacenes/nuevo" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Crear almacén</Link> : null}</div>
    <CatalogFiltersForm basePath="/app/almacenes" filters={filters} isAdministrator={isAdministrator} placeholder="Código o nombre" />
    {result.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{result.items.map((warehouse) => <Link key={warehouse.id} href={`/app/almacenes/${warehouse.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">{warehouse.code}</p><h2 className="mt-1 font-semibold">{warehouse.name}</h2></div><StatusBadge active={warehouse.isActive} /></div><p className="mt-3 line-clamp-2 text-sm text-neutral-600">{warehouse.description ?? "Sin descripción."}</p></Link>)}</div> : <EmptyState>No se encontraron almacenes con estos filtros.</EmptyState>}
    <Pagination basePath="/app/almacenes" page={result.page} pageCount={result.pageCount} query={filters.query} status={filters.status} />
  </section>;
}
