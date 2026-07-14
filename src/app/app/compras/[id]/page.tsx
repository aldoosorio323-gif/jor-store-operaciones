import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchaseActions, PurchaseForm, PurchaseItemForm, PurchaseReceiptForm, RemovePurchaseItemButton } from "@/components/inventory/inventory-forms";
import { OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { canEditPurchase, canReceivePurchase, purchaseStatusLabels } from "@/features/inventory/domain";
import { requireActiveUser } from "@/lib/auth/session";
import { getPurchase, listLocationOptions, listSupplierOptions, listVariantOptions } from "@/services/inventory";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveUser();
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const [suppliers, variants, locations] = await Promise.all([listSupplierOptions(), listVariantOptions(), listLocationOptions()]);
  const editable = canEditPurchase(purchase.status);
  const receivable = canReceivePurchase(purchase.status);
  const nextLine = Math.max(0, ...purchase.items.map((item) => item.lineNumber)) + 1;
  const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
  return <section><Link href="/app/compras" className="text-sm font-semibold text-emerald-800">← Volver a compras</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold text-emerald-950">{purchase.purchaseNumber}</h1><p className="mt-2 text-neutral-600">{purchase.supplierName}</p></div><OperationalStatusBadge label={purchaseStatusLabels[purchase.status]} /></div>
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">{editable ? <PurchaseForm suppliers={suppliers} purchase={purchase} /> : <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-neutral-500">Referencia</dt><dd>{purchase.supplierReference ?? "—"}</dd></div><div><dt className="text-neutral-500">Fecha esperada</dt><dd>{purchase.expectedAt ?? "—"}</dd></div><div><dt className="text-neutral-500">Moneda</dt><dd>PEN</dd></div></dl>}</div>
    <div className="mt-6"><PurchaseActions id={purchase.id} canConfirm={editable && purchase.items.length > 0} canCancel={purchase.status === "draft" || purchase.status === "confirmed"} /></div>
    <div className="mt-8 flex items-center justify-between"><h2 className="text-xl font-semibold">LÃ­neas</h2><div className="text-right text-sm"><p>Subtotal {money.format(purchase.subtotal)}</p><p>Impuesto {money.format(purchase.taxAmount)}</p><p className="font-semibold">Total {money.format(purchase.totalAmount)}</p></div></div>
    <div className="mt-4 grid gap-4">{purchase.items.map((item) => <article key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{item.lineNumber}. {item.variantLabel}</h3><p className="mt-1 text-sm text-neutral-600">Pedido {item.orderedQuantity} · recibido {item.receivedQuantity} · pendiente {item.orderedQuantity - item.receivedQuantity}</p></div><strong>{money.format(item.lineTotal)}</strong></div>{editable ? <div className="mt-4 space-y-3"><PurchaseItemForm purchaseId={purchase.id} variants={variants} item={item} nextLine={nextLine} /><RemovePurchaseItemButton id={item.id} /></div> : null}{receivable && item.receivedQuantity < item.orderedQuantity ? <div className="mt-4 border-t pt-4"><PurchaseReceiptForm item={item} locations={locations} /></div> : null}</article>)}</div>
    {editable ? <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5"><h2 className="font-semibold">AÃ±adir lÃ­nea</h2><div className="mt-4"><PurchaseItemForm purchaseId={purchase.id} variants={variants} nextLine={nextLine} /></div></div> : null}
  </section>;
}
