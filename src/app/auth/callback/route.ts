import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeInternalRedirect } from "@/lib/auth/redirects";
import { EnvironmentConfigurationError } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const allowedOtpTypes = new Set<EmailOtpType>([
  "invite",
  "recovery",
  "email",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const next = getSafeInternalRedirect(
    request.nextUrl.searchParams.get("next"),
    "/app",
  );

  try {
    const supabase = await createClient();
    const code = request.nextUrl.searchParams.get("code");
    const tokenHash = request.nextUrl.searchParams.get("token_hash");
    const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
    let error: Error | null = null;

    if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      error = result.error;
    } else if (tokenHash && type && allowedOtpTypes.has(type)) {
      const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      error = result.error;
    } else {
      error = new Error("Callback incompleto");
    }

    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return NextResponse.redirect(new URL("/login?error=config", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
