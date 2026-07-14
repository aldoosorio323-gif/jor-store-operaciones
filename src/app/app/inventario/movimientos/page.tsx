import Link from "next/link";
import { OperationalEmpty, OperationalError, OperationalPagination, OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { movementTypeLabels } from "@/features/inventory/domain";
import { parseInventoryFilters } from "@/features/inventory/filters";
import { requireActiveUser } from "@/lib/auth/session";
import { listInventoryMovements, listLocationOptions, listVariantOptions, listWarehouseOptions } from "@/services/inventory";

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const filters = parseInventoryFilters(await searchParams);
  let result;
  let warehouses;
  let variants;
  let locations;
  try {
    [result, warehouses, variants, locations] = await Promise.all([
      listInventoryMovements(filters), listWarehouseOptions(), listVariantOptions(), listLocationOptions(),
    ]);
  } catch { return <OperationalError title="Movimientos de inventario" />; }
  return <section><Link href="/app/inventario" className="text-sm font-semibold text-emerald-800">← Volver a balances</Link><h1 className="mt-4 text-3xl font-semibold text-emerald-950">Movimientos</h1><p className="mt-2 text-neutral-600">Libro mayor inmutable: antes, delta y despuÃ©s.</p>
      <form className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4"><label className="text-sm font-medium">Buscar<input name="query" defaultValue={filters.query} placeholder="Producto, SKU o ubicaciÃ³n" className="mt-2 w-full rounded-xl border px-4 py-3" /></label><label className="text-sm font-medium">Variante<select name="variantId" defaultValue={filters.variantId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todas</option>{variants.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label className="text-sm font-medium">AlmacÃ©n<select name="warehouseId" defaultValue={filters.warehouseId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todos</option>{warehouses.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label className="text-sm font-medium">UbicaciÃ³n<select name="locationId" defaultValue={filters.locationId} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todas</option>{locations.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label className="text-sm font-medium">Tipo<select name="movementType" defaultValue={filters.movementType} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Todos</option>{Object.entries(movementTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Desde<input name="dateFrom" type="date" defaultValue={filters.dateFrom} className="mt-2 w-full rounded-xl border px-4 py-3" /></label><label className="text-sm font-medium">Hasta<input name="dateTo" type="date" defaultValue={filters.dateTo} className="mt-2 w-full rounded-xl border px-4 py-3" /></label><button className="self-end rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Filtrar</button></form>
      {result.items.length ? <div className="mt-6 grid gap-4">{result.items.map((item) => <article key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-emerald-800">{item.sku}</p><h2 className="font-semibold">{item.variantLabel}</h2></div><OperationalStatusBadge label={movementTypeLabels[item.movementType]} /></div><p className="mt-2 text-sm text-neutral-600">{item.warehouseLabel} · {item.locationLabel}</p><dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-neutral-500">Antes</dt><dd>{item.previousPhysical}</dd></div><div><dt className="text-neutral-500">Delta</dt><dd className={item.physicalDelta > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{item.physicalDelta > 0 ? "+" : ""}{item.physicalDelta}</dd></div><div><dt className="text-neutral-500">DespuÃ©s</dt><dd>{item.resultingPhysical}</dd></div></dl><p className="mt-3 text-xs text-neutral-500">{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(item.occurredAt))}{item.reason ? ` · ${item.reason}` : ""}</p></article>)}</div> : <OperationalEmpty>No se encontraron movimientos.</OperationalEmpty>}
      <OperationalPagination basePath="/app/inventario/movimientos" page={result.page} pageCount={result.pageCount} params={{ query: filters.query, variantId: filters.variantId, warehouseId: filters.warehouseId, locationId: filters.locationId, movementType: filters.movementType, dateFrom: filters.dateFrom, dateTo: filters.dateTo }} />
    </section>;
}
