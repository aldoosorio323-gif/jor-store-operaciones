import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

export const fieldClass = "app-field mt-2 min-h-11 w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm outline-none transition disabled:cursor-not-allowed";

export const buttonStyles = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-primary-solid)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--app-primary-solid-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-55",
  secondary: "app-surface-raised inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-[var(--app-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-55",
  danger: "app-surface-raised inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-55 dark:text-red-300",
  ghost: "app-muted inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus-ring)] disabled:opacity-55",
} as const;

export function PageHeader({ title, description, action, eyebrow, backHref, backLabel }: { title: string; description?: string; action?: ReactNode; eyebrow?: string; backHref?: string; backLabel?: string }) {
  return <header className="mb-6">
    {backHref ? <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-primary)] hover:text-[var(--app-primary-hover)]"><Icon name="arrow-left" className="size-4" />{backLabel ?? "Volver"}</Link> : null}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">{eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-primary)]">{eyebrow}</p> : null}<h1 className="app-text text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description ? <p className="app-muted mt-1.5 max-w-3xl text-sm leading-6 sm:text-base">{description}</p> : null}</div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  </header>;
}

export function SectionCard({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`app-surface rounded-xl border shadow-sm ${className}`}>
    {title || description || action ? <div className="app-border flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"><div>{title ? <h2 className="app-text font-semibold">{title}</h2> : null}{description ? <p className="app-muted mt-1 text-sm">{description}</p> : null}</div>{action}</div> : null}
    <div className="p-4 sm:p-5">{children}</div>
  </section>;
}

export function FilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`app-surface rounded-xl border p-4 shadow-sm ${className}`} data-filter-bar>{children}</div>;
}

export function FormField({ label, children, help, required, className = "" }: { label: string; children: ReactNode; help?: string; required?: boolean; className?: string }) {
  return <label className={`app-text block text-sm font-medium ${className}`}>{label}{required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}{children}{help ? <span className="app-muted mt-1.5 block text-xs leading-5">{help}</span> : null}</label>;
}

const tones = { success: "border-emerald-200 bg-emerald-50 text-emerald-900", error: "border-red-200 bg-red-50 text-red-900", warning: "border-amber-200 bg-amber-50 text-amber-950", info: "border-blue-200 bg-blue-50 text-blue-950" };
export function Feedback({ children, tone = "info", className = "" }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  const icon: IconName = tone === "success" ? "check" : tone === "warning" || tone === "error" ? "warning" : "info";
  return <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex min-h-12 items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5 ${tones[tone]} ${className}`}><Icon name={icon} className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const classes = { success: "bg-emerald-100 text-emerald-800", warning: "bg-amber-100 text-amber-900", danger: "bg-red-100 text-red-800", info: "bg-blue-100 text-blue-800", neutral: "app-soft app-muted" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>;
}

export function EmptyState({ title, description, action, icon = "box", children }: { title?: string; description?: string; action?: ReactNode; icon?: IconName; children?: ReactNode }) {
  return <div className="app-surface mt-5 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-10 text-center" data-empty-state><div className="app-soft app-muted flex size-11 items-center justify-center rounded-xl"><Icon name={icon} className="size-5" /></div><h2 className="app-text mt-4 font-semibold">{title ?? "No hay resultados"}</h2><div className="app-muted mt-1 max-w-md text-sm leading-6">{description ?? children}</div>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function ResponsiveList({ table, cards }: { table: ReactNode; cards: ReactNode }) {
  return <div className="mt-5" data-responsive-list><div className="app-surface hidden overflow-hidden rounded-xl border shadow-sm md:block"><div className="overflow-x-auto">{table}</div></div><div className="grid gap-3 md:hidden">{cards}</div></div>;
}

export const tableClass = "w-full min-w-[680px] border-collapse text-left text-sm";
export const tableHeadClass = "app-border app-soft app-muted border-b text-xs font-semibold uppercase tracking-wide";
export const tableRowClass = "app-border border-b last:border-0 hover:bg-[var(--app-surface-soft)]";
export const tableCellClass = "px-4 py-3.5 align-middle";

export function SkeletonPage() { return <div aria-busy="true" aria-label="Cargando contenido" className="space-y-5"><div className="app-soft h-8 w-56 animate-pulse rounded-lg"/><div className="app-soft h-20 animate-pulse rounded-xl"/><div className="app-surface space-y-2 rounded-xl border p-4">{[1,2,3,4].map((value)=><div key={value} className="app-soft h-12 animate-pulse rounded-lg"/>)}</div></div>; }

export function formatPEN(value: number) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value); }
export function formatLimaDate(value: string, includeTime = false) { return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", ...(includeTime ? { timeStyle: "short" as const } : {}), timeZone: "America/Lima" }).format(new Date(value)); }
