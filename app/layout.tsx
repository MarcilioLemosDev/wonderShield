import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Estrelas from "@/components/Estrelas";

export const metadata: Metadata = {
  title: "wonderblue · Console",
  description: "Console do wonderblue: acesso e bate-papo da rede.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <Estrelas />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
