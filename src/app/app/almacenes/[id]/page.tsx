import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogStatusButton, LocationForm, WarehouseForm } from "@/components/catalogs/catalog-forms";
import { EmptyState, StatusBadge } from "@/components/catalogs/catalog-ui";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { getWarehouse, listWarehouseLocations } from "@/services/catalogs";
import { catalogEntityIdSchema } from "@/validations/catalogs";

const locationLabels = { storage: "Almacenamiento", picking: "Picking", quarantine: "Cuarentena", in_transit: "En tránsito" } as const;

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser(); const parsed = catalogEntityIdSchema.safeParse(await params); if (!parsed.success) notFound();
  const [warehouse, locations] = await Promise.all([getWarehouse(parsed.data.id), listWarehouseLocations(parsed.data.id)]); if (!warehouse) notFound();
  const isAdministrator = canManageCatalogs(user.role);
  return <section className="space-y-8"><div><Link href="/app/almacenes" className="text-sm font-semibold text-emerald-800">← Volver a almacenes</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">{warehouse.code}</p><div className="mt-1 flex items-center gap-3"><h1 className="text-3xl font-semibold text-emerald-950">{warehouse.name}</h1><StatusBadge active={warehouse.isActive} /></div><p className="mt-2 text-neutral-600">{warehouse.description ?? "Sin descripción."}</p></div>{isAdministrator ? <CatalogStatusButton id={warehouse.id} isActive={warehouse.isActive} entity="warehouse" /> : null}</div></div>
    {isAdministrator ? <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-xl font-semibold">Editar almacén</h2><WarehouseForm warehouse={warehouse} /></section> : <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">Tu rol permite consultar este catálogo, pero no modificarlo.</p>}
    <section><h2 className="text-2xl font-semibold text-emerald-950">Ubicaciones</h2><p className="mt-1 text-sm text-neutral-600">Zonas internas del almacén. Todavía no contienen balances de stock.</p>{isAdministrator ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="mb-4 font-semibold">Añadir ubicación</h3><LocationForm warehouseId={warehouse.id} /></div> : null}
      {locations.length ? <div className="mt-5 space-y-4">{locations.map((location) => <article key={location.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{location.code} · {location.name}</h3><StatusBadge active={location.isActive} /></div><p className="mt-1 text-sm text-neutral-600">{locationLabels[location.locationType]}</p></div>{isAdministrator ? <CatalogStatusButton id={location.id} isActive={location.isActive} entity="location" /> : null}</div>{isAdministrator ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-800">Editar ubicación</summary><div className="mt-4"><LocationForm warehouseId={warehouse.id} location={location} /></div></details> : null}</article>)}</div> : <EmptyState>Este almacén todavía no tiene ubicaciones visibles.</EmptyState>}
    </section>
  </section>;
}
