import { WarehouseForm } from "@/components/catalogs/catalog-forms";
import { requireAdministrator } from "@/lib/auth/session";
import { PageHeader,SectionCard } from "@/components/ui/operational-ui";
export default async function NewWarehousePage() { await requireAdministrator(); return <section className="max-w-4xl"><PageHeader title="Nuevo almacén" description="Crea el almacén antes de registrar sus ubicaciones internas." backHref="/app/almacenes" backLabel="Volver a almacenes"/><SectionCard title="Datos del almacén"><WarehouseForm /></SectionCard></section>; }
