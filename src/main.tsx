// Build: 2026-02-04 v2 - Force env refresh
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  // SEO: The HelmetProvider is essential for managing document head changes with react-helmet-async.
  // It must wrap your application's root component.
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
