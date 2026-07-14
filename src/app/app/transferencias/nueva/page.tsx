import { TransferForm } from "@/components/inventory/inventory-forms";
import { requireActiveUser } from "@/lib/auth/session";
import { listWarehouseOptions } from "@/services/inventory";
import { PageHeader,SectionCard } from "@/components/ui/operational-ui";

export default async function NewTransferPage() {
  await requireActiveUser();
  const warehouses = await listWarehouseOptions();
  return <section className="max-w-4xl"><PageHeader title="Nueva transferencia" description="El número se genera en servidor. Origen y destino deben ser distintos." backHref="/app/transferencias" backLabel="Volver a transferencias"/><SectionCard title="Datos de la transferencia"><TransferForm warehouses={warehouses} /></SectionCard></section>;
}
