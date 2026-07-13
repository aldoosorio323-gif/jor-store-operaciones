"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/app/actions/auth";
import {
  inviteUserAction,
  updateUserAccessAction,
} from "@/app/actions/users";
import type { AdminUserListItem } from "@/services/user-admin";
import { inviteUserSchema } from "@/validations/auth";

type InviteValues = z.infer<typeof inviteUserSchema>;

export function UserManagement({
  users,
  currentUserId,
}: {
  users: AdminUserListItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, reset, formState } = useForm<InviteValues>({
    defaultValues: { role: "operator" },
  });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-emerald-950">Invitar usuario</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Supabase enviará un enlace para que la persona defina su contraseña.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => {
            if (pending) return;
            startTransition(async () => {
              const result = await inviteUserAction(values);
              setMessage(result.message);
              if (result.ok) {
                reset({ role: "operator" });
                router.refresh();
              }
            });
          })}
        >
          <label className="text-sm font-medium text-neutral-800">
            Nombre
            <input
              {...register("displayName", { required: "Ingresa un nombre." })}
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal"
            />
            {formState.errors.displayName ? (
              <span className="mt-1 block text-red-700">{formState.errors.displayName.message}</span>
            ) : null}
          </label>
          <label className="text-sm font-medium text-neutral-800">
            Correo
            <input
              {...register("email", { required: "Ingresa un correo." })}
              type="email"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium text-neutral-800">
            Rol
            <select
              {...register("role")}
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal"
            >
              <option value="operator">Operador</option>
              <option value="administrator">Administrador</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Procesando…" : "Enviar invitación"}
            </button>
          </div>
        </form>
        {message ? (
          <p aria-live="polite" className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm">
            {message}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-emerald-950">Usuarios</h2>
        <div className="mt-4 space-y-4">
          {users.map((user) => (
            <UserAccessCard
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              disabled={pending}
              onResult={(result) => {
                setMessage(result.message);
                if (result.ok) router.refresh();
              }}
              run={(task) => startTransition(task)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function UserAccessCard({
  user,
  isCurrentUser,
  disabled,
  onResult,
  run,
}: {
  user: AdminUserListItem;
  isCurrentUser: boolean;
  disabled: boolean;
  onResult: (result: ActionResult) => void;
  run: (task: () => Promise<void>) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">
            {user.displayName} {isCurrentUser ? "(tú)" : ""}
          </p>
          <p className="truncate text-sm text-neutral-600">{user.email}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_auto_auto] sm:items-end">
          <label className="text-sm font-medium text-neutral-700">
            Rol
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "administrator" | "operator")
              }
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="operator">Operador</option>
              <option value="administrator">Administrador</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Activo
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              run(async () => {
                const result = await updateUserAccessAction({
                  profileId: user.id,
                  displayName: user.displayName,
                  role,
                  isActive,
                });
                onResult(result);
              })
            }
            className="rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </div>
      {isCurrentUser && user.role === "administrator" ? (
        <p className="mt-3 text-xs text-neutral-500">
          El servidor impedirá desactivar o degradar al último administrador activo.
        </p>
      ) : null}
    </article>
  );
}
