import Link from "next/link";
import { TransferForm } from "@/components/inventory/inventory-forms";
import { requireActiveUser } from "@/lib/auth/session";
import { listWarehouseOptions } from "@/services/inventory";

export default async function NewTransferPage() {
  await requireActiveUser();
  const warehouses = await listWarehouseOptions();
  return <section className="mx-auto max-w-3xl"><Link href="/app/transferencias" className="text-sm font-semibold text-emerald-800">← Volver a transferencias</Link><h1 className="mt-4 text-3xl font-semibold text-emerald-950">Nueva transferencia</h1><p className="mt-2 text-neutral-600">El número se genera en servidor. Origen y destino deben ser distintos.</p><div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><TransferForm warehouses={warehouses} /></div></section>;
}
