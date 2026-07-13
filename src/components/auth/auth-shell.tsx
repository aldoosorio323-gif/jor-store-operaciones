import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            JOR STORE
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
