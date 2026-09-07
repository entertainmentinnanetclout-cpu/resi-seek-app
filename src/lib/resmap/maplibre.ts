declare global {
  interface Window { maplibregl?: any; }
}

let loader: Promise<any> | null = null;

export function loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("MapLibre requires a browser"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    if (!document.getElementById("resmap-maplibre-css")) {
      const css = document.createElement("link");
      css.id = "resmap-maplibre-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
      document.head.appendChild(css);
    }

    const existing = document.getElementById("resmap-maplibre-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.maplibregl));
      existing.addEventListener("error", () => reject(new Error("MapLibre failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = "resmap-maplibre-js";
    script.src = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
    script.async = true;
    script.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("MapLibre did not initialize"));
    script.onerror = () => reject(new Error("MapLibre failed to load"));
    document.head.appendChild(script);
  });

  return loader;
}
