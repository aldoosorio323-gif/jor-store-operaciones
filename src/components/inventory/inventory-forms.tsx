"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { ConfirmDialog } from "@/components/ui/dialog";
import { buttonStyles, fieldClass } from "@/components/ui/operational-ui";
import type { ActionResult } from "@/app/actions/auth";
import {
  adjustInventoryAction,
  cancelPurchaseAction,
  cancelTransferAction,
  confirmPurchaseAction,
  confirmTransferAction,
  dispatchTransferAction,
  receivePurchaseItemAction,
  receiveTransferItemAction,
  removePurchaseItemAction,
  removeTransferItemAction,
  savePurchaseAction,
  savePurchaseItemAction,
  saveTransferAction,
  saveTransferItemAction,
} from "@/app/actions/inventory";
import type {
  InventoryBalanceItem,
  LocationOption,
  PurchaseDetail,
  PurchaseItem,
  SelectOption,
  TransferDetail,
  TransferItem,
} from "@/types/inventory";
import { formatDateTimeLocalInLima } from "@/features/inventory/lima-time";
import {
  inventoryAdjustmentSchema,
  purchaseItemSchema,
  purchaseReceiptSchema,
  purchaseSchema,
  transferItemSchema,
  transferReceiptSchema,
  transferSchema,
} from "@/validations/inventory";

const inputClass = fieldClass;
const primaryClass = buttonStyles.primary;
const secondaryClass = buttonStyles.secondary;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-medium text-neutral-700">{label}{children}</label>;
}

function Message({ result }: { result: ActionResult }) {
  return result.message ? <p aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{result.message}</p> : null;
}

function useMutationResult() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({ ok: false, message: "" });
  const run = (task: () => Promise<ActionResult>, onSuccess?: () => void) => {
    if (pending) return;
    startTransition(async () => {
      const next = await task();
      setResult(next);
      if (next.ok) {
        onSuccess?.();
        if (next.redirectTo) router.push(next.redirectTo);
        router.refresh();
      }
    });
  };
  return { pending, result, setResult, run };
}

function useIdempotencyKey() {
  const key = useRef("");
  const get = () => {
    if (!key.current) key.current = crypto.randomUUID();
    return key.current;
  };
  const rotate = () => { key.current = ""; };
  return { get, rotate };
}

type PurchaseValues = { supplierId: string; supplierReference: string; orderedAt: string; expectedAt: string; notes: string };

export function PurchaseForm({ suppliers, purchase }: { suppliers: SelectOption[]; purchase?: PurchaseDetail }) {
  const state = useMutationResult();
  const { register, handleSubmit } = useForm<PurchaseValues>({ defaultValues: {
    supplierId: purchase?.supplierId ?? "", supplierReference: purchase?.supplierReference ?? "",
    orderedAt: formatDateTimeLocalInLima(purchase?.orderedAt ?? new Date()) ?? "",
    expectedAt: purchase?.expectedAt ?? "", notes: purchase?.notes ?? "",
  } });
  return <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
    const parsed = purchaseSchema.safeParse(values);
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    state.run(() => savePurchaseAction(purchase?.id ?? null, parsed.data));
  })}>
    <Field label="Proveedor"><select {...register("supplierId")} required className={inputClass}><option value="">Selecciona</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
    <Field label="Referencia del proveedor"><input {...register("supplierReference")} className={inputClass} /></Field>
    <Field label="Fecha de compra"><input {...register("orderedAt")} type="datetime-local" required className={inputClass} /></Field>
    <Field label="Fecha esperada"><input {...register("expectedAt")} type="date" className={inputClass} /></Field>
    <label className="text-sm font-medium text-neutral-700 sm:col-span-2">Notas<textarea {...register("notes")} rows={3} className={inputClass} /></label>
    <div className="sm:col-span-2"><Message result={state.result} /></div>
    <button disabled={state.pending} className={`${primaryClass} sm:col-span-2`}>{state.pending ? "Guardando…" : purchase ? "Guardar compra" : "Crear compra"}</button>
  </form>;
}

type PurchaseItemValues = { lineNumber: number; variantId: string; orderedQuantity: number; unitCost: number; taxAmount: number };

