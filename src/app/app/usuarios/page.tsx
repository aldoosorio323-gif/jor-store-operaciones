import { EnvironmentConfigurationError } from "@/lib/env";
import { requireAdministrator } from "@/lib/auth/session";
import { UserManagement } from "@/components/users/user-management";
import { listUsersForAdministrator } from "@/services/user-admin";

export default async function UsersPage() {
  const administrator = await requireAdministrator();
  let users;
  let loadError: unknown;

  try {
    users = await listUsersForAdministrator();
  } catch (error) {
    loadError = error;
  }

  if (!users) {
    const message =
      loadError instanceof EnvironmentConfigurationError
        ? "Falta configurar SUPABASE_SERVICE_ROLE_KEY en .env.local."
        : "No fue posible cargar la administración de usuarios.";

    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-2xl font-semibold text-amber-950">Configuración pendiente</h1>
        <p className="mt-2 text-amber-900">{message}</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold text-emerald-950">Administrar usuarios</h1>
      <p className="mt-2 text-neutral-600">
        Invitaciones, roles y activación con control exclusivo del servidor.
      </p>
      <div className="mt-7">
        <UserManagement users={users} currentUserId={administrator.id} />
      </div>
    </section>
  );
}
