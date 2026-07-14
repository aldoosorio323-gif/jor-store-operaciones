import { EnvironmentConfigurationError } from "@/lib/env";
import { requireAdministrator } from "@/lib/auth/session";
import { UserManagement } from "@/components/users/user-management";
import { listUsersForAdministrator } from "@/services/user-admin";
import { Feedback, PageHeader } from "@/components/ui/operational-ui";

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
      <Feedback tone="warning"><strong>Configuración pendiente.</strong> {message}</Feedback>
    );
  }

  return (
    <section>
      <PageHeader title="Usuarios" description="Invitaciones, roles y activación con autorización exclusiva del servidor." />
      <div>
        <UserManagement users={users} currentUserId={administrator.id} />
      </div>
    </section>
  );
}
