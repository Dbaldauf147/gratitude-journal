import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gratitude Journal",
    short_name: "Gratitude",
    description:
      "A calm space to reflect on what you're grateful for, every day.",
    // `standalone` is what drops the Safari address bar and tab strip once the
    // app is on the home screen — the whole point of installing it.
    display: "standalone",
    // Open straight into the journal; the marketing page isn't useful to
    // someone who has already installed the app.
    start_url: "/dashboard",
    scope: "/",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    categories: ["lifestyle", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to the launcher's shape; the maskable art keeps the
      // sprig inside the safe circle so nothing important gets cut off.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Today's entry",
        short_name: "Today",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
