import type { MetadataRoute } from "next";

// O manifesto que torna o wonderblue instalável — na tela inicial do celular,
// abrindo em tela cheia como um app. Next serve isto em /manifest.webmanifest e
// injeta o <link rel="manifest"> sozinho.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wonderblue",
    short_name: "wonderblue",
    description: "Uma rede sem anúncios, por convite. Conversa que vira encontro.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070d",
    theme_color: "#05070d",
    lang: "pt-BR",
    categories: ["social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