export function PurchaseItemForm({ purchaseId, variants, item, nextLine }: {
  purchaseId: string; variants: SelectOption[]; item?: PurchaseItem; nextLine: number;
}) {
  const state = useMutationResult();
  const { register, handleSubmit, reset } = useForm<PurchaseItemValues>({ defaultValues: {
    lineNumber: item?.lineNumber ?? nextLine, variantId: item?.variantId ?? "",
    orderedQuantity: item?.orderedQuantity ?? 1, unitCost: item?.unitCost ?? 0, taxAmount: item?.taxAmount ?? 0,
  } });
  return <form className="grid gap-3 sm:grid-cols-5" onSubmit={handleSubmit((values) => {
    const parsed = purchaseItemSchema.safeParse({ ...values, purchaseId });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    state.run(() => savePurchaseItemAction(item?.id ?? null, parsed.data), () => {
      if (!item) reset({ lineNumber: nextLine + 1, variantId: "", orderedQuantity: 1, unitCost: 0, taxAmount: 0 });
    });
  })}>
    <Field label="Línea"><input {...register("lineNumber", { valueAsNumber: true })} type="number" min="1" required className={inputClass} /></Field>
    <Field label="Variante"><select {...register("variantId")} required className={inputClass}><option value="">Selecciona</option>{variants.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Cantidad"><input {...register("orderedQuantity", { valueAsNumber: true })} type="number" min="0.001" step="0.001" required className={inputClass} /></Field>
    <Field label="Costo unitario"><input {...register("unitCost", { valueAsNumber: true })} type="number" min="0" step="0.0001" required className={inputClass} /></Field>
    <Field label="Impuesto"><input {...register("taxAmount", { valueAsNumber: true })} type="number" min="0" step="0.01" required className={inputClass} /></Field>
    <div className="sm:col-span-5"><Message result={state.result} /></div>
    <button disabled={state.pending} className={`${primaryClass} sm:col-span-5`}>{state.pending ? "Guardando…" : item ? "Actualizar línea" : "Añadir línea"}</button>
  </form>;
}

export function RemovePurchaseItemButton({ id }: { id: string }) {
  const state = useMutationResult();
  const [open, setOpen] = useState(false);
  return <div><button type="button" disabled={state.pending} className={secondaryClass} onClick={() => setOpen(true)}>{state.pending ? "Retirando…" : "Retirar línea"}</button><ConfirmDialog open={open} onOpenChange={setOpen} title="Retirar línea" description="La línea se eliminará del borrador de compra. Los totales serán recalculados por el servidor." confirmLabel="Retirar línea" danger pending={state.pending} onConfirm={() => { setOpen(false); state.run(() => removePurchaseItemAction(id)); }}/><Message result={state.result} /></div>;
}

export function PurchaseActions({ id, canConfirm, canCancel }: { id: string; canConfirm: boolean; canCancel: boolean }) {
  const state = useMutationResult();
  const [dialog, setDialog] = useState<"confirm" | "cancel" | null>(null);
  return <div className="flex flex-wrap gap-3">
    {canConfirm ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => setDialog("confirm")}>Confirmar compra</button> : null}
    {canCancel ? <button type="button" disabled={state.pending} className={buttonStyles.danger} onClick={() => setDialog("cancel")}>Cancelar compra</button> : null}
    <ConfirmDialog open={dialog === "confirm"} onOpenChange={(open) => setDialog(open ? "confirm" : null)} title="Confirmar compra" description="La cabecera y las líneas quedarán congeladas. Luego podrás registrar recepciones parciales o completas." confirmLabel="Confirmar compra" pending={state.pending} onConfirm={() => { setDialog(null); state.run(() => confirmPurchaseAction(id)); }}/>
    <ConfirmDialog open={dialog === "cancel"} onOpenChange={(open) => setDialog(open ? "cancel" : null)} title="Cancelar compra" description="La compra quedará cancelada. Esta operación solo es válida antes de recibir stock." confirmLabel="Cancelar compra" danger pending={state.pending} onConfirm={() => { setDialog(null); state.run(() => cancelPurchaseAction(id)); }}/>
    <div className="basis-full"><Message result={state.result} /></div>
  </div>;
}

