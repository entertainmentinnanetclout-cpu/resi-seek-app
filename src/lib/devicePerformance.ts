import { isNativeApp } from "@/lib/accountRouting";

export type PerformanceTier = "constrained" | "balanced" | "full";

function connectionSaveData() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(connection?.saveData) || ["slow-2g", "2g"].includes(String(connection?.effectiveType || ""));
}

export function runtimePerformanceTier(): PerformanceTier {
  if (typeof navigator === "undefined") return "balanced";
  if (isNativeApp()) return "constrained";

  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const memory = Number(nav.deviceMemory || 0);
  const cores = Number(nav.hardwareConcurrency || 0);
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (connectionSaveData() || reducedMotion || ios || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return "constrained";
  if ((memory > 0 && memory <= 8) || (cores > 0 && cores <= 8)) return "balanced";
  return "full";
}

export function graphicsBudget() {
  const tier = runtimePerformanceTier();
  return {
    tier,
    allowHeavy3d: tier !== "constrained",
    dpr: tier === "full" ? [1, 1.75] as [number, number] : [1, 1.2] as [number, number],
    antialias: tier === "full",
    sphereSegments: tier === "full" ? [96, 64] as [number, number] : [64, 40] as [number, number],
    maxGalleryDecode: tier === "full" ? 5 : tier === "balanced" ? 3 : 2,
  };
}
