import { z } from "zod";

const email = z.email("Ingresa un correo válido.").max(254);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .max(72, "Usa como máximo 72 caracteres.")
      .regex(/[a-z]/, "Incluye una letra minúscula.")
      .regex(/[A-Z]/, "Incluye una letra mayúscula.")
      .regex(/[0-9]/, "Incluye un número.")
      .regex(/[^A-Za-z0-9]/, "Incluye un símbolo."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const inviteUserSchema = z.object({
  email,
  displayName: z
    .string()
    .trim()
    .min(2, "Ingresa un nombre.")
    .max(100, "El nombre es demasiado largo."),
  role: z.enum(["administrator", "operator"]),
});

export const updateUserAccessSchema = z.object({
  profileId: z.uuid(),
  displayName: z.string().trim().min(2).max(100),
  role: z.enum(["administrator", "operator"]),
  isActive: z.boolean(),
});
