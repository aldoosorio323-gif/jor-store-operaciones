import type { RoleCode } from "@/types/database";
import type { IconName } from "@/components/ui/icons";

export const canManageCatalogs = (role: RoleCode) => role === "administrator";

export type PrivateNavigationItem = { href: string; label: string; icon: IconName };
export type PrivateNavigationGroup = { label: string; items: PrivateNavigationItem[] };

export function getPrivateNavigationGroups(role: RoleCode): PrivateNavigationGroup[] {
  return [
    { label: "Principal", items: [{ href: "/app", label: "Inicio", icon: "home" }] },
    { label: "Ventas", items: [
      { href: "/app/clientes", label: "Clientes", icon: "customers" },
      { href: "/app/pedidos", label: "Pedidos", icon: "orders" },
      { href: "/app/pagos", label: "Pagos", icon: "payments" },
    ] },
    { label: "Inventario", items: [
      { href: "/app/productos", label: "Productos", icon: "products" },
      { href: "/app/inventario", label: "Inventario", icon: "inventory" },
      { href: "/app/inventario/movimientos", label: "Movimientos", icon: "movements" },
      { href: "/app/transferencias", label: "Transferencias", icon: "transfers" },
    ] },
    { label: "Abastecimiento", items: [
      { href: "/app/compras", label: "Compras", icon: "purchases" },
      { href: "/app/proveedores", label: "Proveedores", icon: "suppliers" },
    ] },
    { label: "Configuración", items: [
      { href: "/app/almacenes", label: "Almacenes", icon: "warehouses" },
      ...(role === "administrator" ? [
        { href: "/app/ajustes", label: "Ajustes", icon: "adjustments" as const },
        { href: "/app/usuarios", label: "Usuarios", icon: "users" as const },
      ] : []),
    ] },
    { label: "Cuenta", items: [{ href: "/app/perfil", label: "Mi perfil", icon: "profile" }] },
  ];
}

export function getPrivateNavigationItems(role: RoleCode) {
  return getPrivateNavigationGroups(role).flatMap((group) => group.items);
}
