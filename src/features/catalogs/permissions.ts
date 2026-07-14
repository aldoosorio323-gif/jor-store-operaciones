import type { RoleCode } from "@/types/database";

export const canManageCatalogs = (role: RoleCode) => role === "administrator";

export function getPrivateNavigationItems(role: RoleCode) {
  return [
    { href: "/app", label: "Inicio" },
    { href: "/app/productos", label: "Productos" },
    { href: "/app/compras", label: "Compras" },
    { href: "/app/inventario", label: "Inventario" },
    { href: "/app/transferencias", label: "Transferencias" },
    { href: "/app/almacenes", label: "Almacenes" },
    { href: "/app/proveedores", label: "Proveedores" },
    ...(role === "administrator" ? [{ href: "/app/ajustes", label: "Ajustes" }] : []),
    ...(role === "administrator" ? [{ href: "/app/usuarios", label: "Usuarios" }] : []),
    { href: "/app/perfil", label: "Mi perfil" },
  ];
}
