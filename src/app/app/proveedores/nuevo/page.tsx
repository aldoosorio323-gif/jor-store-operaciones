import { SupplierForm } from "@/components/catalogs/catalog-forms";
import { requireAdministrator } from "@/lib/auth/session";
import { PageHeader,SectionCard } from "@/components/ui/operational-ui";
export default async function NewSupplierPage() { await requireAdministrator(); return <section className="max-w-4xl"><PageHeader title="Nuevo proveedor" description="La información es privada y no se incorpora a logs operativos." backHref="/app/proveedores" backLabel="Volver a proveedores"/><SectionCard title="Datos del proveedor"><SupplierForm /></SectionCard></section>; }
