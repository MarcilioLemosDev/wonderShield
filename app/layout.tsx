import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "WonderShield · Console",
  description: "Console de operações do WonderShield: engajamentos, rede e a arena.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
