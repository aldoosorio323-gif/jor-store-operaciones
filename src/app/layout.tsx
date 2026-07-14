import type { Metadata } from "next";
import "./globals.css";

const themeScript = `(function(){try{var k="jor-store-theme";var p=localStorage.getItem(k);if(!["system","light","cream","dark"].includes(p)){p="system"}var r=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;var d=document.documentElement;d.dataset.theme=r;d.dataset.themePreference=p;d.style.colorScheme=r==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light";document.documentElement.dataset.themePreference="system"}})();`;

export const metadata: Metadata = {
  title: "JOR Store Operaciones",
  description: "Sistema interno de operaciones de JOR STORE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
