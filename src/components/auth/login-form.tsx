"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/app/actions/auth";
import type { z } from "zod";
import { loginSchema } from "@/validations/auth";
import { PasswordInput } from "@/components/auth/password-input";

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
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
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
        className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>

      <Link
        href="/forgot-password"
        className="block text-center text-sm font-medium text-emerald-800 underline-offset-4 hover:underline"
      >
        Recuperar contraseña
      </Link>
    </form>
  );
}
