import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, Feedback, SkeletonPage, StatusBadge, buttonStyles } from "@/components/ui/operational-ui";

export function OperationalStatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const tone = normalized.includes("cancel") || normalized.includes("perdid") ? "danger" : normalized.includes("pendiente") || normalized.includes("parcial") || normalized.includes("tránsito") ? "warning" : normalized.includes("borrador") ? "neutral" : "success";
  return <StatusBadge label={label} tone={tone}/>;
}
export function OperationalEmpty({ children, title, action }: { children?: ReactNode; title?: string; action?: ReactNode }) { return <EmptyState title={title} description={typeof children === "string" ? children : undefined} action={action}>{children}</EmptyState>; }
export function OperationalPagination({ basePath, page, pageCount, params }: { basePath: string; page: number; pageCount: number; params: Record<string, string | boolean> }) {
  if (pageCount <= 1) return null; const href=(target:number)=>{const search=new URLSearchParams({page:String(target)});for(const [key,value] of Object.entries(params))if(value)search.set(key,String(value));return `${basePath}?${search}`;};
  return <nav aria-label="Paginación" className="app-surface mt-5 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 shadow-sm"><span className="app-muted text-sm">Página <strong className="app-text">{page}</strong> de {pageCount}</span><div className="flex gap-2">{page>1?<Link href={href(page-1)} className={buttonStyles.secondary}>Anterior</Link>:null}{page<pageCount?<Link href={href(page+1)} className={buttonStyles.secondary}>Siguiente</Link>:null}</div></nav>;
}
export function OperationalError({ title }: { title: string }) { return <Feedback tone="warning"><strong>{title}.</strong> No fue posible cargar la información solicitada. Inténtalo nuevamente o contacta al administrador.</Feedback>; }
export function OperationalLoading() { return <SkeletonPage/>; }
