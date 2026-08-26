import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRoot } from "@/components/pwa/PwaInstall";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://meu-financeiro-ia.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
      { url: "/favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Meu Financeiro IA",
    description: "Painel financeiro pessoal com IA",
    url: SITE_URL,
    siteName: "Meu Financeiro IA",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meu Financeiro IA",
    description: "Painel financeiro pessoal com IA",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-950">
        <Script id="pwa-capture" strategy="beforeInteractive">
          {`window.__pwaDeferred=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pwaDeferred=e;});`}
        </Script>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem("mf-theme")==="light"){document.documentElement.classList.add("light");document.documentElement.style.colorScheme="light";}else{document.documentElement.style.colorScheme="dark";}}catch(e){document.documentElement.style.colorScheme="dark";}})();`}
        </Script>
        <ThemeProvider>
          <PwaRoot />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
