import type { SVGProps } from "react";

export type IconName =
  | "home" | "customers" | "orders" | "payments" | "products" | "inventory"
  | "movements" | "transfers" | "purchases" | "suppliers" | "warehouses"
  | "adjustments" | "users" | "profile" | "menu" | "close" | "search"
  | "plus" | "arrow-left" | "chevron-left" | "chevron-right" | "logout"
  | "box" | "info" | "check" | "warning" | "sun" | "moon" | "monitor" | "cream";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  orders: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
  products: <><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  inventory: <><path d="M4 7h16v14H4zM2 3h20v4H2z"/><path d="M9 11h6"/></>,
  movements: <><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/></>,
  transfers: <><path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/></>,
  purchases: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 11h11L21 8H7"/></>,
  suppliers: <><path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8M9 9h.01M15 9h.01"/></>,
  warehouses: <><path d="M3 21V8l9-5 9 5v13H3Z"/><path d="M7 21v-8h10v8M7 17h10"/></>,
  adjustments: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/></>,
  users: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, plus: <path d="M12 5v14M5 12h14"/>,
  "arrow-left": <path d="m15 18-6-6 6-6"/>, "chevron-left": <path d="m15 18-6-6 6-6"/>, "chevron-right": <path d="m9 18 6-6-6-6"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M15 3h5v18h-5"/></>, box: <><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>, check: <path d="m5 12 4 4L19 6"/>,
  warning: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></>,
  cream: <><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h5"/></>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
