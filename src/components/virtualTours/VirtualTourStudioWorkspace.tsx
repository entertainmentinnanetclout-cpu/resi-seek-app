import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Camera, CheckCircle2, Crown, ExternalLink, GitBranch, Loader2, MapPinned, Plus, RefreshCw, ShieldCheck, Sparkles, View, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import Guided360Capture from "@/components/virtualTours/Guided360Capture";
import { tourApi } from "@/lib/virtualTours/api";

type Props = { admin?: boolean; residenceId?: string | null };

const areas = ["exterior","entrance","room","unit","bathroom","kitchen","common","lounge","laundry","study","parking","gym","corridor","other"];

export default function VirtualTourStudioWorkspace({ admin = false, residenceId: fixedResidenceId }: Props) {
  const [adminData, setAdminData] = useState<any>(null);
  const [residenceId, setResidenceId] = useState(fixedResidenceId || "");
  const [workspace, setWorkspace] = useState<any>(null);
  const [selectedTourId, setSelectedTourId] = useState("");
  const [builder, setBuilder] = useState<any>(null);
  const [captureScene, setCaptureScene] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tourTitle, setTourTitle] = useState("");
  const [sceneName, setSceneName] = useState("Bedroom");
  const [sceneArea, setSceneArea] = useState("room");
  const [floorLabel, setFloorLabel] = useState("");
  const [connectionFrom, setConnectionFrom] = useState("");
  const [connectionTo, setConnectionTo] = useState("");
  const [hotspotScene, setHotspotScene] = useState("");
  const [hotspotLabel, setHotspotLabel] = useState("Feature");
  const [hotspotYaw, setHotspotYaw] = useState("0");
  const [hotspotPitch, setHotspotPitch] = useState("0");

  const loadAdmin = async () => {
    if (!admin) return;
    try { setAdminData(await tourApi<any>("admin_summary")); }
    catch (error: any) { toast.error(error?.message || "Could not load 360 Studio summary."); }
  };
  const loadWorkspace = async (id = residenceId) => {
    if (!id) return;
    setBusy(true);
    try {
      const data = await tourApi<any>("residence_workspace", { residence_id: id });
      setWorkspace(data);
      const preferred = selectedTourId && data.tours?.some((tour: any) => tour.id === selectedTourId) ? selectedTourId : data.tours?.[0]?.id || "";
      setSelectedTourId(preferred);
      if (preferred) await loadBuilder(preferred);
      else setBuilder(null);
    } catch (error: any) { setWorkspace(null); toast.error(error?.message || "Could not load residence 360 Studio."); }
    finally { setBusy(false); }
  };
  const loadBuilder = async (tourId = selectedTourId) => {
    if (!tourId) return;
    try { setBuilder(await tourApi<any>("tour_builder", { tour_id: tourId })); }
    catch (error: any) { toast.error(error?.message || "Could not load tour builder."); }
  };

  useEffect(() => { void loadAdmin(); }, [admin]);
  useEffect(() => { if (fixedResidenceId) void loadWorkspace(fixedResidenceId); }, [fixedResidenceId]);
  useEffect(() => { if (residenceId && !fixedResidenceId) void loadWorkspace(residenceId); }, [residenceId]);

  const selectedTour = useMemo(() => workspace?.tours?.find((tour: any) => tour.id === selectedTourId) || null, [workspace, selectedTourId]);
  const scenes = builder?.scenes || [];
  const readiness = builder?.readiness || {};

  const createTour = async () => {
    if (!residenceId) return toast.error("Choose a residence first.");
    setBusy(true);
    try {
      const data = await tourApi<any>("create_tour", { residence_id: residenceId, title: tourTitle || `${workspace?.residence?.name || "Residence"} Virtual Tour` });
      setTourTitle(""); setSelectedTourId(data.tour.id); await loadWorkspace(residenceId); await loadBuilder(data.tour.id); toast.success("Virtual tour created.");
    } catch (error: any) { toast.error(error?.message || "Could not create tour."); }
    finally { setBusy(false); }
  };
  const createScene = async () => {
    if (!selectedTourId) return toast.error("Create or select a tour first.");
    setBusy(true);
    try {
      const data = await tourApi<any>("create_scene", { tour_id: selectedTourId, name: sceneName || "Scene", area_type: sceneArea, floor_label: floorLabel || null, source_mode: "guided_mobile" });
      setSceneName("Bedroom"); setFloorLabel(""); await loadBuilder(); setCaptureScene(data.scene); toast.success("Scene created. Start capture when ready.");
    } catch (error: any) { toast.error(error?.message || "Could not create scene."); }
    finally { setBusy(false); }
  };
  const setStart = async (sceneId: string) => { try { await tourApi("set_start_scene", { scene_id: sceneId }); await loadBuilder(); toast.success("Start scene updated."); } catch (e: any) { toast.error(e?.message || "Could not set start scene."); } };
  const addConnection = async () => {
    if (!connectionFrom || !connectionTo) return;
    try { await tourApi("upsert_connection", { tour_id: selectedTourId, from_scene_id: connectionFrom, to_scene_id: connectionTo, label: "Continue", yaw: 0, pitch: 0 }); await loadBuilder(); toast.success("Scene connection added."); }
    catch (e: any) { toast.error(e?.message || "Could not connect scenes."); }
  };
  const addHotspot = async () => {
    if (!hotspotScene || !hotspotLabel) return;
    try { await tourApi("create_hotspot", { tour_id: selectedTourId, scene_id: hotspotScene, hotspot_type: "info", label: hotspotLabel, yaw: Number(hotspotYaw || 0), pitch: Number(hotspotPitch || 0) }); await loadBuilder(); toast.success("Hotspot added."); }
    catch (e: any) { toast.error(e?.message || "Could not add hotspot."); }
  };
  const submitReview = async () => { try { await tourApi("submit_review", { tour_id: selectedTourId }); await loadWorkspace(); await loadBuilder(); toast.success("Tour submitted for ResKonnect review."); } catch (e: any) { toast.error(e?.message || "Tour is not ready for review."); } };
  const publish = async () => { try { const data = await tourApi<any>("publish_tour", { tour_id: selectedTourId }); await loadWorkspace(); await loadBuilder(); toast.success("Tour published."); if (data.public_url) window.open(data.public_url, "_blank", "noopener,noreferrer"); } catch (e: any) { toast.error(e?.message || "Could not publish tour."); } };

  if (!residenceId && admin) return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Tours",adminData?.summary?.tours||0],["Published",adminData?.summary?.published||0],["Scenes",adminData?.summary?.scenes||0],["Avg quality",`${adminData?.summary?.avg_quality||0}%`]].map(([label,value])=><Card key={String(label)}><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></CardContent></Card>)}</div>
    <Card className="overflow-hidden border-[#F5B32F]/30"><CardHeader className="bg-gradient-to-r from-[#071326] to-[#0b2752] text-white"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5B32F] text-[#071326]"><Rotate3DIcon /></div><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#F5B32F]">ResKonnect Gold Tool</p><CardTitle>360 Studio V2</CardTitle></div></div></CardHeader><CardContent className="space-y-4 p-5"><p className="text-sm text-muted-foreground">Choose a residence to create, capture, build and publish a verified 4K virtual tour.</p><Select value={residenceId} onValueChange={setResidenceId}><SelectTrigger><SelectValue placeholder="Choose residence" /></SelectTrigger><SelectContent>{(adminData?.residences||[]).map((r:any)=><SelectItem key={r.id} value={r.id}>{r.name} · {r.campus||r.city||""}</SelectItem>)}</SelectContent></Select></CardContent></Card>
  </div>;

  if (busy && !workspace) return <div className="grid min-h-72 place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading 360 Studio…</div></div>;

  if (workspace && !workspace.access?.allowed && !admin) return <Card className="overflow-hidden border-[#F5B32F]/30"><CardHeader className="bg-[#071326] text-white"><Crown className="h-8 w-8 text-[#F5B32F]" /><CardTitle>Unlock ResKonnect 360 Studio</CardTitle></CardHeader><CardContent className="space-y-4 p-6"><p className="text-sm text-muted-foreground">Premium and Gold residences can capture and build 4K immersive tours directly from a supported phone. Your current plan is <strong>{workspace.access?.plan || "standard"}</strong>.</p><Button disabled className="bg-[#F5B32F] text-[#071326]">Premium access required</Button></CardContent></Card>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#071326] text-white"><Crown className="mr-1 h-3.5 w-3.5 text-[#F5B32F]" />Gold Tool</Badge><Badge variant="outline">V2 · RG1 + RG2</Badge>{workspace?.access?.plan && <Badge variant="secondary">{workspace.access.plan}</Badge>}</div><h2 className="mt-2 text-2xl font-black">{workspace?.residence?.name || "ResKonnect 360 Studio"}</h2><p className="text-sm text-muted-foreground">Guided mobile capture, private raw frames, 4K scene assembly, quality scoring, tour graph, hotspots, versioned publishing and public viewer.</p></div><div className="flex gap-2">{admin && <Button variant="outline" onClick={() => { setResidenceId(""); setWorkspace(null); setBuilder(null); }}><Building2 className="mr-2 h-4 w-4" />Change residence</Button>}<Button variant="outline" onClick={() => void loadWorkspace()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></div>

    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Tours</CardTitle></CardHeader><CardContent className="space-y-2">{(workspace?.tours||[]).map((tour:any)=><button key={tour.id} onClick={() => { setSelectedTourId(tour.id); void loadBuilder(tour.id); }} className={`w-full rounded-xl border p-3 text-left transition ${selectedTourId===tour.id?"border-primary bg-primary/5":"hover:bg-muted/50"}`}><div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{tour.title}</p><Badge variant={tour.status==="published"?"default":"outline"}>{tour.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{tour.virtual_tour_scenes?.length||0} scenes · v{tour.current_version||1}</p></button>)}{!(workspace?.tours||[]).length&&<p className="text-sm text-muted-foreground">No tours yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">New tour</CardTitle></CardHeader><CardContent className="space-y-2"><Input value={tourTitle} onChange={(e)=>setTourTitle(e.target.value)} placeholder="Residence Virtual Tour"/><Button onClick={createTour} disabled={busy} className="w-full"><Plus className="mr-2 h-4 w-4" />Create tour</Button></CardContent></Card>
      </aside>

      <section className="space-y-5">
        {!selectedTourId ? <Card><CardContent className="grid min-h-72 place-items-center p-8 text-center"><div><WandSparkles className="mx-auto h-10 w-10 text-muted-foreground"/><p className="mt-3 font-black">Create or select a tour</p></div></CardContent></Card> : <>
          <Card className="overflow-hidden"><CardHeader className="border-b bg-muted/20"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{selectedTour?.title || builder?.tour?.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Public token: {selectedTour?.public_token || builder?.tour?.public_token}</p></div><div className="flex flex-wrap gap-2">{selectedTour?.status==="published"&&<Button size="sm" variant="outline" asChild><a href={`/tour/${selectedTour.public_token}`} target="_blank" rel="noreferrer"><View className="mr-2 h-4 w-4"/>View live</a></Button>}<Button size="sm" variant="outline" onClick={()=>void loadBuilder()}><RefreshCw className="mr-2 h-4 w-4"/>Reload</Button></div></div></CardHeader><CardContent className="p-5"><div className="grid gap-3 sm:grid-cols-4">{[["Ready",readiness.ready_scenes||0],["Total",readiness.scene_total||0],["Below quality",readiness.below_quality||0],["Minimum",`${readiness.min_quality||82}%`]].map(([label,value])=><div key={String(label)} className="rounded-2xl border bg-muted/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div><div className="mt-4 flex items-center gap-2"><Progress value={readiness.scene_total ? Math.min(100,(readiness.ready_scenes||0)/readiness.scene_total*100) : 0} className="h-2 flex-1"/>{readiness.publishable?<Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5"/>Publishable</Badge>:<Badge variant="outline">Draft</Badge>}</div></CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Add scene</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-4"><Input value={sceneName} onChange={(e)=>setSceneName(e.target.value)} placeholder="Bedroom 1"/><Select value={sceneArea} onValueChange={setSceneArea}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{areas.map((a)=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select><Input value={floorLabel} onChange={(e)=>setFloorLabel(e.target.value)} placeholder="Floor / Unit (optional)"/><Button onClick={createScene} disabled={busy}><Camera className="mr-2 h-4 w-4"/>Create & capture</Button></CardContent></Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{scenes.map((scene:any)=><Card key={scene.id} className={scene.is_start?"border-[#F5B32F]/60":""}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black">{scene.name}</p><p className="text-xs text-muted-foreground">{scene.area_type}{scene.floor_label?` · ${scene.floor_label}`:""}</p></div><Badge variant={scene.status==="published"||scene.status==="ready"?"default":"outline"}>{scene.status}</Badge></div>{scene.panorama_url?<div className="relative overflow-hidden rounded-xl bg-muted"><img src={scene.thumbnail_path||scene.panorama_url} alt="" className="h-28 w-full object-cover"/><div className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black text-white">4K · {Math.round(Number(scene.quality_score||0))}%</div></div>:<div className="grid h-28 place-items-center rounded-xl border border-dashed bg-muted/20"><Camera className="h-7 w-7 text-muted-foreground"/></div>}<div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={()=>setCaptureScene(scene)}><Camera className="mr-1.5 h-3.5 w-3.5"/>{scene.panorama_url?"Recapture":"Capture"}</Button><Button size="sm" variant={scene.is_start?"default":"outline"} onClick={()=>void setStart(scene.id)}><MapPinned className="mr-1.5 h-3.5 w-3.5"/>{scene.is_start?"Start scene":"Set start"}</Button></div></CardContent></Card>)}</div>

          {scenes.length>1&&<Card><CardHeader><CardTitle className="text-base">Tour graph</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><div className="space-y-2 rounded-2xl border p-4"><p className="flex items-center gap-2 font-bold"><GitBranch className="h-4 w-4"/>Connect scenes</p><div className="grid grid-cols-2 gap-2"><Select value={connectionFrom} onValueChange={setConnectionFrom}><SelectTrigger><SelectValue placeholder="From"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Select value={connectionTo} onValueChange={setConnectionTo}><SelectTrigger><SelectValue placeholder="To"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><Button size="sm" onClick={addConnection} disabled={!connectionFrom||!connectionTo||connectionFrom===connectionTo}>Add connection</Button><div className="space-y-1 text-xs text-muted-foreground">{(builder?.connections||[]).map((c:any)=><p key={c.id}>• {scenes.find((s:any)=>s.id===c.from_scene_id)?.name} → {scenes.find((s:any)=>s.id===c.to_scene_id)?.name}</p>)}</div></div><div className="space-y-2 rounded-2xl border p-4"><p className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4"/>Information hotspot</p><Select value={hotspotScene} onValueChange={setHotspotScene}><SelectTrigger><SelectValue placeholder="Scene"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Input value={hotspotLabel} onChange={(e)=>setHotspotLabel(e.target.value)} placeholder="Wi-Fi included"/><div className="grid grid-cols-2 gap-2"><Input value={hotspotYaw} onChange={(e)=>setHotspotYaw(e.target.value)} placeholder="Yaw"/><Input value={hotspotPitch} onChange={(e)=>setHotspotPitch(e.target.value)} placeholder="Pitch"/></div><Button size="sm" onClick={addHotspot} disabled={!hotspotScene||!hotspotLabel}>Add hotspot</Button></div></CardContent></Card>}

          <Card className="border-emerald-500/20"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-emerald-600"/>Review & publish</p><p className="mt-1 text-sm text-muted-foreground">Publishing creates an immutable version snapshot. Previous live versions remain archived instead of being overwritten.</p></div><div className="flex gap-2">{!admin&&<Button variant="outline" disabled={!readiness.publishable} onClick={submitReview}><BadgeCheck className="mr-2 h-4 w-4"/>Submit review</Button>}{admin&&<Button disabled={!readiness.publishable} onClick={publish} className="bg-emerald-600 hover:bg-emerald-700"><ExternalLink className="mr-2 h-4 w-4"/>Publish live</Button>}</div></CardContent></Card>
        </>}
      </section>
    </div>
    {captureScene&&<Guided360Capture scene={{...captureScene,tour_id:selectedTourId}} onClose={()=>setCaptureScene(null)} onComplete={async()=>{setCaptureScene(null);await loadWorkspace();await loadBuilder();}}/>}
  </div>;
}

function Rotate3DIcon(){ return <WandSparkles className="h-6 w-6"/>; }
