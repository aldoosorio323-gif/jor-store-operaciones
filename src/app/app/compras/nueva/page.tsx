import { PurchaseForm } from "@/components/inventory/inventory-forms";
import { requireActiveUser } from "@/lib/auth/session";
import { listSupplierOptions } from "@/services/inventory";
import { PageHeader,SectionCard } from "@/components/ui/operational-ui";

export default async function NewPurchasePage() {
  await requireActiveUser();
  const suppliers = await listSupplierOptions();
  return <section className="max-w-4xl"><PageHeader title="Nueva compra" description="El número y los totales se generan exclusivamente en PostgreSQL." backHref="/app/compras" backLabel="Volver a compras"/><SectionCard title="Datos de la compra"><PurchaseForm suppliers={suppliers} /></SectionCard></section>;
}
