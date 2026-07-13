import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRouteAccess, type AuthSnapshot } from "@/lib/auth/access";
import {
  getPublicSupabaseEnvironment,
  hasPublicSupabaseEnvironment,
} from "@/lib/env";
import type { Database, RoleCode } from "@/types/database";

function redirectPreservingSession(
  destination: string,
  request: NextRequest,
  sessionResponse: NextResponse,
) {
  const response = NextResponse.redirect(new URL(destination, request.url));

  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = sessionResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  });

  return response;
}

export async function updateSession(request: NextRequest) {
  if (!hasPublicSupabaseEnvironment()) {
    if (request.nextUrl.pathname.startsWith("/app")) {
      return NextResponse.redirect(new URL("/login?error=config", request.url));
    }
    return NextResponse.next({ request });
  }

  const environment = getPublicSupabaseEnvironment();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub);
  let active = false;
  let role: RoleCode | null = null;

  if (authenticated) {
    const [activeResult, roleResult] = await Promise.all([
      supabase.rpc("current_user_is_active"),
      supabase.rpc("current_user_role"),
    ]);
    active = activeResult.data === true;
    role = roleResult.data ?? null;
  }

  const snapshot: AuthSnapshot = { authenticated, active, role };
  const decision = decideRouteAccess(request.nextUrl.pathname, snapshot);

  if (decision.action === "redirect") {
    return redirectPreservingSession(decision.destination, request, response);
  }

  return response;
}
