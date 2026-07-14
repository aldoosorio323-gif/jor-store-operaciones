"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/app/actions/auth";
import type { z } from "zod";
import { loginSchema } from "@/validations/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { buttonStyles, fieldClass } from "@/components/ui/operational-ui";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({
  next,
  initialMessage,
}: {
  next?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(initialMessage ?? "");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>();

  const onSubmit = handleSubmit((values) => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success || pending) return;

    startTransition(async () => {
      setMessage("");
      const result = await loginAction(parsed.data, next);
      setMessage(result.message);
      if (result.ok && result.redirectTo) {
        router.replace(result.redirectTo);
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
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
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          className={`${fieldClass} text-base`}
        />
        {errors.email ? (
          <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>
        ) : null}
      </div>

      <PasswordInput
        id="password"
        label="Contraseña"
        autoComplete="current-password"
        registration={register("password", { required: "Ingresa tu contraseña." })}
        error={errors.password?.message}
      />

      {message ? (
        <p aria-live="polite" className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`${buttonStyles.primary} w-full`}
      >
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>

      <Link
        href="/forgot-password"
        className="block text-center text-sm font-semibold text-[var(--app-primary)] underline-offset-4 hover:underline"
      >
        Recuperar contraseña
      </Link>
    </form>
  );
}
