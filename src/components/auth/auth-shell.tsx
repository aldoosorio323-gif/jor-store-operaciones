import type { ReactNode } from "react";
import { ThemeSelector } from "@/components/app/theme-selector";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="app-shell relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6"><ThemeSelector /></div>
      <section className="app-surface w-full max-w-md rounded-3xl border p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--app-primary)]">
            JOR STORE
          </p>
          <h1 className="app-text mt-3 text-3xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="app-muted mt-2 text-sm leading-6">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
