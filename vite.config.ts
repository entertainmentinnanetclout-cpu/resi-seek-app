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
      mode === "production" && process.env.RK_NATIVE_BUILD !== "1" &&
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
            display_override: ["standalone", "minimal-ui"],
            orientation: "any",
            start_url: "/?source=pwa",
            scope: "/",
            id: "/",
            categories: ["education", "lifestyle", "productivity"],
            shortcuts: [
              { name: "Find My Res", short_name: "Find a Res", url: "/find", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
              { name: "My ResKonnect", short_name: "Dashboard", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
              { name: "Opportunities", short_name: "Opportunities", url: "/opportunities", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
            ],
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
            // Keep install fast: precache only the shell. Route JS, maps and
            // large media are cached on demand instead of blocking first use.
            globPatterns: [
              "**/*.{html,css,woff,woff2,ico}",
              "assets/index-*.js",
            ],
            importScripts: ["/push-sw.js"],
            maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
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
                // Never persist authenticated Supabase REST/Auth/Functions/Storage
                // responses in the service-worker cache. Offline UX is provided by
                // the app shell and static assets, not by retaining user API data.
                urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                handler: "NetworkOnly",
              },
              {
                urlPattern: ({ request }) => request.mode === "navigate",
                handler: "NetworkFirst",
                options: {
                  cacheName: "navigation-pages-v4",
                  networkTimeoutSeconds: 3,
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
                // Application code is refreshed in the background so installed
                // PWAs do not get stuck on stale lazy chunks after a deployment.
                urlPattern: /\.(js|css)$/,
                handler: "StaleWhileRevalidate",
                options: {
                  cacheName: "static-code-v4",
                  expiration: {
                    maxEntries: 120,
                    maxAgeSeconds: 60 * 60 * 24 * 14,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /\.(png|jpg|jpeg|svg|webp|woff|woff2|ttf)$/,
                handler: "CacheFirst",
                options: {
                  cacheName: "static-media-v4",
                  expiration: {
                    maxEntries: 180,
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
      chunkSizeWarningLimit: 950,
    },
  };
});
