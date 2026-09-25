import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Divinol — SIA Elama",
    short_name: "Divinol",
    description: "Divinol oils and lubricants — official distributor SIA Elama.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e2d51",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
