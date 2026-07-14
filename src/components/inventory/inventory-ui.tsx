import Link from "next/link";
import type { ReactNode } from "react";

export function OperationalStatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-950">{label}</span>;
}

export function OperationalEmpty({ children }: { children: ReactNode }) {
  return <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">{children}</p>;
}

export function OperationalPagination({ basePath, page, pageCount, params }: {
  basePath: string; page: number; pageCount: number; params: Record<string, string | boolean>;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams({ page: String(target) });
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, String(value));
    return `${basePath}?${search}`;
  };
  return <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-4">
    {page > 1 ? <Link href={href(page - 1)} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">Anterior</Link> : <span />}
    <span className="text-sm text-neutral-600">Página {page} de {pageCount}</span>
    {page < pageCount ? <Link href={href(page + 1)} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">Siguiente</Link> : <span />}
  </nav>;
}

export function OperationalError({ title }: { title: string }) {
  return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h1 className="text-2xl font-semibold text-amber-950">{title}</h1><p className="mt-2 text-amber-900">No fue posible cargar la información. Verifica que la migración 004 esté aplicada en el entorno consultado.</p></section>;
}

export function OperationalLoading() {
  return <div aria-busy="true" className="space-y-4"><div className="h-9 w-52 animate-pulse rounded bg-neutral-200" /><div className="h-24 animate-pulse rounded-2xl bg-neutral-200" /><div className="h-40 animate-pulse rounded-2xl bg-neutral-200" /></div>;
}
