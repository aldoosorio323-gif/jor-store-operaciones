import Link from "next/link";
import { notFound } from "next/navigation";
import { RemoveTransferItemButton, TransferActions, TransferForm, TransferItemForm, TransferReceiptForm } from "@/components/inventory/inventory-forms";
import { OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { canEditTransfer, canReceiveTransfer, transferStatusLabels } from "@/features/inventory/domain";
import { requireActiveUser } from "@/lib/auth/session";
import { getTransfer, listLocationOptions, listVariantOptions, listWarehouseOptions } from "@/services/inventory";

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveUser();
  const { id } = await params;
  const transfer = await getTransfer(id);
  if (!transfer) notFound();
  const [warehouses, variants, locations] = await Promise.all([listWarehouseOptions(), listVariantOptions(), listLocationOptions()]);
  const editable = canEditTransfer(transfer.status);
  const receivable = canReceiveTransfer(transfer.status);
  const nextLine = Math.max(0, ...transfer.items.map((item) => item.lineNumber)) + 1;
  return <section><Link href="/app/transferencias" className="text-sm font-semibold text-emerald-800">← Volver a transferencias</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">{transfer.transferNumber}</h1><p className="mt-2 text-neutral-600">{transfer.originWarehouseName} → {transfer.destinationWarehouseName}</p></div><OperationalStatusBadge label={transferStatusLabels[transfer.status]} /></div>
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">{editable ? <TransferForm warehouses={warehouses} transfer={transfer} /> : <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-neutral-500">Confirmada</dt><dd>{transfer.confirmedAt ?? "—"}</dd></div><div><dt className="text-neutral-500">Despachada</dt><dd>{transfer.dispatchedAt ?? "—"}</dd></div><div><dt className="text-neutral-500">Recibida</dt><dd>{transfer.receivedAt ?? "—"}</dd></div></dl>}</div>
    <div className="mt-6"><TransferActions transfer={transfer} /></div>
    <h2 className="mt-8 text-xl font-semibold">Líneas</h2><div className="mt-4 grid gap-4">{transfer.items.map((item) => <article key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><h3 className="font-semibold">{item.lineNumber}. {item.variantLabel}</h3><p className="mt-2 text-sm text-neutral-600">{item.originLocationName} → {item.destinationLocationName}</p><dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-neutral-500">Solicitado</dt><dd>{item.requestedQuantity}</dd></div><div><dt className="text-neutral-500">Despachado</dt><dd>{item.dispatchedQuantity}</dd></div><div><dt className="text-neutral-500">Pendiente</dt><dd>{item.dispatchedQuantity - item.receivedQuantity}</dd></div></dl>{editable ? <div className="mt-4 space-y-3"><TransferItemForm transfer={transfer} variants={variants} locations={locations} item={item} nextLine={nextLine} /><RemoveTransferItemButton id={item.id} /></div> : null}{receivable && item.receivedQuantity < item.dispatchedQuantity ? <div className="mt-4 border-t pt-4"><TransferReceiptForm item={item} /></div> : null}</article>)}</div>
    {editable ? <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5"><h2 className="font-semibold">Añadir línea</h2><div className="mt-4"><TransferItemForm transfer={transfer} variants={variants} locations={locations} nextLine={nextLine} /></div></div> : null}
  </section>;
}
