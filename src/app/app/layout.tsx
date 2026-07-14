import type { ReactNode } from "react";
import { PrivateHeader } from "@/components/app/private-header";
import { requireActiveUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const user = await requireActiveUser();

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100" data-app-shell>
      <PrivateHeader user={user} />
      <main className="min-w-0 px-4 pb-10 pt-22 sm:px-6 lg:ml-72 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
