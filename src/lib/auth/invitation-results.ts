import type { ActionResult } from "@/app/actions/auth";

export function invitationAuditFailureResult(): ActionResult {
  return {
    ok: false,
    message: "La cuenta fue invitada, pero la auditoría requiere revisión.",
  };
}
