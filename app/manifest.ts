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
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
