import type { MetadataRoute } from "next";

/**
 * Manifesto PWA: com ele o Chrome oferece "Instalar app" — o LOCCONTROL vira
 * um aplicativo com ícone e janela próprios (desktop e Android), sem APK.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LOCCONTROL — Ciclo de vida de colaboradores",
    short_name: "LOCCONTROL",
    description: "Admissões, desligamentos e acessos do Grupo LOC",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1115",
    theme_color: "#2445b3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
