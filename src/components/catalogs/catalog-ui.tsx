import Link from "next/link";
import type { CatalogFilters } from "@/types/catalogs";

export function CatalogFiltersForm({
  basePath,
  filters,
  isAdministrator,
  placeholder,
}: {
  basePath: string;
  filters: CatalogFilters;
  isAdministrator: boolean;
  placeholder: string;
}) {
  return (
    <form action={basePath} className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto]">
      <label className="text-sm font-medium text-neutral-700">
        Buscar
        <input name="query" defaultValue={filters.query} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal" />
      </label>
      {isAdministrator ? (
        <label className="text-sm font-medium text-neutral-700">
          Estado
          <select name="status" defaultValue={filters.status} className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>
      ) : null}
      <button className="self-end rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Buscar</button>
    </form>
  );
}

export function Pagination({
  basePath,
  page,
  pageCount,
  query,
  status,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  query: string;
  status: CatalogFilters["status"];
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams({ page: String(target) });
    if (query) params.set("query", query);
    if (status !== "active") params.set("status", status);
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? <Link href={href(page - 1)} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">Anterior</Link> : <span />}
      <span className="text-sm text-neutral-600">Página {page} de {pageCount}</span>
      {page < pageCount ? <Link href={href(page + 1)} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">Siguiente</Link> : <span />}
    </nav>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-900" : "bg-neutral-200 text-neutral-700"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">{children}</p>;
}

export function CatalogLoading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-9 w-52 animate-pulse rounded bg-neutral-200" />
      <div className="h-24 animate-pulse rounded-2xl bg-neutral-200" />
      <div className="h-36 animate-pulse rounded-2xl bg-neutral-200" />
    </div>
  );
}
