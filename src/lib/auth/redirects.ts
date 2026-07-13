import { getAppEnvironment } from "@/lib/env";

const allowedInternalRedirects = new Set([
  "/app",
  "/app/perfil",
  "/app/usuarios",
  "/login",
  "/forgot-password",
  "/reset-password",
]);

export function getSafeInternalRedirect(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  const [pathname] = candidate.split(/[?#]/, 1);
  return pathname && allowedInternalRedirects.has(pathname) ? pathname : fallback;
}

export function buildAuthCallbackUrl(nextPath: string): string {
  const environment = getAppEnvironment();
  const callbackUrl = new URL("/auth/callback", environment.NEXT_PUBLIC_APP_URL);
  callbackUrl.searchParams.set(
    "next",
    getSafeInternalRedirect(nextPath, "/app"),
  );
  return callbackUrl.toString();
}
