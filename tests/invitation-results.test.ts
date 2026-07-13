import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { invitationAuditFailureResult } from "@/lib/auth/invitation-results";

describe("resultado de auditoría de invitación", () => {
  it("no comunica éxito completo cuando la auditoría falla", () => {
    const result = invitationAuditFailureResult();

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "La cuenta fue invitada, pero la auditoría requiere revisión.",
    );
    expect(result.message).not.toContain("correctamente");
  });

  it("comprueba el error de la RPC antes de comunicar éxito", () => {
    const action = readFileSync(
      path.resolve("src/app/actions/users.ts"),
      "utf8",
    );

    expect(action).toContain("const { error: auditError }");
    expect(action).toContain("if (auditError)");
    expect(action).toContain("return invitationAuditFailureResult()");
  });
});
