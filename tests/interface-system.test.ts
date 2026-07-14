import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPrivateNavigationGroups, getPrivateNavigationItems } from "@/features/catalogs/permissions";

const header = readFileSync(path.resolve("src/components/app/private-header.tsx"), "utf8");
const layout = readFileSync(path.resolve("src/app/app/layout.tsx"), "utf8");
const dialog = readFileSync(path.resolve("src/components/ui/dialog.tsx"), "utf8");
const ui = readFileSync(path.resolve("src/components/ui/operational-ui.tsx"), "utf8");
const customers = readFileSync(path.resolve("src/app/app/clientes/page.tsx"), "utf8");

function collectSourceFiles(target: string): string[] {
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(child);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

describe("sistema visual operativo", () => {
  it("agrupa la navegación y conserva controles exclusivos del administrador", () => {
    expect(getPrivateNavigationGroups("administrator").map((group) => group.label)).toEqual([
      "Principal", "Ventas", "Logística", "Inventario", "Abastecimiento", "Configuración", "Cuenta",
    ]);
    const operator = getPrivateNavigationItems("operator");
    const administrator = getPrivateNavigationItems("administrator");
    for (const href of ["/app/clientes", "/app/pedidos", "/app/pagos", "/app/envios", "/app/productos", "/app/inventario", "/app/inventario/movimientos", "/app/transferencias", "/app/compras", "/app/proveedores", "/app/almacenes", "/app/perfil"]) {
      expect(operator.some((item) => item.href === href)).toBe(true);
    }
    for (const href of ["/app/transportistas", "/app/ajustes", "/app/usuarios"]) {
      expect(operator.some((item) => item.href === href)).toBe(false);
      expect(administrator.some((item) => item.href === href)).toBe(true);
    }
  });

  it("implementa sidebar, estado activo y navegación móvil sin desbordamiento general", () => {
    expect(layout).toContain("overflow-x-hidden");
    expect(layout).toContain("lg:ml-72");
    expect(header).toContain("data-desktop-sidebar");
    expect(header).toContain("usePathname");
    expect(header).toContain('aria-current={active ? "page" : undefined}');
    expect(header).toContain('aria-expanded={menuOpen}');
    expect(header).toContain('id="mobile-navigation"');
    expect(header).toContain("onClick={()=>setMenuOpen(false)}");
  });

  it("incluye componentes reutilizables y comportamiento responsive básico", () => {
    for (const component of ["PageHeader", "SectionCard", "FilterBar", "FormField", "Feedback", "StatusBadge", "EmptyState", "ResponsiveList", "SkeletonPage"]) {
      expect(ui).toContain(`function ${component}`);
    }
    expect(ui).toContain("hidden overflow-hidden");
    expect(ui).toContain("md:block");
    expect(ui).toContain("md:hidden");
  });

  it("muestra el estado vacío solicitado para clientes", () => {
    expect(customers).toContain('title="Todavía no hay clientes"');
    expect(customers).toContain("Registrar primer cliente");
    expect(customers).toContain("Nuevo cliente");
  });

  it("usa diálogos accesibles con foco contenido y retorno al disparador", () => {
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('event.key !== "Tab"');
    expect(dialog).toContain('event.key === "Escape"');
    expect(dialog).toContain("returnFocusRef.current?.focus()");
  });

  it("prohíbe prompt y confirm del navegador en todo src", () => {
    const affected = collectSourceFiles(path.resolve("src")).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /\b(?:window\.)?confirm\s*\(|\b(?:window\.)?prompt\s*\(/.test(source);
    });
    expect(affected).toEqual([]);
  });
});
