import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WonderShield // Arena",
  description: "Arena ao vivo de ataque e defesa dentro de um labirinto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
