import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRoot } from "@/components/pwa/PwaInstall";
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
  title: "Meu Financeiro IA",
  description: "Painel financeiro pessoal com IA",
  applicationName: "Meu Financeiro IA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Financeiro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950">
        <Script id="pwa-capture" strategy="beforeInteractive">
          {`window.__pwaDeferred=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pwaDeferred=e;});`}
        </Script>
        <PwaRoot />
        {children}
      </body>
    </html>
  );
}
