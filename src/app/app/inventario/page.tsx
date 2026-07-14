import Link from "next/link";
import { OperationalEmpty, OperationalError, OperationalPagination } from "@/components/inventory/inventory-ui";
import { parseInventoryFilters } from "@/features/inventory/filters";
import { requireActiveUser } from "@/lib/auth/session";
import { listInventoryBalances, listWarehouseOptions } from "@/services/inventory";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const filters = parseInventoryFilters(await searchParams);
  let result;
  let warehouses;
  try {
    [result, warehouses] = await Promise.all([listInventoryBalances(filters), listWarehouseOptions()]);
  } catch { return <OperationalError title="Inventario" />; }
  const totals = result.items.reduce((value, item) => ({ physical: value.physical + item.physicalStock, reserved: value.reserved + item.reservedStock, available: value.available + item.availableStock }), { physical: 0, reserved: 0, available: 0 });
  return <section><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">Inventario</h1><p className="mt-2 text-neutral-600">Balances por variante, almacÃ©n y ubicaciÃ³n. No hay ediciÃ³n directa.</p></div><Link href="/app/inventario/movimientos" className="rounded-xl border border-emerald-800 bg-white px-5 py-3 font-semibold text-emerald-900">Ver movimientos</Link></div>
      <form className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4"><label className="text-sm font-medium">Buscar<input name="query" defaultValue={filters.query} placeholder="Producto, SKU o ubicaciÃ³n" className="mt-2 w-full rounded-xl border px-4 py-3" /></label><label className="text-sm font-medium">AlmacÃ©n<select name="warehouseId" defaultValue={filters.warehouseId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todos</option>{warehouses.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label className="flex items-center gap-2 self-end rounded-xl border px-4 py-3 text-sm"><input type="checkbox" name="positiveOnly" value="true" defaultChecked={filters.positiveOnly} /> Solo disponible positivo</label><button className="self-end rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Filtrar</button></form>
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-emerald-950 p-4 text-center text-white"><div><p className="text-xs text-emerald-200">FÃ­sico en pÃ¡gina</p><strong>{totals.physical}</strong></div><div><p className="text-xs text-emerald-200">Reservado</p><strong>{totals.reserved}</strong></div><div><p className="text-xs text-emerald-200">Disponible</p><strong>{totals.available}</strong></div></div>
      {result.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{result.items.map((item) => <article key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold text-emerald-800">{item.sku}</p><h2 className="font-semibold">{item.variantLabel}</h2></div><span className="text-sm text-neutral-500">v{item.version}</span></div><p className="mt-3 text-sm text-neutral-600">{item.warehouseLabel}<br />{item.locationLabel}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-neutral-500">FÃ­sico</dt><dd className="font-semibold">{item.physicalStock}</dd></div><div><dt className="text-neutral-500">Reservado</dt><dd>{item.reservedStock}</dd></div><div><dt className="text-neutral-500">Disponible</dt><dd>{item.availableStock}</dd></div><div><dt className="text-neutral-500">Costo promedio</dt><dd>S/ {item.averageUnitCost.toFixed(4)}</dd></div></dl></article>)}</div> : <OperationalEmpty>No hay balances con estos filtros.</OperationalEmpty>}
      <OperationalPagination basePath="/app/inventario" page={result.page} pageCount={result.pageCount} params={{ query: filters.query, warehouseId: filters.warehouseId, positiveOnly: filters.positiveOnly }} />
    </section>;
}
