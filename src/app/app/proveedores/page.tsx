import Link from "next/link";
import { CatalogFiltersForm, EmptyState, Pagination, StatusBadge } from "@/components/catalogs/catalog-ui";
import { parseCatalogFilters } from "@/features/catalogs/filters";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { listSuppliers } from "@/services/catalogs";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser(); const isAdministrator = canManageCatalogs(user.role); const filters = parseCatalogFilters(await searchParams);
  let result; try { result = await listSuppliers(filters, isAdministrator); } catch { return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h1 className="text-2xl font-semibold">Proveedores</h1><p className="mt-2">No fue posible cargar el catálogo. Verifica la migración 003.</p></section>; }
  return <section><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">Proveedores</h1><p className="mt-2 text-neutral-600">Directorio privado para futuras operaciones de compra.</p></div>{isAdministrator ? <Link href="/app/proveedores/nuevo" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Crear proveedor</Link> : null}</div>
    <CatalogFiltersForm basePath="/app/proveedores" filters={filters} isAdministrator={isAdministrator} placeholder="Código o razón social" />
    {result.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{result.items.map((supplier) => <Link key={supplier.id} href={`/app/proveedores/${supplier.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">{supplier.code}</p><h2 className="mt-1 font-semibold">{supplier.businessName}</h2></div><StatusBadge active={supplier.isActive} /></div></Link>)}</div> : <EmptyState>No se encontraron proveedores con estos filtros.</EmptyState>}
    <Pagination basePath="/app/proveedores" page={result.page} pageCount={result.pageCount} query={filters.query} status={filters.status} />
  </section>;
}
