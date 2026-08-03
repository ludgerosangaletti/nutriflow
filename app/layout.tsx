import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./patient-experience/ui/shell-tokens.css";
import { PwaRegister } from "./pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ludgero Sangaletti | Nutrição Clínica e Esportiva",
  description:
    "Consultoria nutricional personalizada para emagrecimento, saúde e performance. Atendimento presencial em Guarapuava e online.",
  icons: {
    icon: "/logo-ludgero.png",
    shortcut: "/logo-ludgero.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NutriFlow" },
  other: { "codex-preview": "development", "theme-color": "#0a0a0a" },
};

export const viewport = { viewportFit: "cover" as const, themeColor: "#0a0a0a" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
