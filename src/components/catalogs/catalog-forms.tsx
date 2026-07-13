"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/app/actions/auth";
import {
  saveLocationAction,
  saveProductAction,
  saveSupplierAction,
  saveVariantAction,
  saveWarehouseAction,
  setLocationStatusAction,
  setProductStatusAction,
  setSupplierStatusAction,
  setVariantStatusAction,
  setWarehouseStatusAction,
} from "@/app/actions/catalogs";
import type {
  ProductDetail,
  ProductVariant,
  SupplierListItem,
  WarehouseListItem,
  WarehouseLocation,
} from "@/types/catalogs";
import {
  productSchema,
  productVariantSchema,
  supplierSchema,
  warehouseLocationSchema,
  warehouseSchema,
} from "@/validations/catalogs";

const inputClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const buttonClass = "rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";

function Message({ value, ok }: { value: string; ok: boolean }) {
  return value ? (
    <p aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
      {value}
    </p>
  ) : null;
}

function useResult() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({ ok: false, message: "" });
  const run = (task: () => Promise<ActionResult>) => {
    if (pending) return;
    startTransition(async () => {
      const next = await task();
      setResult(next);
      if (next.ok) {
        if (next.redirectTo) router.push(next.redirectTo);
        router.refresh();
      }
    });
  };
  return { pending, result, setResult, run };
}

type ProductValues = Omit<z.input<typeof productSchema>, "isActive">;

export function ProductForm({ product }: { product?: ProductDetail }) {
  const state = useResult();
  const { register, handleSubmit } = useForm<ProductValues>({
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      brand: product?.brand ?? "",
      category: product?.category ?? "",
      unitCode: product?.unitCode ?? "UND",
    },
  });

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
      const parsed = productSchema.safeParse({
        ...values,
        isActive: product?.isActive ?? true,
      });
      if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
      state.run(() => saveProductAction(product?.id ?? null, parsed.data));
    })}>
      <Field label="Nombre"><input {...register("name")} required className={inputClass} /></Field>
      <Field label="Unidad"><input {...register("unitCode")} required className={inputClass} /></Field>
      <Field label="Marca"><input {...register("brand")} className={inputClass} /></Field>
      <Field label="Categoría"><input {...register("category")} className={inputClass} /></Field>
      <Field label="Descripción" wide><textarea {...register("description")} rows={3} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Message value={state.result.message} ok={state.result.ok} /></div>
      <button disabled={state.pending} className={`${buttonClass} sm:col-span-2`}>
        {state.pending ? "Guardando…" : product ? "Guardar producto" : "Crear producto"}
      </button>
    </form>
  );
}

type WarehouseValues = Omit<z.input<typeof warehouseSchema>, "isActive">;

export function WarehouseForm({ warehouse }: { warehouse?: WarehouseListItem }) {
  const state = useResult();
  const { register, handleSubmit } = useForm<WarehouseValues>({
    defaultValues: {
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      description: warehouse?.description ?? "",
      address: warehouse?.address ?? "",
    },
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
      const parsed = warehouseSchema.safeParse({
        ...values,
        isActive: warehouse?.isActive ?? true,
      });
      if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
      state.run(() => saveWarehouseAction(warehouse?.id ?? null, parsed.data));
    })}>
      <Field label="Código"><input {...register("code")} required className={inputClass} /></Field>
      <Field label="Nombre"><input {...register("name")} required className={inputClass} /></Field>
      <Field label="Descripción" wide><textarea {...register("description")} rows={3} className={inputClass} /></Field>
      <Field label="Dirección" wide><textarea {...register("address")} rows={2} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Message value={state.result.message} ok={state.result.ok} /></div>
      <button disabled={state.pending} className={`${buttonClass} sm:col-span-2`}>
        {state.pending ? "Guardando…" : warehouse ? "Guardar almacén" : "Crear almacén"}
      </button>
    </form>
  );
}

type SupplierValues = Omit<z.input<typeof supplierSchema>, "isActive">;

export function SupplierForm({ supplier }: { supplier?: SupplierListItem }) {
  const state = useResult();
  const { register, handleSubmit } = useForm<SupplierValues>({
    defaultValues: {
      code: supplier?.code ?? "",
      businessName: supplier?.businessName ?? "",
      taxId: supplier?.taxId ?? "",
      contactName: supplier?.contactName ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
      notes: supplier?.notes ?? "",
    },
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
      const parsed = supplierSchema.safeParse({
        ...values,
        isActive: supplier?.isActive ?? true,
      });
      if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
      state.run(() => saveSupplierAction(supplier?.id ?? null, parsed.data));
    })}>
      <Field label="Código"><input {...register("code")} required className={inputClass} /></Field>
      <Field label="Razón social"><input {...register("businessName")} required className={inputClass} /></Field>
      <Field label="Identificación tributaria"><input {...register("taxId")} autoComplete="off" className={inputClass} /></Field>
      <Field label="Contacto"><input {...register("contactName")} autoComplete="off" className={inputClass} /></Field>
      <Field label="Correo"><input {...register("email")} type="email" autoComplete="off" className={inputClass} /></Field>
      <Field label="Teléfono"><input {...register("phone")} type="tel" autoComplete="off" className={inputClass} /></Field>
      <Field label="Notas" wide><textarea {...register("notes")} rows={3} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Message value={state.result.message} ok={state.result.ok} /></div>
      <button disabled={state.pending} className={`${buttonClass} sm:col-span-2`}>
        {state.pending ? "Guardando…" : supplier ? "Guardar proveedor" : "Crear proveedor"}
      </button>
    </form>
  );
}

