import Link from "next/link";
import { CatalogFiltersForm, EmptyState, Pagination, StatusBadge } from "@/components/catalogs/catalog-ui";
import { parseCatalogFilters } from "@/features/catalogs/filters";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { listProducts } from "@/services/catalogs";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  const isAdministrator = canManageCatalogs(user.role);
  const filters = parseCatalogFilters(await searchParams);
  let result;
  try { result = await listProducts(filters, isAdministrator); }
  catch {
    return <ErrorState title="Productos" />;
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-semibold text-emerald-950">Productos</h1><p className="mt-2 text-neutral-600">Productos comerciales y sus variantes vendibles.</p></div>
        {isAdministrator ? <Link href="/app/productos/nuevo" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Crear producto</Link> : null}
      </div>
      <CatalogFiltersForm basePath="/app/productos" filters={filters} isAdministrator={isAdministrator} placeholder="Nombre, SKU, marca, categoría o color" />
      {result.items.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {result.items.map((product) => (
            <Link key={product.id} href={`/app/productos/${product.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-emerald-300">
              <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-neutral-950">{product.name}</h2><StatusBadge active={product.isActive} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-neutral-500">Marca</dt><dd>{product.brand ?? "—"}</dd></div><div><dt className="text-neutral-500">Categoría</dt><dd>{product.category ?? "—"}</dd></div><div><dt className="text-neutral-500">Unidad</dt><dd>{product.unitCode}</dd></div></dl>
            </Link>
          ))}
        </div>
      ) : <EmptyState>No se encontraron productos con estos filtros.</EmptyState>}
      <Pagination basePath="/app/productos" page={result.page} pageCount={result.pageCount} query={filters.query} status={filters.status} />
    </section>
  );
}

function ErrorState({ title }: { title: string }) {
  return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h1 className="text-2xl font-semibold text-amber-950">{title}</h1><p className="mt-2 text-amber-900">No fue posible cargar el catálogo. Verifica que la migración 003 esté aplicada en el entorno consultado.</p></section>;
}
