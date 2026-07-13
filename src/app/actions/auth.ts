"use server";

import { redirect } from "next/navigation";
import { buildAuthCallbackUrl, getSafeInternalRedirect } from "@/lib/auth/redirects";
import { EnvironmentConfigurationError } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/validations/auth";

export type ActionResult = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

const configurationMessage =
  "Supabase aún no está configurado. Revisa docs/configuracion-supabase.md.";

export async function loginAction(
  input: unknown,
  requestedNext?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        ok: false,
        message: "No fue posible iniciar sesión. Revisa tus datos o contacta al administrador.",
      };
    }

    const { data: isActive } = await supabase.rpc("current_user_is_active");
    if (isActive !== true) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: "No fue posible iniciar sesión. Contacta al administrador.",
      };
    }

    await supabase.rpc("mark_current_user_login");
    return {
      ok: true,
      message: "Sesión iniciada.",
      redirectTo: getSafeInternalRedirect(requestedNext, "/app"),
    };
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return { ok: false, message: configurationMessage };
    }
    return { ok: false, message: "No fue posible iniciar sesión." };
  }
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildAuthCallbackUrl("/reset-password"),
    });

    return {
      ok: true,
      message:
        "Si el correo pertenece a una cuenta habilitada, recibirás instrucciones para continuar.",
    };
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return { ok: false, message: configurationMessage };
    }
    return {
      ok: true,
      message:
        "Si el correo pertenece a una cuenta habilitada, recibirás instrucciones para continuar.",
    };
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, message: "El enlace ya no es válido. Solicita uno nuevo." };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, message: "No fue posible actualizar la contraseña." };
    }

    await supabase.rpc("record_security_event", {
      p_action: "password_recovery_completed",
    });

    return {
      ok: true,
      message: "Contraseña actualizada.",
      redirectTo: "/app",
    };
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return { ok: false, message: configurationMessage };
    }
    return { ok: false, message: "No fue posible actualizar la contraseña." };
  }
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/login");
  }
}
