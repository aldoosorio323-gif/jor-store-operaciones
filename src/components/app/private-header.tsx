"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "@/components/ui/icons";
import { getPrivateNavigationGroups } from "@/features/catalogs/permissions";
import type { CurrentUserContext } from "@/lib/auth/session";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/app") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrivateHeader({ user }: { user: CurrentUserContext }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const groups = useMemo(() => getPrivateNavigationGroups(user.role), [user.role]);
  const initials = user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen]);

  const navigation = <nav aria-label="Navegación principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
    {groups.map((group) => <div key={group.label}><p className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p><div className="space-y-1">{group.items.map((item) => {
      const active = isActiveRoute(pathname, item.href);
      return <Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} aria-current={active ? "page" : undefined} data-active={active ? "true" : "false"} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon name={item.icon} className="size-[1.1rem] shrink-0"/><span>{item.label}</span></Link>;
    })}</div></div>)}
  </nav>;

  const userPanel = <div className="border-t border-white/10 p-3"><div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">{initials || "JS"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.displayName}</p><p className="truncate text-xs text-slate-400">{user.roleName}</p></div><form action={logoutAction}><button type="submit" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión"><Icon name="logout" className="size-4"/></button></form></div></div>;

  return <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-800 bg-slate-950 lg:flex" data-desktop-sidebar><Brand />{navigation}{userPanel}</aside>
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:left-72 lg:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden" onClick={()=>setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Icon name="menu" className="size-5"/></button><div className="lg:hidden"><p className="text-sm font-bold text-slate-950">JOR STORE</p><p className="text-[0.68rem] text-slate-500">Operaciones</p></div><p className="hidden truncate text-sm font-medium text-slate-500 sm:block">Sistema interno de operaciones</p></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="max-w-48 truncate text-sm font-semibold text-slate-800">{user.displayName}</p><p className="text-xs text-slate-500">{user.roleName}</p></div><span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">{initials || "JS"}</span></div></header>
    {menuOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-slate-950/60" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/><aside id="mobile-navigation" role="dialog" aria-modal="true" className="relative flex h-full w-[min(88vw,20rem)] flex-col bg-slate-950 shadow-2xl" aria-label="Menú móvil"><div className="flex items-center justify-between"><Brand/><button type="button" className="mr-3 min-h-11 min-w-11 rounded-lg p-2 text-slate-300 hover:bg-white/10" onClick={()=>setMenuOpen(false)} aria-label="Cerrar menú"><Icon name="close" className="size-5"/></button></div>{navigation}{userPanel}</aside></div> : null}
  </>;
}

function Brand() { return <Link href="/app" className="flex h-16 items-center gap-3 border-b border-white/10 px-5"><span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 font-black text-white">J</span><span><span className="block text-sm font-bold tracking-wide text-white">JOR STORE</span><span className="block text-[0.68rem] uppercase tracking-[0.16em] text-emerald-400">Operaciones</span></span></Link>; }
