import { useState } from "react";
import { Compass, LocateFixed, Navigation, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requestLiveLocation, useLiveLocation } from "@/lib/resmap/liveLocation";

export function FindMyResLocationPrompt() {
  const live = useLiveLocation();
  const [expanded, setExpanded] = useState(live.status !== "granted");
  const requesting = live.status === "requesting";

  if (live.status === "granted" && !expanded) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
        >
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          Live location on
          {live.effectiveHeading != null && <span className="text-emerald-700">· heading {Math.round(live.effectiveHeading)}°</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Navigation className="h-5 w-5" />
              {live.status === "granted" && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-500" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black text-slate-950 sm:text-base">Use your live location for Find My Res</h2>
                {live.status === "granted" && <Badge className="bg-emerald-600 text-white">LIVE</Badge>}
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
                ResKonnect can rank nearby accommodation, start routes from where you actually are, and show the direction your phone is facing. Your browser still controls the permission.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" />nearest residences</span>
                <span className="inline-flex items-center gap-1"><Compass className="h-3.5 w-3.5" />heading & navigation</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />permission controlled by you</span>
              </div>
              {live.error && live.status !== "granted" && <p className="mt-2 text-xs font-semibold text-amber-700">{live.error}. You can enable Location for this site in your browser settings.</p>}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {live.status !== "granted" ? (
              <Button
                type="button"
                disabled={requesting}
                className="h-11 flex-1 rounded-xl bg-[#0b4a87] px-5 text-white sm:flex-none"
                onClick={async () => {
                  const ok = await requestLiveLocation();
                  if (ok) setExpanded(false);
                }}
              >
                <LocateFixed className="mr-2 h-4 w-4" />{requesting ? "Requesting…" : "Enable live location"}
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setExpanded(false)}>Keep enabled</Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