export function PurchaseReceiptForm({ item, locations }: { item: PurchaseItem; locations: LocationOption[] }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const [payload, setPayload] = useState<z.output<typeof purchaseReceiptSchema> | null>(null);
  const pendingQuantity = item.orderedQuantity - item.receivedQuantity;
  const { register, handleSubmit } = useForm<{ locationId: string; quantity: number }>({ defaultValues: { locationId: "", quantity: pendingQuantity } });
  return <form className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]" onSubmit={handleSubmit((values) => {
    const parsed = purchaseReceiptSchema.safeParse({ ...values, purchaseItemId: item.id, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    setPayload(parsed.data);
  })}>
    <Field label="Ubicación de recepción"><select {...register("locationId")} required className={inputClass}><option value="">Selecciona almacén y ubicación</option>{locations.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Cantidad"><input {...register("quantity", { valueAsNumber: true })} type="number" min="0.001" max={pendingQuantity} step="0.001" required className={inputClass} /></Field>
    <button disabled={state.pending} className={`${primaryClass} self-end`}>{state.pending ? "Recibiendo…" : "Recibir"}</button>
    <ConfirmDialog open={payload !== null} onOpenChange={(open) => { if (!open) setPayload(null); }} title="Registrar recepción" description={`Se incorporarán ${payload?.quantity ?? 0} unidades al inventario en la ubicación seleccionada.`} confirmLabel="Registrar recepción" pending={state.pending} onConfirm={() => { if (!payload) return; const next = payload; setPayload(null); state.run(() => receivePurchaseItemAction(next), idempotency.rotate); }}/>
    <div className="sm:col-span-3"><Message result={state.result} /></div>
  </form>;
}

type TransferValues = { originWarehouseId: string; destinationWarehouseId: string; notes: string };

export function TransferForm({ warehouses, transfer }: { warehouses: SelectOption[]; transfer?: TransferDetail }) {
  const state = useMutationResult();
  const { register, handleSubmit } = useForm<TransferValues>({ defaultValues: {
    originWarehouseId: transfer?.originWarehouseId ?? "", destinationWarehouseId: transfer?.destinationWarehouseId ?? "",
    notes: transfer?.notes ?? "",
  } });
  return <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
    const parsed = transferSchema.safeParse(values);
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    state.run(() => saveTransferAction(transfer?.id ?? null, parsed.data));
  })}>
    <Field label="Almacén origen"><select {...register("originWarehouseId")} required className={inputClass}><option value="">Selecciona</option>{warehouses.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Almacén destino"><select {...register("destinationWarehouseId")} required className={inputClass}><option value="">Selecciona</option>{warehouses.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <label className="text-sm font-medium text-neutral-700 sm:col-span-2">Notas<textarea {...register("notes")} rows={3} className={inputClass} /></label>
    <div className="sm:col-span-2"><Message result={state.result} /></div>
    <button disabled={state.pending} className={`${primaryClass} sm:col-span-2`}>{state.pending ? "Guardando…" : transfer ? "Guardar transferencia" : "Crear transferencia"}</button>
  </form>;
}

type TransferItemValues = { lineNumber: number; variantId: string; originLocationId: string; destinationLocationId: string; requestedQuantity: number };

