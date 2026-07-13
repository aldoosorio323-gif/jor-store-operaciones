import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
