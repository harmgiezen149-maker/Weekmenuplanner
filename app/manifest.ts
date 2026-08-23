import type { MetadataRoute } from "next";

// PWA-manifest: hiermee is de app installeerbaar op Android (Chrome) en
// gedraagt hij zich als volwaardige app op het beginscherm (eigen icoon,
// volledig scherm zonder browserbalk).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kookboek",
    short_name: "Kookboek",
    description: "Receptendatabase, weekplanning en boodschappenlijst",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#f7f7f5",
    orientation: "portrait",
    // Android: hiermee verschijnt de app in het deelmenu van de browser. Deel
    // je een receptpagina, dan komt hij binnen op /tracker/import.
    // iOS kent share_target niet; daar werkt het plakveld op diezelfde pagina.
    share_target: {
      action: "/tracker/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