export function TransferItemForm({ transfer, variants, locations, item, nextLine }: {
  transfer: TransferDetail; variants: SelectOption[]; locations: LocationOption[]; item?: TransferItem; nextLine: number;
}) {
  const state = useMutationResult();
  const origins = locations.filter((value) => value.warehouseId === transfer.originWarehouseId);
  const destinations = locations.filter((value) => value.warehouseId === transfer.destinationWarehouseId);
  const { register, handleSubmit, reset } = useForm<TransferItemValues>({ defaultValues: {
    lineNumber: item?.lineNumber ?? nextLine, variantId: item?.variantId ?? "",
    originLocationId: item?.originLocationId ?? "", destinationLocationId: item?.destinationLocationId ?? "",
    requestedQuantity: item?.requestedQuantity ?? 1,
  } });
  return <form className="grid gap-3 sm:grid-cols-5" onSubmit={handleSubmit((values) => {
    const parsed = transferItemSchema.safeParse({ ...values, transferId: transfer.id });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    state.run(() => saveTransferItemAction(item?.id ?? null, parsed.data), () => {
      if (!item) reset({ lineNumber: nextLine + 1, variantId: "", originLocationId: "", destinationLocationId: "", requestedQuantity: 1 });
    });
  })}>
    <Field label="Línea"><input {...register("lineNumber", { valueAsNumber: true })} type="number" min="1" className={inputClass} /></Field>
    <Field label="Variante"><select {...register("variantId")} required className={inputClass}><option value="">Selecciona</option>{variants.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Ubicación origen"><select {...register("originLocationId")} required className={inputClass}><option value="">Selecciona</option>{origins.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Ubicación destino"><select {...register("destinationLocationId")} required className={inputClass}><option value="">Selecciona</option>{destinations.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Cantidad"><input {...register("requestedQuantity", { valueAsNumber: true })} type="number" min="0.001" step="0.001" required className={inputClass} /></Field>
    <div className="sm:col-span-5"><Message result={state.result} /></div>
    <button disabled={state.pending} className={`${primaryClass} sm:col-span-5`}>{state.pending ? "Guardando…" : item ? "Actualizar línea" : "Añadir línea"}</button>
  </form>;
}

export function RemoveTransferItemButton({ id }: { id: string }) {
  const state = useMutationResult();
  const [open, setOpen] = useState(false);
  return <div><button type="button" disabled={state.pending} className={secondaryClass} onClick={() => setOpen(true)}>{state.pending ? "Retirando…" : "Retirar línea"}</button><ConfirmDialog open={open} onOpenChange={setOpen} title="Retirar línea" description="La línea se eliminará del borrador de transferencia." confirmLabel="Retirar línea" danger pending={state.pending} onConfirm={() => { setOpen(false); state.run(() => removeTransferItemAction(id)); }}/><Message result={state.result} /></div>;
}

export function TransferActions({ transfer }: { transfer: TransferDetail }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const [dialog, setDialog] = useState<"confirm" | "dispatch" | "cancel" | null>(null);
  return <div className="flex flex-wrap gap-3">
    {transfer.status === "draft" ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => setDialog("confirm")}>Confirmar</button> : null}
    {transfer.status === "confirmed" ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => setDialog("dispatch")}>Despachar</button> : null}
    {["draft", "confirmed"].includes(transfer.status) ? <button type="button" disabled={state.pending} className={buttonStyles.danger} onClick={() => setDialog("cancel")}>Cancelar</button> : null}
    <ConfirmDialog open={dialog === "confirm"} onOpenChange={(open)=>setDialog(open ? "confirm" : null)} title="Confirmar transferencia" description="La cabecera y las líneas quedarán congeladas antes del despacho." confirmLabel="Confirmar" pending={state.pending} onConfirm={()=>{setDialog(null);state.run(()=>confirmTransferAction(transfer.id));}}/>
    <ConfirmDialog open={dialog === "dispatch"} onOpenChange={(open)=>setDialog(open ? "dispatch" : null)} title="Despachar transferencia" description="El stock saldrá del almacén de origen y permanecerá en tránsito hasta registrar la recepción." confirmLabel="Despachar" pending={state.pending} onConfirm={()=>{setDialog(null);state.run(()=>dispatchTransferAction(transfer.id,idempotency.get()),idempotency.rotate);}}/>
    <ConfirmDialog open={dialog === "cancel"} onOpenChange={(open)=>setDialog(open ? "cancel" : null)} title="Cancelar transferencia" description="La transferencia quedará cancelada y no podrá despacharse." confirmLabel="Cancelar transferencia" danger pending={state.pending} onConfirm={()=>{setDialog(null);state.run(()=>cancelTransferAction(transfer.id));}}/>
    <div className="basis-full"><Message result={state.result} /></div>
  </div>;
}

