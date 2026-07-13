import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  inviteUserSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/validations/auth";

describe("validaciones de autenticación", () => {
  it("rechaza un inicio de sesión incompleto", () => {
    expect(loginSchema.safeParse({ email: "incorrecto", password: "" }).success).toBe(false);
  });

  it("acepta un correo sintético válido para recuperación", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "persona@example.invalid" }).success,
    ).toBe(true);
  });

  it("exige una contraseña robusta y coincidente", () => {
    const syntheticStrongPassword = ["Prueba", "Segura", "2026", "!"].join("-");

    expect(
      resetPasswordSchema.safeParse({
        password: "debil",
        confirmPassword: "debil",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        password: syntheticStrongPassword,
        confirmPassword: syntheticStrongPassword,
      }).success,
    ).toBe(true);
  });

  it("limita las invitaciones a roles conocidos", () => {
    expect(
      inviteUserSchema.safeParse({
        email: "persona@example.invalid",
        displayName: "Persona de prueba",
        role: "owner",
      }).success,
    ).toBe(false);
  });
});
