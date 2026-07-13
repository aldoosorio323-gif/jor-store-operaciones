import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPublicSupabaseEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasPublicSupabaseEnvironment()) redirect("/login?error=config");

  const context = await getCurrentUserContext();
  redirect(context ? "/app" : "/login");
}
