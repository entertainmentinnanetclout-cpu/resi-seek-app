declare global {
  interface Window {
    maplibregl?: any;
  }
}

const MAPLIBRE_MODERN_VERSION = "5.12.0";
const MAPLIBRE_COMPAT_VERSION = "4.7.1";
const SCRIPT_ID = "resmap-maplibre-js";
const CSS_ID = "resmap-maplibre-css";
const CRITICAL_CSS_ID = "resmap-maplibre-critical-css";

let loader: Promise<any> | null = null;

const criticalCss = `
.maplibregl-map{font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif;overflow:hidden;position:relative;-webkit-tap-highlight-color:rgba(0,0,0,0)}
.maplibregl-canvas-container{position:absolute;inset:0;width:100%;height:100%}
.maplibregl-canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.maplibregl-canvas-container.maplibregl-interactive{cursor:grab;user-select:none;-webkit-user-select:none}
.maplibregl-canvas-container.maplibregl-interactive:active{cursor:grabbing}
.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right,.maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{position:absolute;pointer-events:none;z-index:2}
.maplibregl-ctrl-top-left{left:0;top:0}.maplibregl-ctrl-top-right{right:0;top:0}.maplibregl-ctrl-bottom-left{bottom:0;left:0}.maplibregl-ctrl-bottom-right{bottom:0;right:0}
.maplibregl-ctrl{clear:both;pointer-events:auto;transform:translate(0)}
.maplibregl-ctrl-top-left .maplibregl-ctrl{float:left;margin:10px 0 0 10px}.maplibregl-ctrl-top-right .maplibregl-ctrl{float:right;margin:10px 10px 0 0}.maplibregl-ctrl-bottom-left .maplibregl-ctrl{float:left;margin:0 0 10px 10px}.maplibregl-ctrl-bottom-right .maplibregl-ctrl{float:right;margin:0 10px 10px 0}
.maplibregl-ctrl-group{background:#fff;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.1)}
.maplibregl-ctrl-group button{background:transparent;border:0;box-sizing:border-box;cursor:pointer;display:block;height:30px;outline:none;padding:0;width:30px}
.maplibregl-ctrl-attrib{background:rgba(255,255,255,.8);font-size:10px;line-height:12px;padding:2px 5px}
`;

function ensureCriticalCss() {
  if (document.getElementById(CRITICAL_CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CRITICAL_CSS_ID;
  style.textContent = criticalCss;
  document.head.appendChild(style);
}

function isLegacyIOS() {
  const ua = navigator.userAgent || "";
  if (!/iP(?:hone|ad|od)/i.test(ua)) return false;
  const match = ua.match(/OS (\d+)[._]/i);
  return Boolean(match && Number(match[1]) <= 16);
}

function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false } as WebGLContextAttributes));
  } catch {
    return false;
  }
}

function selectedVersion() {
  // MapLibre 5 is the normal path. iOS 16 and devices without WebGL2 use the
  // proven 4.7 compatibility build so the map never degrades to a blank canvas.
  return isLegacyIOS() || !supportsWebGL2() ? MAPLIBRE_COMPAT_VERSION : MAPLIBRE_MODERN_VERSION;
}

function ensureFullCss(version: string) {
  if (document.getElementById(CSS_ID)) return;
  const primary = document.createElement("link");
  primary.id = CSS_ID;
  primary.rel = "stylesheet";
  primary.href = `https://unpkg.com/maplibre-gl@${version}/dist/maplibre-gl.css`;
  primary.crossOrigin = "anonymous";
  primary.onerror = () => {
    if (document.getElementById(`${CSS_ID}-fallback`)) return;
    const fallback = document.createElement("link");
    fallback.id = `${CSS_ID}-fallback`;
    fallback.rel = "stylesheet";
    fallback.href = `https://cdn.jsdelivr.net/npm/maplibre-gl@${version}/dist/maplibre-gl.css`;
    fallback.crossOrigin = "anonymous";
    document.head.appendChild(fallback);
  };
  document.head.appendChild(primary);
}

function loadScript(url: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = id;
    script.src = url;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window.maplibregl ? resolve() : reject(new Error("MapLibre did not initialize"));
    script.onerror = () => reject(new Error("MapLibre failed to load"));
    document.head.appendChild(script);
  });
}

async function loadMapLibreScript(version: string) {
  const primary = `https://unpkg.com/maplibre-gl@${version}/dist/maplibre-gl.js`;
  const fallback = `https://cdn.jsdelivr.net/npm/maplibre-gl@${version}/dist/maplibre-gl.js`;
  try {
    await loadScript(primary, SCRIPT_ID);
  } catch {
    await loadScript(fallback, SCRIPT_ID);
  }
  if (!window.maplibregl) throw new Error("MapLibre did not initialize");
  return window.maplibregl;
}

function prepareMapLibre(maplibregl: any) {
  if (!maplibregl || maplibregl.__reskonnectPrepared) return maplibregl;

  const OriginalMap = maplibregl.Map;
  if (typeof OriginalMap !== "function") return maplibregl;

  class ResKonnectMap extends OriginalMap {
    private __rkResizeObserver?: ResizeObserver;
    private __rkResizeHandler?: () => void;
    private __rkVisualViewport?: VisualViewport | null;

    constructor(options: any) {
      super(options);

      const resize = () => {
        try { this.resize(); } catch { /* map may already be removed */ }
      };
      this.__rkResizeHandler = resize;

      const container = typeof options?.container === "string"
        ? document.getElementById(options.container)
        : options?.container;

      if (container && typeof ResizeObserver !== "undefined") {
        this.__rkResizeObserver = new ResizeObserver(() => resize());
        this.__rkResizeObserver.observe(container);
      }

      window.addEventListener("resize", resize, { passive: true });
      window.addEventListener("orientationchange", resize, { passive: true });
      this.__rkVisualViewport = window.visualViewport;
      this.__rkVisualViewport?.addEventListener("resize", resize, { passive: true });

      // iOS Safari can report an intermediate viewport while its browser chrome
      // is settling. Re-measure after mount, after paint, and once the map loads.
      requestAnimationFrame(() => resize());
      window.setTimeout(resize, 80);
      window.setTimeout(resize, 320);
      window.setTimeout(resize, 900);
      this.on("load", resize);
      this.on("idle", resize);
      this.on("remove", () => {
        this.__rkResizeObserver?.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("orientationchange", resize);
        this.__rkVisualViewport?.removeEventListener("resize", resize);
      });
    }
  }

  maplibregl.Map = ResKonnectMap;
  maplibregl.__reskonnectPrepared = true;
  return maplibregl;
}

export function loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("MapLibre requires a browser"));

  ensureCriticalCss();
  const version = selectedVersion();
  ensureFullCss(version);

  if (window.maplibregl) return Promise.resolve(prepareMapLibre(window.maplibregl));
  if (loader) return loader;

  loader = loadMapLibreScript(version)
    .then((maplibregl) => prepareMapLibre(maplibregl))
    .catch((error) => {
      // A transient CDN/network failure must not poison every later attempt in
      // the same browsing session. Re-opening ResMap gets a clean retry.
      loader = null;
      const stale = document.getElementById(SCRIPT_ID);
      stale?.remove();
      throw error;
    });

  return loader;
}
