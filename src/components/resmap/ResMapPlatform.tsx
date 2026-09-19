import { lazy, Suspense } from "react";
import { isNativeApp } from "@/lib/accountRouting";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";

const NativeMap = lazy(() => import("./NativeResMapExperience"));
const WebMap = lazy(() => import("./ResMapExperiencePremiumV4"));
type Props = { filters: ResidenceFilters; updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void; resetFilters: () => void; onClose: () => void };
/** Prevent the Web photorealistic map and Android WebView-safe map from sharing a mount. */
export default function ResMapPlatform(props: Props) {
  const Map = isNativeApp() ? NativeMap : WebMap;
  return <Suspense fallback={<div role="status" className="fixed inset-0 z-[250] grid place-items-center bg-background text-sm text-foreground">Opening ResMap…</div>}><Map {...props} /></Suspense>;
}
