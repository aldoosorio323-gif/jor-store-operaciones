"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { fieldClass } from "@/components/ui/operational-ui";

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
          className={`${fieldClass} mt-2 pr-20 text-base`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute bottom-0 right-0 top-2 px-4 text-sm font-semibold text-[var(--app-primary)]"
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
