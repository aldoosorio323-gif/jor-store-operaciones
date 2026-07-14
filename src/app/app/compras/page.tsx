import Link from "next/link";
import { OperationalEmpty, OperationalError, OperationalPagination, OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { purchaseStatusLabels } from "@/features/inventory/domain";
import { parseInventoryFilters } from "@/features/inventory/filters";
import { requireActiveUser } from "@/lib/auth/session";
import { listPurchases, listSupplierOptions } from "@/services/inventory";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const filters = parseInventoryFilters(await searchParams);
  let result;
  let suppliers;
  try {
    [result, suppliers] = await Promise.all([listPurchases(filters), listSupplierOptions()]);
  } catch { return <OperationalError title="Compras" />; }
  return <section>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">Compras</h1><p className="mt-2 text-neutral-600">Borradores, confirmación y recepciones con costo histórico.</p></div><Link href="/app/compras/nueva" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Nueva compra</Link></div>
      <form className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">
        <label className="text-sm font-medium">Buscar<input name="query" defaultValue={filters.query} placeholder="Número o referencia" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
        <label className="text-sm font-medium">Estado<select name="status" defaultValue={filters.status} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="all">Todos</option>{Object.entries(purchaseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Proveedor<select name="supplierId" defaultValue={filters.supplierId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todos</option>{suppliers.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
        <button className="self-end rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Filtrar</button>
      </form>
      {result.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{result.items.map((item) => <Link key={item.id} href={`/app/compras/${item.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300"><div className="flex justify-between gap-3"><h2 className="font-semibold">{item.purchaseNumber}</h2><OperationalStatusBadge label={purchaseStatusLabels[item.status]} /></div><p className="mt-3 text-sm text-neutral-700">{item.supplierName}</p><div className="mt-4 flex justify-between text-sm"><span>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(item.orderedAt))}</span><strong>{new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(item.totalAmount)}</strong></div></Link>)}</div> : <OperationalEmpty>No se encontraron compras.</OperationalEmpty>}
      <OperationalPagination basePath="/app/compras" page={result.page} pageCount={result.pageCount} params={{ query: filters.query, status: filters.status === "all" ? "" : filters.status, supplierId: filters.supplierId }} />
    </section>;
}
