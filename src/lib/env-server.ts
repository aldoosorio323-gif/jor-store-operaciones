import "server-only";

import { z } from "zod";
import { EnvironmentConfigurationError } from "@/lib/env";

const serverSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type ServerSupabaseEnvironment = z.infer<typeof serverSupabaseSchema>;

export function parseServerSupabaseEnvironment(
  values: unknown,
): ServerSupabaseEnvironment {
  const result = serverSupabaseSchema.safeParse(values);
  if (result.success) return result.data;

  throw new EnvironmentConfigurationError([
    ...new Set(
      result.error.issues.map((issue) => String(issue.path[0] ?? "entorno")),
    ),
  ]);
}

export function getServerSupabaseEnvironment(): ServerSupabaseEnvironment {
  return parseServerSupabaseEnvironment(process.env);
}
