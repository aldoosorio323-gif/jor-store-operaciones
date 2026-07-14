import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogStatusButton, ProductForm, VariantForm } from "@/components/catalogs/catalog-forms";
import { EmptyState, StatusBadge } from "@/components/catalogs/catalog-ui";
import { canManageCatalogs } from "@/features/catalogs/permissions";
import { requireActiveUser } from "@/lib/auth/session";
import { getProduct, listProductVariants } from "@/services/catalogs";
import { catalogEntityIdSchema } from "@/validations/catalogs";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser();
  const parsed = catalogEntityIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [product, variants] = await Promise.all([getProduct(parsed.data.id), listProductVariants(parsed.data.id)]);
  if (!product) notFound();
  const isAdministrator = canManageCatalogs(user.role);
  return (
    <section className="space-y-8">
      <div><Link href="/app/productos" className="text-sm font-semibold text-emerald-800">← Volver a productos</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h1 className="text-3xl font-semibold text-emerald-950">{product.name}</h1><StatusBadge active={product.isActive} /></div><p className="mt-2 text-neutral-600">{product.description ?? "Sin descripción."}</p></div>{isAdministrator ? <CatalogStatusButton id={product.id} isActive={product.isActive} entity="product" /> : null}</div></div>
      {isAdministrator ? <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-xl font-semibold">Editar producto</h2><ProductForm product={product} /></section> : <ReadOnlyNotice />}
      <section><h2 className="text-2xl font-semibold text-emerald-950">Variantes</h2><p className="mt-1 text-sm text-neutral-600">SKU, presentación y precio de venta. El stock se consulta en Inventario.</p>
        {isAdministrator ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="mb-4 font-semibold">Añadir variante</h3><VariantForm productId={product.id} /></div> : null}
        {variants.length ? <div className="mt-5 space-y-4">{variants.map((variant) => <article key={variant.id} className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{variant.name}</h3><StatusBadge active={variant.isActive} /></div><p className="mt-1 text-sm text-neutral-600">SKU {variant.sku} · {variant.color ?? "Sin color"} · S/ {variant.salePrice.toFixed(2)}</p></div>{isAdministrator ? <CatalogStatusButton id={variant.id} isActive={variant.isActive} entity="variant" /> : null}</div>{isAdministrator ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-800">Editar variante</summary><div className="mt-4"><VariantForm productId={product.id} variant={variant} /></div></details> : null}</article>)}</div> : <EmptyState>Este producto todavía no tiene variantes visibles.</EmptyState>}
      </section>
    </section>
  );
}

function ReadOnlyNotice() { return <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">Tu rol permite consultar este catálogo, pero no modificarlo.</p>; }