export function TransferReceiptForm({ item }: { item: TransferItem }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const pendingQuantity = item.dispatchedQuantity - item.receivedQuantity;
  const [payload, setPayload] = useState<z.output<typeof transferReceiptSchema> | null>(null);
  const { register, handleSubmit } = useForm<{ quantity: number }>({ defaultValues: { quantity: pendingQuantity } });
  return <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit((values) => {
    const parsed = transferReceiptSchema.safeParse({ ...values, transferItemId: item.id, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    setPayload(parsed.data);
  })}>
    <Field label="Cantidad a recibir"><input {...register("quantity", { valueAsNumber: true })} type="number" min="0.001" max={pendingQuantity} step="0.001" className={inputClass} /></Field>
    <button disabled={state.pending} className={primaryClass}>{state.pending ? "Recibiendo…" : "Recibir"}</button>
    <ConfirmDialog open={payload !== null} onOpenChange={(open)=>{if(!open)setPayload(null);}} title="Recibir transferencia" description={`Se registrarán ${payload?.quantity ?? 0} unidades en el almacén de destino.`} confirmLabel="Registrar recepción" pending={state.pending} onConfirm={()=>{if(!payload)return;const next=payload;setPayload(null);state.run(()=>receiveTransferItemAction(next),idempotency.rotate);}}/>
    <div className="basis-full"><Message result={state.result} /></div>
  </form>;
}

type AdjustmentValues = { variantId: string; locationId: string; movementType: "initial_stock" | "positive_adjustment" | "negative_adjustment" | "damaged" | "lost"; quantity: number; unitCost: number; reason: string };

export function InventoryAdjustmentForm({ selectedVariant, selectedLocation, balance }: {
  selectedVariant: SelectOption; selectedLocation: LocationOption; balance?: InventoryBalanceItem;
}) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const { register, handleSubmit, control } = useForm<AdjustmentValues>({ defaultValues: {
    variantId: selectedVariant.id, locationId: selectedLocation.id,
    movementType: "positive_adjustment", quantity: 1, unitCost: 0, reason: "",
  } });
  const movementType = useWatch({ control, name: "movementType" });
  const needsCost = ["initial_stock", "positive_adjustment"].includes(movementType);
  const [payload, setPayload] = useState<z.output<typeof inventoryAdjustmentSchema> | null>(null);
  return <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
    const parsed = inventoryAdjustmentSchema.safeParse({ ...values, unitCost: needsCost ? values.unitCost : null, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    setPayload(parsed.data);
  })}>
    <input type="hidden" {...register("variantId")} />
    <input type="hidden" {...register("locationId")} />
    <div className="rounded-xl border border-neutral-200 p-4 text-sm"><span className="text-neutral-500">Variante</span><p className="mt-1 font-semibold">{selectedVariant.label}</p></div>
    <div className="rounded-xl border border-neutral-200 p-4 text-sm"><span className="text-neutral-500">Almacén y ubicación</span><p className="mt-1 font-semibold">{selectedLocation.label}</p></div>
    <div className="rounded-xl bg-neutral-100 p-4 text-sm sm:col-span-2"><strong>Saldo actual:</strong> físico {balance?.physicalStock ?? 0}, reservado {balance?.reservedStock ?? 0}, disponible {balance?.availableStock ?? 0}. El saldo final no es editable.</div>
    <Field label="Tipo"><select {...register("movementType")} className={inputClass}><option value="initial_stock">Stock inicial</option><option value="positive_adjustment">Ajuste positivo</option><option value="negative_adjustment">Ajuste negativo</option><option value="damaged">Dañado</option><option value="lost">Perdido</option></select></Field>
    <Field label="Cantidad positiva"><input {...register("quantity", { valueAsNumber: true })} type="number" min="0.001" step="0.001" required className={inputClass} /></Field>
    {needsCost ? <Field label="Costo unitario"><input {...register("unitCost", { valueAsNumber: true })} type="number" min="0" step="0.0001" required className={inputClass} /></Field> : null}
    <label className="text-sm font-medium text-neutral-700 sm:col-span-2">Razón<textarea {...register("reason")} rows={3} required className={inputClass} /></label>
    <div className="sm:col-span-2"><Message result={state.result} /></div>
    <button disabled={state.pending} className={`${primaryClass} sm:col-span-2`}>{state.pending ? "Registrando…" : "Registrar ajuste"}</button>
    <ConfirmDialog open={payload !== null} onOpenChange={(open)=>{if(!open)setPayload(null);}} title="Confirmar ajuste de inventario" description={`El movimiento se registrará sobre el saldo físico actual de ${balance?.physicalStock ?? 0}. El libro mayor no podrá editarse después.`} confirmLabel="Registrar ajuste" danger={Boolean(payload && ["negative_adjustment","damaged","lost"].includes(payload.movementType))} pending={state.pending} onConfirm={()=>{if(!payload)return;const next=payload;setPayload(null);state.run(()=>adjustInventoryAction(next),idempotency.rotate);}}/>
  </form>;
}
