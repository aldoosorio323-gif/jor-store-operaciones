import Link from "next/link";
import { OperationalEmpty, OperationalError, OperationalPagination, OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { transferStatusLabels } from "@/features/inventory/domain";
import { parseInventoryFilters } from "@/features/inventory/filters";
import { requireActiveUser } from "@/lib/auth/session";
import { listTransfers, listWarehouseOptions } from "@/services/inventory";

export default async function TransfersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const filters = parseInventoryFilters(await searchParams);
  let result;
  let warehouses;
  try {
    [result, warehouses] = await Promise.all([listTransfers(filters), listWarehouseOptions()]);
  } catch { return <OperationalError title="Transferencias" />; }
  return <section><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">Transferencias</h1><p className="mt-2 text-neutral-600">Salida del origen y recepción posterior en destino.</p></div><Link href="/app/transferencias/nueva" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Nueva transferencia</Link></div>
      <form className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4"><label className="text-sm font-medium">Buscar<input name="query" defaultValue={filters.query} placeholder="Número" className="mt-2 w-full rounded-xl border px-4 py-3" /></label><label className="text-sm font-medium">Estado<select name="status" defaultValue={filters.status} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="all">Todos</option>{Object.entries(transferStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Almacén<select name="warehouseId" defaultValue={filters.warehouseId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todos</option>{warehouses.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><button className="self-end rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Filtrar</button></form>
      {result.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{result.items.map((item) => <Link key={item.id} href={`/app/transferencias/${item.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300"><div className="flex justify-between gap-3"><h2 className="font-semibold">{item.transferNumber}</h2><OperationalStatusBadge label={transferStatusLabels[item.status]} /></div><p className="mt-4 text-sm">{item.originWarehouseName} <span aria-hidden>→</span> {item.destinationWarehouseName}</p></Link>)}</div> : <OperationalEmpty>No se encontraron transferencias.</OperationalEmpty>}
      <OperationalPagination basePath="/app/transferencias" page={result.page} pageCount={result.pageCount} params={{ query: filters.query, status: filters.status === "all" ? "" : filters.status, warehouseId: filters.warehouseId }} />
    </section>;
}
