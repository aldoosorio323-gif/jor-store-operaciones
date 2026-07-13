import { requireActiveUser } from "@/lib/auth/session";

export default async function PrivateHomePage() {
  const user = await requireActiveUser();

  return (
    <section className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
        Etapa 2
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-emerald-950">
        Hola, {user.displayName}
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-neutral-600">
        Los catálogos de productos, almacenes y proveedores ya forman la base
        operativa del sistema. En esta etapa todavía no existen existencias.
      </p>
      <div className="mt-7 rounded-2xl bg-amber-100 p-4 text-sm leading-6 text-amber-950">
        JOR STORE Operaciones continúa en construcción. Esta pantalla no es un
        dashboard y no muestra stock, pedidos ni compras.
      </div>
    </section>
  );
}
