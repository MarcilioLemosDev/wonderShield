import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Estrelas from "@/components/Estrelas";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--sans",
});

export const metadata: Metadata = {
  title: "wonderblue",
  description: "Uma rede sem anúncios, por convite. Conversa que vira encontro.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable}>
      <body>
        <Estrelas />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
