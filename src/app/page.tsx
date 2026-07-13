export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          JOR STORE
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950 sm:text-4xl">
          Operaciones internas
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
          Base técnica de la aplicación privada. La Etapa 0 define arquitectura,
          seguridad y reglas de inventario; los módulos operativos se incorporarán
          por etapas.
        </p>
        <div className="mt-8 inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
          Etapa 0 · Inicialización y diseño técnico
        </div>
      </section>
    </main>
  );
}
