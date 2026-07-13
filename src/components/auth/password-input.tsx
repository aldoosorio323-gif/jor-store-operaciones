"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

type PasswordInputProps = {
  id: string;
  label: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
  error?: string;
};

export function PasswordInput({
  id,
  label,
  autoComplete,
  registration,
  error,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm font-medium text-neutral-800" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-2">
        <input
          {...registration}
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 pr-20 text-base outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-emerald-800"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
