import { describe, expect, it } from "vitest";
import {
  EnvironmentConfigurationError,
  parseAppEnvironment,
  parsePublicSupabaseEnvironment,
} from "@/lib/env";

describe("variables de entorno", () => {
  it("acepta una configuración pública sintética", () => {
    const result = parsePublicSupabaseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.example.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(24),
    });

    expect(result.NEXT_PUBLIC_SUPABASE_URL).toContain("example.invalid");
  });

  it("informa únicamente los nombres de variables inválidas", () => {
    expect(() => parsePublicSupabaseEnvironment({})).toThrow(
      EnvironmentConfigurationError,
    );
  });

  it("fija America/Lima como zona permitida", () => {
    expect(
      parseAppEnvironment({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        APP_TIMEZONE: "America/Lima",
      }).APP_TIMEZONE,
    ).toBe("America/Lima");
  });
});
