"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
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

const inputClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const primaryClass = "rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass = "rounded-xl border border-neutral-300 bg-white px-4 py-3 font-semibold text-neutral-800 disabled:opacity-60";

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
  return <div><button type="button" disabled={state.pending} className={secondaryClass} onClick={() => {
    if (!window.confirm("¿Confirmas que deseas retirar esta línea del borrador?")) return;
    state.run(() => removePurchaseItemAction(id));
  }}>{state.pending ? "Retirando…" : "Retirar línea"}</button><Message result={state.result} /></div>;
}

export function PurchaseActions({ id, canConfirm, canCancel }: { id: string; canConfirm: boolean; canCancel: boolean }) {
  const state = useMutationResult();
  return <div className="flex flex-wrap gap-3">
    {canConfirm ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => {
      if (!window.confirm("¿Confirmas la compra? La cabecera y sus líneas quedarán congeladas.")) return;
      state.run(() => confirmPurchaseAction(id));
    }}>Confirmar compra</button> : null}
    {canCancel ? <button type="button" disabled={state.pending} className={secondaryClass} onClick={() => {
      if (!window.confirm("¿Confirmas la cancelación? Solo es posible antes de recibir stock.")) return;
      state.run(() => cancelPurchaseAction(id));
    }}>Cancelar compra</button> : null}
    <div className="basis-full"><Message result={state.result} /></div>
  </div>;
}

export function PurchaseReceiptForm({ item, locations }: { item: PurchaseItem; locations: LocationOption[] }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const pendingQuantity = item.orderedQuantity - item.receivedQuantity;
  const { register, handleSubmit } = useForm<{ locationId: string; quantity: number }>({ defaultValues: { locationId: "", quantity: pendingQuantity } });
  return <form className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]" onSubmit={handleSubmit((values) => {
    const parsed = purchaseReceiptSchema.safeParse({ ...values, purchaseItemId: item.id, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    if (!window.confirm(`¿Registrar la recepción de ${parsed.data.quantity} unidades?`)) return;
    state.run(() => receivePurchaseItemAction(parsed.data), idempotency.rotate);
  })}>
    <Field label="Ubicación de recepción"><select {...register("locationId")} required className={inputClass}><option value="">Selecciona almacén y ubicación</option>{locations.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></Field>
    <Field label="Cantidad"><input {...register("quantity", { valueAsNumber: true })} type="number" min="0.001" max={pendingQuantity} step="0.001" required className={inputClass} /></Field>
    <button disabled={state.pending} className={`${primaryClass} self-end`}>{state.pending ? "Recibiendo…" : "Recibir"}</button>
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
  return <div><button type="button" disabled={state.pending} className={secondaryClass} onClick={() => {
    if (!window.confirm("¿Confirmas que deseas retirar esta línea del borrador?")) return;
    state.run(() => removeTransferItemAction(id));
  }}>{state.pending ? "Retirando…" : "Retirar línea"}</button><Message result={state.result} /></div>;
}

export function TransferActions({ transfer }: { transfer: TransferDetail }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  return <div className="flex flex-wrap gap-3">
    {transfer.status === "draft" ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => {
      if (!window.confirm("¿Confirmas la transferencia? La cabecera y sus líneas quedarán congeladas.")) return;
      state.run(() => confirmTransferAction(transfer.id));
    }}>Confirmar</button> : null}
    {transfer.status === "confirmed" ? <button type="button" disabled={state.pending} className={primaryClass} onClick={() => {
      if (!window.confirm("¿Despachar todas las líneas? El stock saldrá del origen y quedará en tránsito.")) return;
      state.run(() => dispatchTransferAction(transfer.id, idempotency.get()), idempotency.rotate);
    }}>Despachar</button> : null}
    {["draft", "confirmed"].includes(transfer.status) ? <button type="button" disabled={state.pending} className={secondaryClass} onClick={() => {
      if (!window.confirm("¿Confirmas la cancelación de la transferencia?")) return;
      state.run(() => cancelTransferAction(transfer.id));
    }}>Cancelar</button> : null}
    <div className="basis-full"><Message result={state.result} /></div>
  </div>;
}

export function TransferReceiptForm({ item }: { item: TransferItem }) {
  const state = useMutationResult();
  const idempotency = useIdempotencyKey();
  const pendingQuantity = item.dispatchedQuantity - item.receivedQuantity;
  const { register, handleSubmit } = useForm<{ quantity: number }>({ defaultValues: { quantity: pendingQuantity } });
  return <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit((values) => {
    const parsed = transferReceiptSchema.safeParse({ ...values, transferItemId: item.id, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    if (!window.confirm(`¿Registrar la recepción de ${parsed.data.quantity} unidades en destino?`)) return;
    state.run(() => receiveTransferItemAction(parsed.data), idempotency.rotate);
  })}>
    <Field label="Cantidad a recibir"><input {...register("quantity", { valueAsNumber: true })} type="number" min="0.001" max={pendingQuantity} step="0.001" className={inputClass} /></Field>
    <button disabled={state.pending} className={primaryClass}>{state.pending ? "Recibiendo…" : "Recibir"}</button>
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
  return <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
    const parsed = inventoryAdjustmentSchema.safeParse({ ...values, unitCost: needsCost ? values.unitCost : null, idempotencyKey: idempotency.get() });
    if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
    if (!window.confirm(`¿Confirmas el ajuste sobre el saldo físico actual ${balance?.physicalStock ?? 0}?`)) return;
    state.run(() => adjustInventoryAction(parsed.data), idempotency.rotate);
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
  </form>;
}
