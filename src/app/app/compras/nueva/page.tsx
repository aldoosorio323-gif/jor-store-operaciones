import Link from "next/link";
import { PurchaseForm } from "@/components/inventory/inventory-forms";
import { requireActiveUser } from "@/lib/auth/session";
import { listSupplierOptions } from "@/services/inventory";

export default async function NewPurchasePage() {
  await requireActiveUser();
  const suppliers = await listSupplierOptions();
  return <section className="mx-auto max-w-3xl"><Link href="/app/compras" className="text-sm font-semibold text-emerald-800">← Volver a compras</Link><h1 className="mt-4 text-3xl font-semibold text-emerald-950">Nueva compra</h1><p className="mt-2 text-neutral-600">El número y los totales se generan exclusivamente en PostgreSQL.</p><div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><PurchaseForm suppliers={suppliers} /></div></section>;
}
