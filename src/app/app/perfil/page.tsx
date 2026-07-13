import { requireActiveUser } from "@/lib/auth/session";

export default async function ProfilePage() {
  const user = await requireActiveUser();

  return (
    <section>
      <h1 className="text-3xl font-semibold text-emerald-950">Mi perfil</h1>
      <p className="mt-2 text-neutral-600">Información de la cuenta autenticada.</p>
      <dl className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white px-5">
        <ProfileItem label="Nombre" value={user.displayName} />
        <ProfileItem label="Correo" value={user.email} />
        <ProfileItem label="Rol" value={user.roleName} />
        <ProfileItem label="Estado" value="Activo" />
      </dl>
      <p className="mt-4 text-sm text-neutral-500">
        El rol y el estado solo pueden cambiarse mediante una operación administrativa auditada.
      </p>
    </section>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-3">
      <dt className="text-sm font-medium text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900 sm:col-span-2">{value}</dd>
    </div>
  );
}
