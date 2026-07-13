import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialMessage =
    params.error === "session" ? "Solicita un enlace nuevo para continuar." : undefined;

  return (
    <AuthShell
      title="Recuperar acceso"
      description="Te enviaremos instrucciones si la cuenta está habilitada."
    >
      <ForgotPasswordForm initialMessage={initialMessage} />
    </AuthShell>
  );
}
