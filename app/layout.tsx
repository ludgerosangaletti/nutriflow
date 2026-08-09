import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./patient-experience/ui/shell-tokens.css";
import { PwaRegister } from "./pwa-register";
import { StandaloneEntryRedirect } from "./standalone-entry-redirect";
import { MobileAppBanner } from "./mobile-app-banner";

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
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon-180.png",
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
      <head>
        <link rel="apple-touch-startup-image" href="/splash/iphone-1290x2796.png" media="(device-width:430px) and (device-height:932px) and (-webkit-device-pixel-ratio:3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1179x2556.png" media="(device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1170x2532.png" media="(device-width:390px) and (device-height:844px) and (-webkit-device-pixel-ratio:3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1125x2436.png" media="(device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-828x1792.png" media="(device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-750x1334.png" media="(device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
                if (!standalone && 'standalone' in navigator) standalone = !!navigator.standalone;
                if (standalone && window.location.pathname === '/') {
                  document.documentElement.classList.add('nf-standalone-opening');
                  window.location.replace('/app');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister />
        <StandaloneEntryRedirect />
        <MobileAppBanner />
        {children}
      </body>
    </html>
  );
}
