import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nueva contraseña"
      description="Define una contraseña segura para tu cuenta."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
