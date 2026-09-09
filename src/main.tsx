// Build: 2026-09-09 - ResMap route Street View bridge
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ResMapLiveStreetViewBridge from "@/components/resmap/ResMapLiveStreetViewBridge";
import "./index.css";
import "./styles/mobile-foundation.css";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
    <ResMapLiveStreetViewBridge />
  </HelmetProvider>
);