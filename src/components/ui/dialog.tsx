"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icons";
import { buttonStyles } from "@/components/ui/operational-ui";

export function Modal({ open, onClose, title, description, children, footer, danger = false }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; danger?: boolean }) {
  const titleId = useId(); const descriptionId = useId(); const panelRef = useRef<HTMLDivElement>(null); const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const panel = panelRef.current; const focusable = () => [...(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable(); if (!items.length) return; const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; returnFocusRef.current?.focus(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[1px] sm:items-center sm:p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 id={titleId} className="text-lg font-semibold text-slate-950">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}</div><button type="button" onClick={onClose} className="-mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar diálogo"><Icon name="close" className="size-5"/></button></div>{children ? <div className="px-5 py-5">{children}</div> : null}{footer ? <div className={`flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end ${danger ? "border-t-red-100" : ""}`}>{footer}</div> : null}</div></div>, document.body);
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", onConfirm, pending = false, danger = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; pending?: boolean; danger?: boolean }) {
  return <Modal open={open} onClose={()=>{if(!pending)onOpenChange(false);}} title={title} description={description} danger={danger} footer={<><button type="button" className={buttonStyles.secondary} onClick={()=>onOpenChange(false)} disabled={pending}>{cancelLabel}</button><button type="button" className={danger ? buttonStyles.danger : buttonStyles.primary} onClick={onConfirm} disabled={pending}>{pending ? "Procesando…" : confirmLabel}</button></>} />;
}
