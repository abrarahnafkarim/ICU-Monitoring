import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Keep the installed app up to date automatically on each deploy.
      registerType: "autoUpdate",
      injectRegister: "auto",

      // Auto-generate the full icon set (favicon, apple-touch, maskable,
      // 192/512) from one source SVG and inject the <link> tags.
      pwaAssets: {
        image: "public/app-icon.svg",
      },

      manifest: {
        name: "Remote Patient Monitoring System",
        short_name: "RPM Monitor",
        description: "Continuous health monitoring platform — live vitals, ECG and video.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        background_color: "#0B1220",
        theme_color: "#0B1220",
        orientation: "any",
        categories: ["medical", "health", "productivity"],
      },

      workbox: {
        // Precache the app shell. The Plotly chunk is large, so raise the
        // per-file cache limit above the 2 MB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        navigateFallback: "index.html",
        // Never cache the live API / data — always hit the network.
        navigateFallbackDenylist: [/^\/(patient|latest-vitals|health|ws|ingest)/],
        cleanupOutdatedCaches: true,
      },

      // Let us test the PWA (manifest + SW) in `npm run dev` too.
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