type VariantValues = {
  sku: string; name: string; color: string; barcode: string; salePrice: number;
  attributesText: string;
};

export function VariantForm({ productId, variant }: { productId: string; variant?: ProductVariant }) {
  const state = useResult();
  const { register, handleSubmit, reset } = useForm<VariantValues>({
    defaultValues: {
      sku: variant?.sku ?? "", name: variant?.name ?? "", color: variant?.color ?? "",
      barcode: variant?.barcode ?? "", salePrice: variant?.salePrice ?? 0,
      attributesText: JSON.stringify(variant?.attributes ?? {}, null, 2),
    },
  });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
      let attributes: unknown;
      try { attributes = JSON.parse(values.attributesText || "{}"); }
      catch { return state.setResult({ ok: false, message: "Los atributos deben ser un objeto JSON válido." }); }
      const parsed = productVariantSchema.safeParse({
        productId,
        sku: values.sku,
        name: values.name,
        color: values.color,
        barcode: values.barcode,
        salePrice: values.salePrice,
        isActive: variant?.isActive ?? true,
        attributes,
      });
      if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
      state.run(async () => {
        const result = await saveVariantAction(variant?.id ?? null, parsed.data);
        if (result.ok && !variant) reset({ sku: "", name: "", color: "", barcode: "", salePrice: 0, attributesText: "{}" });
        return result;
      });
    })}>
      <Field label="SKU"><input {...register("sku")} required className={inputClass} /></Field>
      <Field label="Nombre"><input {...register("name")} required className={inputClass} /></Field>
      <Field label="Color"><input {...register("color")} className={inputClass} /></Field>
      <Field label="Código de barras"><input {...register("barcode")} className={inputClass} /></Field>
      <Field label="Precio de venta"><input {...register("salePrice", { valueAsNumber: true })} type="number" min="0" step="0.01" required className={inputClass} /></Field>
      <Field label="Atributos JSON"><textarea {...register("attributesText")} rows={3} className={`${inputClass} font-mono text-sm`} /></Field>
      <div className="sm:col-span-2"><Message value={state.result.message} ok={state.result.ok} /></div>
      <button disabled={state.pending} className={`${buttonClass} sm:col-span-2`}>
        {state.pending ? "Guardando…" : variant ? "Guardar variante" : "Añadir variante"}
      </button>
    </form>
  );
}

type LocationValues = Omit<z.input<typeof warehouseLocationSchema>, "warehouseId" | "isActive">;

export function LocationForm({ warehouseId, location }: { warehouseId: string; location?: WarehouseLocation }) {
  const state = useResult();
  const { register, handleSubmit, reset } = useForm<LocationValues>({
    defaultValues: {
      code: location?.code ?? "", name: location?.name ?? "",
      locationType: location?.locationType ?? "storage",
    },
  });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => {
      const parsed = warehouseLocationSchema.safeParse({
        ...values,
        warehouseId,
        isActive: location?.isActive ?? true,
      });
      if (!parsed.success) return state.setResult({ ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." });
      state.run(async () => {
        const result = await saveLocationAction(location?.id ?? null, parsed.data);
        if (result.ok && !location) reset({ code: "", name: "", locationType: "storage" });
        return result;
      });
    })}>
      <Field label="Código"><input {...register("code")} required className={inputClass} /></Field>
      <Field label="Nombre"><input {...register("name")} required className={inputClass} /></Field>
      <Field label="Tipo"><select {...register("locationType")} className={inputClass}>
        <option value="storage">Almacenamiento</option><option value="picking">Picking</option>
        <option value="quarantine">Cuarentena</option><option value="in_transit">En tránsito</option>
      </select></Field>
      <div className="sm:col-span-2"><Message value={state.result.message} ok={state.result.ok} /></div>
      <button disabled={state.pending} className={`${buttonClass} sm:col-span-2`}>
        {state.pending ? "Guardando…" : location ? "Guardar ubicación" : "Añadir ubicación"}
      </button>
    </form>
  );
}

type StatusEntity = "product" | "variant" | "warehouse" | "location" | "supplier";

export function CatalogStatusButton({ id, isActive, entity }: { id: string; isActive: boolean; entity: StatusEntity }) {
  const state = useResult();
  const action = {
    product: setProductStatusAction,
    variant: setVariantStatusAction,
    warehouse: setWarehouseStatusAction,
    location: setLocationStatusAction,
    supplier: setSupplierStatusAction,
  }[entity];
  return (
    <div className="space-y-2">
      <button type="button" disabled={state.pending} onClick={() => {
        if (isActive && !window.confirm("¿Confirmas que deseas desactivar este registro?")) return;
        state.run(() => action({ id, isActive: !isActive }));
      }} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60">
        {state.pending ? "Procesando…" : isActive ? "Desactivar" : "Activar"}
      </button>
      <Message value={state.result.message} ok={state.result.ok} />
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`text-sm font-medium text-neutral-800 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
