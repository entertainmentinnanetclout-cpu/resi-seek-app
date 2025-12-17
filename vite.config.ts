import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const FALLBACK_SUPABASE_URL = "https://vmqqkebojldjsyxcewdb.supabase.co";
// NOTE: This is a publishable/anon key intended for frontend use.
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcXFrZWJvamxkanN5eGNld2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjE3OTUsImV4cCI6MjA3NTgzNzc5NX0.5NvBH0YOpV0ePVJrOrFalImCTuMtozY4Ah2G_l0tH7o";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Lovable preview sometimes doesn't hydrate .env into import.meta.env.
  // We define the public variables at build-time as a reliable fallback.
  const SUPABASE_URL =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    FALLBACK_SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        SUPABASE_PUBLISHABLE_KEY
      ),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
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
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                handler: "NetworkFirst",
                options: {
                  cacheName: "supabase-cache",
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24, // 24 hours
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
                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
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
          find: "@/integrations/supabase/client",
          replacement: path.resolve(
            __dirname,
            "./src/integrations/supabase/clientRuntime.ts"
          ),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    build: {
      chunkSizeWarningLimit: 1600, // ✅ increases limit to 1.6 MB to suppress large bundle warnings
    },
  };
});

