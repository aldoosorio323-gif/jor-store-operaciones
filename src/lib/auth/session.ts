import "server-only";

import { redirect } from "next/navigation";
import { EnvironmentConfigurationError } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/types/database";

export type CurrentUserContext = {
  id: string;
  email: string;
  displayName: string;
  isActive: true;
  role: RoleCode;
  roleName: string;
};

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const [activeResult, roleResult] = await Promise.all([
    supabase.rpc("current_user_is_active"),
    supabase.rpc("current_user_role"),
  ]);

  if (activeResult.data !== true || !roleResult.data) return null;

  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, is_active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("roles")
      .select("name")
      .eq("code", roleResult.data)
      .maybeSingle(),
  ]);

  if (!profile?.is_active || !role) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: profile.display_name,
    isActive: true,
    role: roleResult.data,
    roleName: role.name,
  };
}

export async function requireActiveUser(): Promise<CurrentUserContext> {
  try {
    const context = await getCurrentUserContext();
    if (context) return context;
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      redirect("/login?error=config");
    }
    throw error;
  }

  redirect("/login");
}

export async function requireAdministrator(): Promise<CurrentUserContext> {
  const context = await requireActiveUser();
  if (context.role !== "administrator") redirect("/app");
  return context;
}
