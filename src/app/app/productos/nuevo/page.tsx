import Link from "next/link";
import { ProductForm } from "@/components/catalogs/catalog-forms";
import { requireAdministrator } from "@/lib/auth/session";

export default async function NewProductPage() {
  await requireAdministrator();
  return <section className="mx-auto max-w-3xl"><Link href="/app/productos" className="text-sm font-semibold text-emerald-800">← Volver a productos</Link><h1 className="mt-4 text-3xl font-semibold text-emerald-950">Nuevo producto</h1><div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><ProductForm /></div></section>;
}
