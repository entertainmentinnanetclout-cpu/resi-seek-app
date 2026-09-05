import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      // Only enable PWA in production to avoid dev caching/black screen issues
      mode === "production" &&
        VitePWA({
          registerType: "autoUpdate",
          devOptions: { enabled: false },
          includeAssets: ["icon-192.png", "icon-512.png", "icon-1024.png"],
          manifest: {
            name: "ResKonnect Simplified Portal",
            short_name: "ResKonnect",
            description:
              "Student Hub and Marketplace – campus life, accommodation, and career connection made easy.",
            theme_color: "#141414",
            background_color: "#000000",
            display: "standalone",
            orientation: "portrait",
            icons: [
              {
                src: "/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable",
              },
              {
                src: "/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable",
              },
              {
                src: "/icon-1024.png",
                sizes: "1024x1024",
                type: "image/png",
                purpose: "any maskable",
              },
            ],
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                handler: "NetworkFirst",
                options: {
                  cacheName: "supabase-cache",
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /\.(js|css|html|png|jpg|jpeg|svg|webp)$/,
                handler: "CacheFirst",
                options: {
                  cacheName: "static-assets",
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                  },
                },
              },
            ],
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: [
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
  };
});
