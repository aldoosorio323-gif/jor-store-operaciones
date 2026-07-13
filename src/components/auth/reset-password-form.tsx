"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { resetPasswordAction } from "@/app/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { resetPasswordSchema } from "@/validations/auth";

type ResetValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState } = useForm<ResetValues>();

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((values) => {
        const parsed = resetPasswordSchema.safeParse(values);
        if (!parsed.success || pending) {
          setMessage(parsed.success ? "" : parsed.error.issues[0]?.message ?? "Datos inválidos.");
          return;
        }
        startTransition(async () => {
          const result = await resetPasswordAction(parsed.data);
          setMessage(result.message);
          if (result.ok && result.redirectTo) {
            router.replace(result.redirectTo);
            router.refresh();
          }
        });
      })}
    >
      <PasswordInput
        id="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        registration={register("password", { required: "Ingresa una contraseña." })}
        error={formState.errors.password?.message}
      />
      <PasswordInput
        id="confirmPassword"
        label="Confirmar contraseña"
        autoComplete="new-password"
        registration={register("confirmPassword", {
          required: "Confirma la contraseña.",
        })}
        error={formState.errors.confirmPassword?.message}
      />
      <p className="text-xs leading-5 text-neutral-500">
        Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo.
      </p>
      {message ? (
        <p aria-live="polite" className="rounded-xl bg-neutral-100 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
