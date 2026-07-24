import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/logo-ludgero.png",
    shortcut: "/logo-ludgero.png",
  },
};

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
        {children}
      </body>
    </html>
  );
}
