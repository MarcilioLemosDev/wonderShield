import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Estrelas from "@/components/Estrelas";
import Energia from "@/components/Energia";

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <Estrelas />
        <Energia />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
