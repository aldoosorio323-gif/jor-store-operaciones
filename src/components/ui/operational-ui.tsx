import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

export const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-emerald-700 focus:ring-3 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const buttonStyles = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-55",
  secondary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-55",
  danger: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-55",
  ghost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-55",
} as const;

export function PageHeader({ title, description, action, eyebrow, backHref, backLabel }: { title: string; description?: string; action?: ReactNode; eyebrow?: string; backHref?: string; backLabel?: string }) {
  return <header className="mb-6">
    {backHref ? <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900"><Icon name="arrow-left" className="size-4" />{backLabel ?? "Volver"}</Link> : null}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">{eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p> : null}<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>{description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}</div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  </header>;
}

export function SectionCard({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {title || description || action ? <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"><div>{title ? <h2 className="font-semibold text-slate-950">{title}</h2> : null}{description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}</div>{action}</div> : null}
    <div className="p-4 sm:p-5">{children}</div>
  </section>;
}

export function FilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`} data-filter-bar>{children}</div>;
}

export function FormField({ label, children, help, required, className = "" }: { label: string; children: ReactNode; help?: string; required?: boolean; className?: string }) {
  return <label className={`block text-sm font-medium text-slate-700 ${className}`}>{label}{required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}{children}{help ? <span className="mt-1.5 block text-xs leading-5 text-slate-500">{help}</span> : null}</label>;
}

const tones = { success: "border-emerald-200 bg-emerald-50 text-emerald-900", error: "border-red-200 bg-red-50 text-red-900", warning: "border-amber-200 bg-amber-50 text-amber-950", info: "border-blue-200 bg-blue-50 text-blue-950" };
export function Feedback({ children, tone = "info", className = "" }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  const icon: IconName = tone === "success" ? "check" : tone === "warning" || tone === "error" ? "warning" : "info";
  return <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex min-h-12 items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5 ${tones[tone]} ${className}`}><Icon name={icon} className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const classes = { success: "bg-emerald-100 text-emerald-800", warning: "bg-amber-100 text-amber-900", danger: "bg-red-100 text-red-800", info: "bg-blue-100 text-blue-800", neutral: "bg-slate-100 text-slate-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>;
}

export function EmptyState({ title, description, action, icon = "box", children }: { title?: string; description?: string; action?: ReactNode; icon?: IconName; children?: ReactNode }) {
  return <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center" data-empty-state><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon name={icon} className="size-5" /></div><h2 className="mt-4 font-semibold text-slate-900">{title ?? "No hay resultados"}</h2><div className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description ?? children}</div>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function ResponsiveList({ table, cards }: { table: ReactNode; cards: ReactNode }) {
  return <div className="mt-5" data-responsive-list><div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto">{table}</div></div><div className="grid gap-3 md:hidden">{cards}</div></div>;
}

export const tableClass = "w-full min-w-[680px] border-collapse text-left text-sm";
export const tableHeadClass = "border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500";
export const tableRowClass = "border-b border-slate-100 last:border-0 hover:bg-slate-50/70";
export const tableCellClass = "px-4 py-3.5 align-middle";

export function SkeletonPage() { return <div aria-busy="true" aria-label="Cargando contenido" className="space-y-5"><div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200"/><div className="h-20 animate-pulse rounded-xl bg-slate-200"/><div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">{[1,2,3,4].map((value)=><div key={value} className="h-12 animate-pulse rounded-lg bg-slate-100"/>)}</div></div>; }

export function formatPEN(value: number) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value); }
export function formatLimaDate(value: string, includeTime = false) { return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", ...(includeTime ? { timeStyle: "short" as const } : {}), timeZone: "America/Lima" }).format(new Date(value)); }
