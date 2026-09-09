import { useEffect, useMemo, useState } from "react";
import { BarChart3, Crown, Eye, Loader2, MousePointerClick, Route, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { tourApi } from "@/lib/virtualTours/api";
import { toast } from "sonner";

type Props = { residenceId: string };

const metric = (value: unknown) => Number(value || 0).toLocaleString("en-ZA");

export default function VirtualTourGoldAnalytics({ residenceId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await tourApi<any>("analytics_summary", { residence_id: residenceId, days: 30 })); }
    catch (error: any) { setData({ locked: true, error: error?.message || "Analytics unavailable" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [residenceId]);

  const conversionRate = useMemo(() => {
    const opens = Number(data?.metrics?.tour_opens || 0);
    const conversions = Number(data?.metrics?.conversion_actions || 0);
    return opens > 0 ? Math.min(100, conversions / opens * 100) : 0;
  }, [data]);

  const requestUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const result = await tourApi<any>("request_upgrade", { residence_id: residenceId, requested_plan: "gold" });
      if (result?.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      toast.success("Gold upgrade request prepared.");
    } catch (error: any) { toast.error(error?.message || "Could not prepare Gold upgrade request."); }
    finally { setUpgradeBusy(false); }
  };

  if (loading) return <Card><CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading 360 intelligence…</CardContent></Card>;

  if (data?.locked) return <Card className="overflow-hidden border-[#F5B32F]/30">
    <CardHeader className="bg-gradient-to-r from-[#071326] to-[#0b2752] text-white"><div className="flex items-center gap-3"><Crown className="h-7 w-7 text-[#F5B32F]" /><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#F5B32F]">Gold Intelligence</p><CardTitle>Unlock tour analytics</CardTitle></div></div></CardHeader>
    <CardContent className="space-y-4 p-5"><p className="text-sm text-muted-foreground">Gold residences receive 30-day engagement intelligence, scene popularity, guided-tour completion and conversion tracking from the 4K viewer.</p><Button onClick={() => void requestUpgrade()} disabled={upgradeBusy} className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffd16e]">{upgradeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request Gold access</Button></CardContent>
  </Card>;

  const metrics = data?.metrics || {};
  return <Card className="overflow-hidden border-[#F5B32F]/25">
    <CardHeader className="border-b bg-muted/20"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Crown className="h-5 w-5 text-[#C78A00]" /><CardTitle className="text-lg">Gold tour intelligence</CardTitle></div><p className="mt-1 text-xs text-muted-foreground">Rolling {data?.days || 30}-day performance · ResKonnect 360 Studio</p></div><Badge className="bg-[#071326] text-white"><Sparkles className="mr-1 h-3.5 w-3.5 text-[#F5B32F]" />Gold</Badge></div></CardHeader>
    <CardContent className="space-y-5 p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Tour opens", metrics.tour_opens, Eye],
          ["Unique viewers", metrics.unique_viewers, Users],
          ["Scene views", metrics.scene_views, Route],
          ["Conversion actions", metrics.conversion_actions, MousePointerClick],
        ].map(([label,value,Icon]: any)=><div key={label} className="rounded-2xl border bg-muted/20 p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{metric(value)}</p></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black">Tour → action rate</p><p className="text-xs text-muted-foreground">Apply, listing, contact and guided-completion actions</p></div><span className="text-xl font-black">{conversionRate.toFixed(1)}%</span></div><Progress value={conversionRate} className="mt-4 h-2"/><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Guided starts</p><p className="mt-1 font-black">{metric(metrics.guided_starts)}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Guided completed</p><p className="mt-1 font-black">{metric(metrics.guided_completions)}</p></div></div></div>
        <div className="rounded-2xl border p-4"><p className="flex items-center gap-2 font-black"><BarChart3 className="h-4 w-4"/>Most viewed scenes</p><div className="mt-3 space-y-2">{(data?.top_scenes || []).slice(0,6).map((scene:any,index:number)=><div key={scene.scene_id || index} className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{scene.name || "Scene"}</p><p className="text-[10px] text-muted-foreground">{scene.area_type || "tour scene"}</p></div><Badge variant="outline">{metric(scene.views)} views</Badge></div>)}{!(data?.top_scenes || []).length&&<p className="py-6 text-center text-sm text-muted-foreground">Engagement data will appear after students begin viewing the tour.</p>}</div></div>
      </div>
    </CardContent>
  </Card>;
}
