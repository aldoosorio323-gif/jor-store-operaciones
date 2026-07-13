import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/types/database";

export type AdminUserListItem = {
  id: string;
  email: string;
  displayName: string;
  role: RoleCode;
  roleName: string;
  isActive: boolean;
};

export async function listUsersForAdministrator(): Promise<
  AdminUserListItem[]
> {
  const [supabase, admin] = await Promise.all([
    createClient(),
    Promise.resolve(createAdminClient()),
  ]);

  const [{ data: profiles, error: profilesError }, authUsersResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, is_active, role_id")
        .order("display_name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    ]);

  if (profilesError || authUsersResult.error) {
    throw new Error("No fue posible consultar los usuarios.");
  }

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, code, name");

  if (rolesError) throw new Error("No fue posible consultar los roles.");

  const authUsersById = new Map(
    authUsersResult.data.users.map((user) => [user.id, user]),
  );
  const rolesById = new Map(roles.map((role) => [role.id, role]));

  return profiles.map((profile) => {
    const authUser = authUsersById.get(profile.id);
    const role = rolesById.get(profile.role_id);

    if (!authUser?.email || !role) {
      throw new Error("Existe un perfil incompleto que requiere revisión.");
    }

    return {
      id: profile.id,
      email: authUser.email,
      displayName: profile.display_name,
      role: role.code,
      roleName: role.name,
      isActive: profile.is_active,
    };
  });
}
