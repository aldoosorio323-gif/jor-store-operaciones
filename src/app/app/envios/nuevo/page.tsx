import { ShipmentForm } from "@/components/shipping/shipping-forms";
import { PageHeader,SectionCard } from "@/components/ui/operational-ui";
import { requireActiveUser } from "@/lib/auth/session";
import { listCarrierOptions,listShippableOrderOptions } from "@/services/shipping";
export default async function Page(){await requireActiveUser();const [orders,carriers]=await Promise.all([listShippableOrderOptions(),listCarrierOptions()]);return <section><PageHeader title="Nuevo envío" description="Registra una instantánea del destinatario sin alterar el pedido." backHref="/app/envios"/><SectionCard><ShipmentForm orders={orders} carriers={carriers}/></SectionCard></section>}
