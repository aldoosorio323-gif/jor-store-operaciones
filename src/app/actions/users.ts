"use server";

import { revalidatePath } from "next/cache";
import { buildAuthCallbackUrl } from "@/lib/auth/redirects";
import { getCurrentUserContext } from "@/lib/auth/session";
import { EnvironmentConfigurationError } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";
import { inviteUserSchema, updateUserAccessSchema } from "@/validations/auth";

async function getAdminClients() {
  const context = await getCurrentUserContext();
  if (!context || context.role !== "administrator") return null;

  return {
    context,
    supabase: await createClient(),
    admin: createAdminClient(),
  };
}

export async function inviteUserAction(input: unknown): Promise<ActionResult> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const clients = await getAdminClients();
    if (!clients) return { ok: false, message: "Acción no autorizada." };

    const { data, error } = await clients.admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo: buildAuthCallbackUrl("/reset-password"),
        data: { display_name: parsed.data.displayName },
      },
    );

    if (error || !data.user) {
      return { ok: false, message: "No fue posible enviar la invitación." };
    }

    const { error: profileError } = await clients.supabase.rpc(
      "admin_update_profile",
      {
        p_profile_id: data.user.id,
        p_role_code: parsed.data.role,
        p_is_active: true,
        p_display_name: parsed.data.displayName,
      },
    );

    if (profileError) {
      return {
        ok: false,
        message:
          "La invitación fue creada, pero el acceso quedó desactivado y requiere revisión.",
      };
    }

    await clients.supabase.rpc("admin_record_invitation", {
      p_profile_id: data.user.id,
    });
    revalidatePath("/app/usuarios");

    return { ok: true, message: "Invitación enviada correctamente." };
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return {
        ok: false,
        message: "Configura las variables privadas de Supabase antes de invitar.",
      };
    }
    return { ok: false, message: "No fue posible enviar la invitación." };
  }
}

export async function updateUserAccessAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = updateUserAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const clients = await getAdminClients();
    if (!clients) return { ok: false, message: "Acción no autorizada." };

    const { error } = await clients.supabase.rpc("admin_update_profile", {
      p_profile_id: parsed.data.profileId,
      p_role_code: parsed.data.role,
      p_is_active: parsed.data.isActive,
      p_display_name: parsed.data.displayName,
    });

    if (error) {
      return {
        ok: false,
        message: error.message.includes("último administrador")
          ? "No puedes desactivar ni degradar al último administrador activo."
          : "No fue posible actualizar el acceso.",
      };
    }

    revalidatePath("/app/usuarios");
    return { ok: true, message: "Acceso actualizado." };
  } catch {
    return { ok: false, message: "No fue posible actualizar el acceso." };
  }
}
