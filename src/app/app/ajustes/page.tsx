import { InventoryAdjustmentForm } from "@/components/inventory/inventory-forms";
import { EmptyState, FormField, PageHeader, SectionCard, buttonStyles, fieldClass } from "@/components/ui/operational-ui";
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
  return <section className="mx-auto max-w-4xl"><PageHeader title="Ajustes de inventario" description="Solo administradores. Consulta el saldo exacto antes de registrar un movimiento compensatorio." />
    <SectionCard title="Seleccionar balance" description="La variante y la ubicación determinan el balance que será bloqueado al ajustar."><form className="grid gap-4 sm:grid-cols-3"><FormField label="Variante" required><select name="variantId" defaultValue={filters.variantId} required className={fieldClass}><option value="">Selecciona</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FormField><FormField label="Almacén" required><select name="warehouseId" defaultValue={filters.warehouseId} required className={fieldClass}><option value="">Selecciona</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FormField><FormField label="Ubicación" required><select name="locationId" defaultValue={filters.locationId} required className={fieldClass}><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FormField><button className={`${buttonStyles.primary} sm:col-span-3`}>Consultar saldo</button></form></SectionCard>
    <div className="mt-6">{selectedVariant && selectedLocation ? <SectionCard title="Registrar ajuste"><InventoryAdjustmentForm selectedVariant={selectedVariant} selectedLocation={selectedLocation} balance={balance} /></SectionCard> : <EmptyState title="Selecciona un balance" description="Elige una variante, un almacén y una ubicación para consultar el saldo antes de ajustar." icon="adjustments"/>}</div>
  </section>;
}
