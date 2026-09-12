import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "production" &&
        VitePWA({
          registerType: "autoUpdate",
          devOptions: { enabled: false },
          includeAssets: [
            "apple-touch-icon.png",
            "icon-192.png",
            "icon-512.png",
            "icon-1024.png",
            "maskable-icon-192.png",
            "maskable-icon-512.png",
          ],
          manifest: {
            name: "ResKonnect — Living, AI, Opportunity",
            short_name: "ResKonnect",
            description:
              "Student accommodation, application readiness, live ResMap navigation, opportunities and AI guidance.",
            theme_color: "#071326",
            background_color: "#FFFFFF",
            display: "standalone",
            orientation: "portrait-primary",
            start_url: "/",
            scope: "/",
            icons: [
              {
                src: "/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
              },
              {
                src: "/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
              },
              {
                src: "/icon-1024.png",
                sizes: "1024x1024",
                type: "image/png",
                purpose: "any",
              },
              {
                src: "/maskable-icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
              },
              {
                src: "/maskable-icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
              },
            ],
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            navigateFallback: "/index.html",
            navigateFallbackDenylist: [
              /^\/api\//,
              /^\/sitemap(?:s)?\//,
              /^\/sitemap\.xml$/,
              /^\/robots\.txt$/,
            ],
            runtimeCaching: [
              {
                // Only public storage objects may be cached. Auth, REST, Realtime
                // and Edge Function responses can contain user or operational data
                // and must never enter the service-worker runtime cache.
                urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
                handler: "CacheFirst",
                options: {
                  cacheName: "supabase-public-assets-v3",
                  expiration: {
                    maxEntries: 80,
                    maxAgeSeconds: 60 * 60 * 24 * 7,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: ({ url, request }) =>
                  request.mode === "navigate" &&
                  /^(\/auth|\/admin|\/dashboard|\/profile|\/applications|\/reservations|\/recruit|\/residence)(\/|$)/.test(url.pathname),
                handler: "NetworkOnly",
              },
              {
                urlPattern: ({ request }) => request.mode === "navigate",
                handler: "NetworkFirst",
                options: {
                  cacheName: "navigation-pages-v3",
                  networkTimeoutSeconds: 4,
                  expiration: {
                    maxEntries: 40,
                    maxAgeSeconds: 60 * 60 * 24,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ttf)$/,
                handler: "CacheFirst",
                options: {
                  cacheName: "static-assets-v3",
                  expiration: {
                    maxEntries: 160,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
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
