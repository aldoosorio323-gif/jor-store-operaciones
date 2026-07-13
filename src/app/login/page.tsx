import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  config: "Supabase aún no está configurado en este entorno.",
  callback: "El enlace no es válido o ya expiró.",
  inactive: "El acceso está deshabilitado. Contacta al administrador.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? errorMessages[params.error] : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthShell title="Iniciar sesión" description="Acceso privado para el equipo de JOR STORE.">
      <LoginForm next={next} initialMessage={error} />
    </AuthShell>
  );
}
