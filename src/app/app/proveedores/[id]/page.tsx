import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogStatusButton, SupplierForm } from "@/components/catalogs/catalog-forms";
import { StatusBadge } from "@/components/catalogs/catalog-ui";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { getSupplier } from "@/services/catalogs";
import { catalogEntityIdSchema } from "@/validations/catalogs";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser(); const parsed = catalogEntityIdSchema.safeParse(await params); if (!parsed.success) notFound();
  const supplier = await getSupplier(parsed.data.id); if (!supplier) notFound(); const isAdministrator = canManageCatalogs(user.role);
  return <section className="mx-auto max-w-3xl space-y-7"><div><Link href="/app/proveedores" className="text-sm font-semibold text-emerald-800">← Volver a proveedores</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">{supplier.code}</p><div className="mt-1 flex items-center gap-3"><h1 className="text-3xl font-semibold text-emerald-950">{supplier.businessName}</h1><StatusBadge active={supplier.isActive} /></div></div>{isAdministrator ? <CatalogStatusButton id={supplier.id} isActive={supplier.isActive} entity="supplier" /> : null}</div></div>
    {isAdministrator ? <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-xl font-semibold">Editar proveedor</h2><SupplierForm supplier={supplier} /></section> : <section className="rounded-2xl border border-neutral-200 bg-white p-5"><h2 className="font-semibold">Información de consulta</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><Item label="Identificación tributaria" value={supplier.taxId} /><Item label="Contacto" value={supplier.contactName} /><Item label="Correo" value={supplier.email} /><Item label="Teléfono" value={supplier.phone} /></dl><p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Tu rol permite consultar proveedores activos, pero no modificarlos.</p></section>}
  </section>;
}
function Item({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-sm text-neutral-500">{label}</dt><dd className="mt-1 font-medium">{value ?? "—"}</dd></div>; }
