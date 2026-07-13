import Link from "next/link";
import { SupplierForm } from "@/components/catalogs/catalog-forms";
import { requireAdministrator } from "@/lib/auth/session";
export default async function NewSupplierPage() { await requireAdministrator(); return <section className="mx-auto max-w-3xl"><Link href="/app/proveedores" className="text-sm font-semibold text-emerald-800">← Volver a proveedores</Link><h1 className="mt-4 text-3xl font-semibold text-emerald-950">Nuevo proveedor</h1><p className="mt-2 text-sm text-neutral-600">La información es privada y no se registra en logs.</p><div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><SupplierForm /></div></section>; }
