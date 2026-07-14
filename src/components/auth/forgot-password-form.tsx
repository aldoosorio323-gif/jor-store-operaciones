"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { forgotPasswordAction } from "@/app/actions/auth";
import type { z } from "zod";
import { forgotPasswordSchema } from "@/validations/auth";
import { buttonStyles, fieldClass } from "@/components/ui/operational-ui";

type ForgotValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({ initialMessage }: { initialMessage?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(initialMessage ?? "");
  const { register, handleSubmit, formState } = useForm<ForgotValues>();

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((values) => {
        if (pending) return;
        startTransition(async () => {
          const result = await forgotPasswordAction(values);
          setMessage(result.message);
        });
      })}
    >
      <div>
        <label className="text-sm font-medium text-neutral-800" htmlFor="email">
          Correo
        </label>
        <input
          {...register("email", {
            required: "Ingresa tu correo.",
            pattern: { value: /^\S+@\S+\.\S+$/, message: "Correo inválido." },
          })}
          id="email"
          type="email"
          autoComplete="email"
          className={`${fieldClass} text-base`}
        />
        {formState.errors.email ? (
          <p className="mt-1 text-sm text-red-700">{formState.errors.email.message}</p>
        ) : null}
      </div>
      {message ? (
        <p aria-live="polite" className="rounded-xl bg-neutral-100 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`${buttonStyles.primary} w-full`}
      >
        {pending ? "Enviando…" : "Enviar instrucciones"}
      </button>
      <Link href="/login" className="block text-center text-sm font-semibold text-[var(--app-primary)]">
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
