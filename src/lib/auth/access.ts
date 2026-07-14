import type { RoleCode } from "@/types/database";

export type AuthSnapshot = {
  authenticated: boolean;
  active: boolean;
  role: RoleCode | null;
};

export type RouteAccessDecision =
  | { action: "allow" }
  | { action: "redirect"; destination: string };

const isPrivatePath = (pathname: string) =>
  pathname === "/app" || pathname.startsWith("/app/");

export function decideRouteAccess(
  pathname: string,
  auth: AuthSnapshot,
): RouteAccessDecision {
  if (isPrivatePath(pathname)) {
    if (!auth.authenticated) {
      return {
        action: "redirect",
        destination: `/login?next=${encodeURIComponent(pathname)}`,
      };
    }

    if (!auth.active) {
      return { action: "redirect", destination: "/login?error=inactive" };
    }

    if (
      (pathname.startsWith("/app/usuarios") || pathname.startsWith("/app/ajustes"))
      && auth.role !== "administrator"
    ) {
      return { action: "redirect", destination: "/app" };
    }
  }

  if (
    auth.authenticated &&
    auth.active &&
    (pathname === "/login" || pathname === "/forgot-password")
  ) {
    return { action: "redirect", destination: "/app" };
  }

  if (pathname === "/reset-password" && !auth.authenticated) {
    return {
      action: "redirect",
      destination: "/forgot-password?error=session",
    };
  }

  return { action: "allow" };
}
