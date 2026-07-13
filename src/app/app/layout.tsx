import type { ReactNode } from "react";
import { PrivateHeader } from "@/components/app/private-header";
import { requireActiveUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const user = await requireActiveUser();

  return (
    <div className="min-h-screen bg-[#f5f7f4]">
      <PrivateHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
