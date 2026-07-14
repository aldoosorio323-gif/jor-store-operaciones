import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(file), "utf8");
const layout = read("src/app/layout.tsx");
const styles = read("src/app/globals.css");
const selector = read("src/components/app/theme-selector.tsx");
const header = read("src/components/app/private-header.tsx");
const ui = read("src/components/ui/operational-ui.tsx");

describe("selector de apariencia e identidad JOR STORE", () => {
  it("ofrece únicamente los cuatro temas controlados", () => {
    for (const option of ['value: "system"', 'value: "light"', 'value: "cream"', 'value: "dark"']) {
      expect(selector).toContain(option);
    }
    expect(selector).not.toMatch(/type=["']color["']/);
  });

  it("persiste la preferencia y reacciona al modo del sistema", () => {
    expect(selector).toContain('THEME_STORAGE_KEY = "jor-store-theme"');
    expect(selector).toContain("localStorage.setItem(THEME_STORAGE_KEY, next)");
    expect(selector).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(selector).toContain('media.addEventListener("change", onSystemChange)');
    expect(selector).toContain('media.removeEventListener("change", onSystemChange)');
  });

  it("aplica el tema antes del primer render sin desajuste de hidratación", () => {
    expect(layout).toContain("jor-store-theme");
    expect(layout).toContain("dangerouslySetInnerHTML");
    expect(layout).toContain("document.documentElement");
    expect(layout).toContain("suppressHydrationWarning");
    expect(layout.indexOf("<head>")).toBeLessThan(layout.indexOf("<body>"));
  });

  it("define tokens completos para claro, crema y oscuro", () => {
    for (const token of ["--app-background", "--app-surface", "--app-surface-raised", "--app-border", "--app-text", "--app-text-muted", "--app-primary", "--app-primary-hover", "--app-primary-soft", "--app-sidebar", "--app-sidebar-hover", "--app-sidebar-text", "--app-sidebar-muted", "--app-focus-ring"]) {
      expect(styles).toContain(token);
    }
    expect(styles).toContain('html[data-theme="cream"]');
    expect(styles).toContain('html[data-theme="dark"]');
    expect(styles).toContain("#c1121f");
    expect(styles).toContain("#ef3340");
  });

  it("mantiene la identidad roja y los estados de éxito verdes", () => {
    expect(header).toContain("bg-[var(--app-primary-solid)]");
    expect(header).toContain("text-[var(--app-sidebar-text)]");
    expect(header).toContain("font-semibold");
    expect(ui).toContain('success: "bg-emerald-100 text-emerald-800"');
    expect(styles).toContain("Verde reservado para éxito");
  });

  it("expone un menú accesible operable con teclado", () => {
    expect(selector).toContain('aria-haspopup="menu"');
    expect(selector).toContain("aria-expanded={open}");
    expect(selector).toContain('role="menuitemradio"');
    expect(selector).toContain("aria-checked");
    expect(selector).toContain('event.key === "Escape"');
    expect(selector).toContain('"ArrowDown", "ArrowUp", "Home", "End"');
    expect(selector).toContain("pointerdown");
  });

  it("usa tipografía profesional, conserva móvil y evita desbordamiento", () => {
    expect(styles).toContain("ui-sans-serif, system-ui");
    expect(styles).not.toMatch(/font-family:\s*Arial/i);
    expect(styles).toContain("overflow-x: hidden");
    expect(header).toContain("lg:hidden");
    expect(header).toContain('id="mobile-navigation"');
  });
});
