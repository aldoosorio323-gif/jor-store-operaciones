import { ProductForm } from "@/components/catalogs/catalog-forms";
import { requireAdministrator } from "@/lib/auth/session";
import { PageHeader, SectionCard } from "@/components/ui/operational-ui";

export default async function NewProductPage() {
  await requireAdministrator();
  return <section className="max-w-4xl"><PageHeader title="Nuevo producto" description="Define la información comercial base; las variantes se añadirán después." backHref="/app/productos" backLabel="Volver a productos"/><SectionCard title="Datos del producto"><ProductForm /></SectionCard></section>;
}
