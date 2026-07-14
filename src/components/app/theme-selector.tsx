"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

export const THEME_STORAGE_KEY = "jor-store-theme";
export const themeOptions = [
  { value: "system", label: "Sistema", icon: "monitor", preview: "bg-[linear-gradient(90deg,#f5f6f8_50%,#191b20_50%)]" },
  { value: "light", label: "Claro", icon: "sun", preview: "bg-[#f5f6f8]" },
  { value: "cream", label: "Crema", icon: "cream", preview: "bg-[#f7f0e5]" },
  { value: "dark", label: "Oscuro", icon: "moon", preview: "bg-[#191b20]" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string; icon: IconName; preview: string }>;

export type ThemePreference = "system" | "light" | "cream" | "dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return themeOptions.some((option) => option.value === value);
}

function resolveTheme(preference: ThemePreference, media: MediaQueryList): Exclude<ThemePreference, "system"> {
  return preference === "system" ? (media.matches ? "dark" : "light") : preference;
}

function applyTheme(preference: ThemePreference, media: MediaQueryList) {
  const resolved = resolveTheme(preference, media);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved === "dark" ? "dark" : "light";
}

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>("system");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isThemePreference(stored) ? stored : "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    queueMicrotask(() => setPreference(initial));
    applyTheme(initial, media);
    const onSystemChange = () => { if ((localStorage.getItem(THEME_STORAGE_KEY) ?? "system") === "system") applyTheme("system", media); };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const options = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
      if (!options.length) return;
      event.preventDefault();
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (current + 1 + options.length) % options.length : (current - 1 + options.length) % options.length;
      options[next]?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    queueMicrotask(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-theme-option="${preference}"]`)?.focus());
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open, preference]);

  const selectTheme = (next: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setPreference(next);
    applyTheme(next, window.matchMedia("(prefers-color-scheme: dark)"));
    setOpen(false);
    buttonRef.current?.focus();
  };

  const selected = themeOptions.find((option) => option.value === preference) ?? themeOptions[0];
  return <div ref={rootRef} className="relative">
    <button ref={buttonRef} type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-controls="appearance-menu" className="app-surface-raised flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm transition hover:bg-[var(--app-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus-ring)]" aria-label={`Apariencia: ${selected.label}`}>
      <Icon name={selected.icon} className="size-4"/><span className="hidden md:inline">Apariencia</span><span className={`size-3 rounded-full border border-black/20 ${selected.preview}`} aria-hidden="true"/>
    </button>
    {open ? <div id="appearance-menu" role="menu" aria-label="Seleccionar apariencia" className="app-surface absolute right-0 top-[calc(100%+.5rem)] z-50 w-64 rounded-xl border p-2 shadow-xl">
      <p className="app-muted px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.12em]">Apariencia</p>
      {themeOptions.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={preference === option.value} data-theme-option={option.value} onClick={() => selectTheme(option.value)} className="app-text flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[var(--app-surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--app-focus-ring)]">
        <span className="app-soft flex size-8 items-center justify-center rounded-lg"><Icon name={option.icon} className="size-4"/></span><span className="flex-1">{option.label}</span><span className={`size-5 rounded-full border border-black/20 ${option.preview}`} aria-hidden="true"/>{preference === option.value ? <Icon name="check" className="size-4 text-[var(--app-primary)]"/> : <span className="size-4"/>}
      </button>)}
    </div> : null}
  </div>;
}
