import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState as BaseEmptyState, FilterBar, SkeletonPage, StatusBadge as BaseStatusBadge, buttonStyles, fieldClass } from "@/components/ui/operational-ui";
import type { CatalogFilters } from "@/types/catalogs";

export function CatalogFiltersForm({ basePath, filters, isAdministrator, placeholder }: { basePath: string; filters: CatalogFilters; isAdministrator: boolean; placeholder: string }) {
  return <form action={basePath} className="mt-5"><FilterBar className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_12rem_auto] sm:items-end"><label className="text-sm font-medium text-slate-700">Buscar<input name="query" defaultValue={filters.query} placeholder={placeholder} className={fieldClass}/></label>{isAdministrator ? <label className="text-sm font-medium text-slate-700">Estado<select name="status" defaultValue={filters.status} className={fieldClass}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label> : null}<button className={buttonStyles.primary}>Aplicar filtros</button></FilterBar></form>;
}

export function Pagination({ basePath, page, pageCount, query, status }: { basePath: string; page: number; pageCount: number; query: string; status: CatalogFilters["status"] }) {
  if (pageCount <= 1) return null;
  const href = (target: number) => { const params = new URLSearchParams({ page: String(target) }); if (query) params.set("query", query); if (status !== "active") params.set("status", status); return `${basePath}?${params.toString()}`; };
  return <nav aria-label="Paginación" className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="text-sm text-slate-500">Página <strong className="text-slate-800">{page}</strong> de {pageCount}</span><div className="flex gap-2">{page > 1 ? <Link href={href(page - 1)} className={buttonStyles.secondary}>Anterior</Link> : null}{page < pageCount ? <Link href={href(page + 1)} className={buttonStyles.secondary}>Siguiente</Link> : null}</div></nav>;
}

export function StatusBadge({ active }: { active: boolean }) { return <BaseStatusBadge label={active ? "Activo" : "Inactivo"} tone={active ? "success" : "neutral"}/>; }
export function EmptyState({ children, title, action }: { children?: ReactNode; title?: string; action?: ReactNode }) { return <BaseEmptyState title={title} description={typeof children === "string" ? children : undefined} action={action}>{children}</BaseEmptyState>; }
export function CatalogLoading() { return <SkeletonPage/>; }
