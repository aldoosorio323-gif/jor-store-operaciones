import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchaseActions, PurchaseForm, PurchaseItemForm, PurchaseReceiptForm, RemovePurchaseItemButton } from "@/components/inventory/inventory-forms";
import { OperationalStatusBadge } from "@/components/inventory/inventory-ui";
import { PageHeader, SectionCard, formatPEN } from "@/components/ui/operational-ui";
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
  return <section>
    <Link href="/app/compras" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">← Volver a compras</Link>
    <div className="mt-4"><PageHeader title={purchase.purchaseNumber} description={purchase.supplierName} action={<OperationalStatusBadge label={purchaseStatusLabels[purchase.status]} />} /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <SectionCard title="Datos de la compra" description={editable ? "Puedes editar la cabecera mientras la compra permanezca en borrador." : "La cabecera está protegida por el estado actual de la compra."}>
          {editable ? <PurchaseForm suppliers={suppliers} purchase={purchase} /> : <dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Referencia</dt><dd className="mt-1 font-medium text-slate-900">{purchase.supplierReference ?? "—"}</dd></div><div><dt className="text-slate-500">Fecha esperada</dt><dd className="mt-1 font-medium text-slate-900">{purchase.expectedAt ?? "—"}</dd></div><div><dt className="text-slate-500">Moneda</dt><dd className="mt-1 font-medium text-slate-900">PEN</dd></div></dl>}
        </SectionCard>
        <section aria-labelledby="purchase-lines-title">
          <div className="mb-4"><h2 id="purchase-lines-title" className="text-lg font-semibold text-slate-950">Líneas de compra</h2><p className="mt-1 text-sm text-slate-600">Cantidades pedidas, recibidas y pendientes por variante.</p></div>
          <div className="grid gap-4">{purchase.items.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{item.lineNumber}. {item.variantLabel}</h3><p className="mt-1 text-sm text-slate-600">Pedido {item.orderedQuantity} · recibido {item.receivedQuantity} · pendiente {item.orderedQuantity - item.receivedQuantity}</p></div><strong className="tabular-nums text-slate-950">{formatPEN(item.lineTotal)}</strong></div>{editable ? <div className="mt-5 space-y-3 border-t border-slate-100 pt-5"><PurchaseItemForm purchaseId={purchase.id} variants={variants} item={item} nextLine={nextLine} /><RemovePurchaseItemButton id={item.id} /></div> : null}{receivable && item.receivedQuantity < item.orderedQuantity ? <div className="mt-5 border-t border-slate-100 pt-5"><PurchaseReceiptForm item={item} locations={locations} /></div> : null}</article>)}</div>
        </section>
        {editable ? <SectionCard title="Añadir línea" description="Selecciona la variante y conserva su costo histórico de compra."><PurchaseItemForm purchaseId={purchase.id} variants={variants} nextLine={nextLine} /></SectionCard> : null}
      </div>
      <aside className="self-start lg:sticky lg:top-6">
        <SectionCard title="Resumen" description={`${purchase.items.length} ${purchase.items.length === 1 ? "línea" : "líneas"}`}>
          <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums text-slate-900">{formatPEN(purchase.subtotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-600">Impuesto</dt><dd className="tabular-nums text-slate-900">{formatPEN(purchase.taxAmount)}</dd></div><div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPEN(purchase.totalAmount)}</dd></div></dl>
          <div className="mt-5 border-t border-slate-100 pt-5"><PurchaseActions id={purchase.id} canConfirm={editable && purchase.items.length > 0} canCancel={purchase.status === "draft" || purchase.status === "confirmed"} /></div>
        </SectionCard>
      </aside>
    </div>
  </section>;
}
