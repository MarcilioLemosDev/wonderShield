import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Estrelas from "@/components/Estrelas";
import Energia from "@/components/Energia";
import PWA from "@/components/PWA";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--sans",
});

// Serifa de display para títulos e para a marca — o contraponto editorial que
// tira a interface do lugar de "painel de sistema".
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--serif",
});

export const metadata: Metadata = {
  title: "wonderblue",
  description: "Uma rede sem anúncios, por convite. Conversa que vira encontro.",
  applicationName: "wonderblue",
  appleWebApp: {
    capable: true,
    title: "wonderblue",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <PWA />
        <Estrelas />
        <Energia />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
