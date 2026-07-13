import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { CurrentUserContext } from "@/lib/auth/session";

export function PrivateHeader({ user }: { user: CurrentUserContext }) {
  return (
    <header className="border-b border-emerald-950/10 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/app" className="font-semibold tracking-tight text-emerald-950">
              JOR STORE Operaciones
            </Link>
            <p className="mt-1 text-xs text-neutral-500">
              {user.displayName} · {user.roleName}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
        <nav aria-label="Navegación principal" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link href="/app" className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-900">
            Inicio
          </Link>
          <Link href="/app/perfil" className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700">
            Mi perfil
          </Link>
          {user.role === "administrator" ? (
            <Link href="/app/usuarios" className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700">
              Usuarios
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
