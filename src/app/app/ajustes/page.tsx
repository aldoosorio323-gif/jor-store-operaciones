import { InventoryAdjustmentForm } from "@/components/inventory/inventory-forms";
import { parseInventoryFilters } from "@/features/inventory/filters";
import { requireAdministrator } from "@/lib/auth/session";
import { listInventoryBalances, listLocationOptions, listVariantOptions, listWarehouseOptions } from "@/services/inventory";

export default async function AdjustmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdministrator();
  const filters = parseInventoryFilters(await searchParams);
  const [variants, warehouses, locations] = await Promise.all([
    listVariantOptions(), listWarehouseOptions(), listLocationOptions(),
  ]);
  const selectedVariant = variants.find((item) => item.id === filters.variantId);
  const selectedWarehouse = warehouses.find((item) => item.id === filters.warehouseId);
  const selectedLocation = locations.find((item) => item.id === filters.locationId && item.warehouseId === selectedWarehouse?.id);
  const balanceResult = selectedVariant && selectedLocation
    ? await listInventoryBalances({ ...filters, page: 1, query: "", warehouseId: selectedLocation.warehouseId, positiveOnly: false })
    : null;
  const balance = balanceResult?.items.find((item) => item.variantId === selectedVariant?.id && item.locationId === selectedLocation?.id);
  return <section className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold text-emerald-950">Ajustes de inventario</h1><p className="mt-2 text-neutral-600">Solo administradores. Primero consulta el saldo exacto por variante, almacén y ubicación.</p>
    <form className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-3"><label className="text-sm font-medium">Variante<select name="variantId" defaultValue={filters.variantId} required className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3"><option value="">Selecciona</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Almacén<select name="warehouseId" defaultValue={filters.warehouseId} required className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3"><option value="">Selecciona</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Ubicación<select name="locationId" defaultValue={filters.locationId} required className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3"><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white sm:col-span-3">Consultar saldo</button></form>
    {selectedVariant && selectedLocation ? <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><InventoryAdjustmentForm selectedVariant={selectedVariant} selectedLocation={selectedLocation} balance={balance} /></div> : <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600">Selecciona una variante y una ubicación para consultar el saldo antes de ajustar.</p>}
  </section>;
}
