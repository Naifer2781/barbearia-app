import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barbearia — Marcações online",
  description: "Marque o seu corte online, consulte as suas marcações e o seu cartão de fidelidade.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
