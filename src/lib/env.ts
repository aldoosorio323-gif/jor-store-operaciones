import { z } from "zod";

const publicSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const appEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  APP_TIMEZONE: z.literal("America/Lima").default("America/Lima"),
});

export type PublicSupabaseEnvironment = z.infer<typeof publicSupabaseSchema>;
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export class EnvironmentConfigurationError extends Error {
  constructor(public readonly missingOrInvalidVariables: readonly string[]) {
    super(
      `Falta configurar correctamente: ${missingOrInvalidVariables.join(", ")}.`,
    );
    this.name = "EnvironmentConfigurationError";
  }
}

function parseEnvironment<T extends z.ZodType>(
  schema: T,
  values: unknown,
): z.infer<T> {
  const result = schema.safeParse(values);

  if (result.success) {
    return result.data;
  }

  const variables = [
    ...new Set(
      result.error.issues.map((issue) => String(issue.path[0] ?? "entorno")),
    ),
  ];

  throw new EnvironmentConfigurationError(variables);
}

export function parsePublicSupabaseEnvironment(
  values: unknown,
): PublicSupabaseEnvironment {
  return parseEnvironment(publicSupabaseSchema, values);
}

export function parseAppEnvironment(values: unknown): AppEnvironment {
  return parseEnvironment(appEnvironmentSchema, values);
}

export function getPublicSupabaseEnvironment(): PublicSupabaseEnvironment {
  return parsePublicSupabaseEnvironment(process.env);
}

export function getAppEnvironment(): AppEnvironment {
  return parseAppEnvironment(process.env);
}

export function hasPublicSupabaseEnvironment(): boolean {
  return publicSupabaseSchema.safeParse(process.env).success;
}
