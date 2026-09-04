import type { MetadataRoute } from "next";

// Next.js sirve esto en /manifest.webmanifest y lo enlaza solo en el <head>
// (no hace falta agregar <link rel="manifest"> a mano).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gmail Swipe",
    short_name: "Gmail Swipe",
    description: "Triá tu bandeja de Gmail deslizando tarjetas, como en Tinder.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
