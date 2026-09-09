import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Camera, CheckCircle2, Crown, ExternalLink, GitBranch, Loader2, MapPinned, Plus, RefreshCw, ShieldCheck, Sparkles, View, WandSparkles, Box, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import Guided360Capture from "@/components/virtualTours/Guided360Capture";
import { tourApi } from "@/lib/virtualTours/api";

type Props = { admin?: boolean; residenceId?: string | null; standaloneOnly?: boolean };
type StudioMode = "home" | "standalone" | "residence";
const areas = ["space","room","object","product","showroom","office","classroom","venue","outdoor","exterior","entrance","unit","bathroom","kitchen","common","lounge","laundry","study","parking","gym","corridor","other"];

export default function VirtualTourStudioWorkspace({ admin = false, residenceId: fixedResidenceId, standaloneOnly = false }: Props) {
  const initialMode: StudioMode = fixedResidenceId ? "residence" : (standaloneOnly || !admin ? "standalone" : "home");
  const [mode, setMode] = useState<StudioMode>(initialMode);
  const [adminData, setAdminData] = useState<any>(null);
  const [residenceId, setResidenceId] = useState(fixedResidenceId || "");
  const [workspace, setWorkspace] = useState<any>(null);
  const [selectedTourId, setSelectedTourId] = useState("");
  const [builder, setBuilder] = useState<any>(null);
  const [captureScene, setCaptureScene] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tourTitle, setTourTitle] = useState("");
  const [sceneName, setSceneName] = useState("Room / Space");
  const [sceneArea, setSceneArea] = useState("space");
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
  const loadBuilder = async (tourId = selectedTourId) => {
    if (!tourId) { setBuilder(null); return; }
    try { setBuilder(await tourApi<any>("tour_builder", { tour_id: tourId })); }
    catch (error: any) { toast.error(error?.message || "Could not load tour builder."); }
  };
  const loadWorkspace = async (targetMode = mode, targetResidence = residenceId, preferredTourId?: string) => {
    if (targetMode === "home") return;
    if (targetMode === "residence" && !targetResidence) return;
    setBusy(true);
    try {
      const data = targetMode === "standalone"
        ? await tourApi<any>("standalone_workspace")
        : await tourApi<any>("residence_workspace", { residence_id: targetResidence });
      setWorkspace(data);
      const preferred = preferredTourId || (selectedTourId && data.tours?.some((tour: any) => tour.id === selectedTourId) ? selectedTourId : data.tours?.[0]?.id || "");
      setSelectedTourId(preferred);
      await loadBuilder(preferred);
    } catch (error: any) {
      setWorkspace(null); setBuilder(null);
      toast.error(error?.message || "Could not load 360 Studio.");
    } finally { setBusy(false); }
  };

  useEffect(() => { void loadAdmin(); }, [admin]);
  useEffect(() => { if (fixedResidenceId) { setMode("residence"); void loadWorkspace("residence", fixedResidenceId); } }, [fixedResidenceId]);
  useEffect(() => { if (!fixedResidenceId && (standaloneOnly || !admin)) void loadWorkspace("standalone", ""); }, [fixedResidenceId, standaloneOnly, admin]);

  const selectedTour = useMemo(() => workspace?.tours?.find((tour: any) => tour.id === selectedTourId) || builder?.tour || null, [workspace, selectedTourId, builder]);
  const scenes = builder?.scenes || [];
  const readiness = builder?.readiness || {};
  const standalone = mode === "standalone" || selectedTour?.workspace_type === "standalone";

  const chooseStandalone = async () => { setMode("standalone"); setResidenceId(""); setSelectedTourId(""); setBuilder(null); await loadWorkspace("standalone", ""); };
  const chooseResidence = async (id: string) => { setResidenceId(id); setMode("residence"); setSelectedTourId(""); setBuilder(null); await loadWorkspace("residence", id); };
  const createTour = async () => {
    setBusy(true);
    try {
      const payload = mode === "residence" ? { residence_id: residenceId, title: tourTitle || `${workspace?.residence?.name || "Residence"} Virtual Tour` } : { title: tourTitle || "My 360 View", workspace_label: tourTitle || "My 360 View" };
      if (mode === "residence" && !residenceId) throw new Error("Choose a residence first.");
      const data = await tourApi<any>("create_tour", payload);
      setTourTitle("");
      await loadWorkspace(mode, residenceId, data.tour.id);
      toast.success(standalone ? "Standalone 360 project created." : "Virtual tour created.");
    } catch (error: any) { toast.error(error?.message || "Could not create 360 project."); }
    finally { setBusy(false); }
  };
  const createScene = async () => {
    if (!selectedTourId) return toast.error("Create or select a 360 project first.");
    setBusy(true);
    try {
      const data = await tourApi<any>("create_scene", { tour_id: selectedTourId, name: sceneName || "Scene", area_type: sceneArea, floor_label: floorLabel || null, source_mode: "guided_mobile" });
      setSceneName("Room / Space"); setFloorLabel(""); await loadBuilder(); setCaptureScene(data.scene); toast.success("360 scene created. Capture or import a panorama.");
    } catch (error: any) { toast.error(error?.message || "Could not create scene."); }
    finally { setBusy(false); }
  };
  const setStart = async (sceneId: string) => { try { await tourApi("set_start_scene", { scene_id: sceneId }); await loadBuilder(); toast.success("Start scene updated."); } catch (e: any) { toast.error(e?.message || "Could not set start scene."); } };
  const addConnection = async () => { if (!connectionFrom || !connectionTo) return; try { await tourApi("upsert_connection", { tour_id: selectedTourId, from_scene_id: connectionFrom, to_scene_id: connectionTo, label: "Continue", yaw: 0, pitch: 0 }); await loadBuilder(); toast.success("Scene connection added."); } catch (e: any) { toast.error(e?.message || "Could not connect scenes."); } };
  const addHotspot = async () => { if (!hotspotScene || !hotspotLabel) return; try { await tourApi("create_hotspot", { tour_id: selectedTourId, scene_id: hotspotScene, hotspot_type: "info", label: hotspotLabel, yaw: Number(hotspotYaw || 0), pitch: Number(hotspotPitch || 0) }); await loadBuilder(); toast.success("Hotspot added."); } catch (e: any) { toast.error(e?.message || "Could not add hotspot."); } };
  const submitReview = async () => { try { await tourApi("submit_review", { tour_id: selectedTourId }); await loadWorkspace(); await loadBuilder(); toast.success("Tour submitted for ResKonnect review."); } catch (e: any) { toast.error(e?.message || "Tour is not ready for review."); } };
  const publish = async () => { try { const data = await tourApi<any>("publish_tour", { tour_id: selectedTourId }); await loadWorkspace(); await loadBuilder(); toast.success(standalone ? "360 view published." : "Tour published."); if (data.public_url) window.open(data.public_url, "_blank", "noopener,noreferrer"); } catch (e: any) { toast.error(e?.message || "Could not publish 360 view."); } };

  if (mode === "home" && admin) return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Tours",adminData?.summary?.tours||0],["Standalone",adminData?.summary?.standalone||0],["Published",adminData?.summary?.published||0],["Scenes",adminData?.summary?.scenes||0],["Avg quality",`${adminData?.summary?.avg_quality||0}%`]].map(([label,value])=><Card key={String(label)}><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></CardContent></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden border-[#F5B32F]/30"><CardHeader className="bg-gradient-to-r from-[#071326] to-[#0b2752] text-white"><Box className="h-8 w-8 text-[#F5B32F]"/><CardTitle>Standalone 360 Studio</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><p className="text-sm text-muted-foreground">Create a virtual view of any room, object, venue, office, showroom, outdoor space or anything else. No residence is required.</p><Button onClick={()=>void chooseStandalone()} className="w-full"><WandSparkles className="mr-2 h-4 w-4"/>Open standalone Studio</Button></CardContent></Card>
      <Card><CardHeader><Building2 className="h-8 w-8"/><CardTitle>Residence 360 Studio</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Build verified accommodation tours connected to ResKonnect listings and Premium/Gold controls.</p><Select value={residenceId} onValueChange={(id)=>void chooseResidence(id)}><SelectTrigger><SelectValue placeholder="Choose residence" /></SelectTrigger><SelectContent>{(adminData?.residences||[]).map((r:any)=><SelectItem key={r.id} value={r.id}>{r.name} · {r.campus||r.city||""}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    </div>
  </div>;

  if (busy && !workspace) return <div className="grid min-h-72 place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading 360 Studio…</div></div>;
  if (workspace && !workspace.access?.allowed && mode === "residence" && !admin) return <Card className="overflow-hidden border-[#F5B32F]/30"><CardHeader className="bg-[#071326] text-white"><Crown className="h-8 w-8 text-[#F5B32F]" /><CardTitle>Unlock residence 360 Studio</CardTitle></CardHeader><CardContent className="space-y-4 p-6"><p className="text-sm text-muted-foreground">Premium and Gold residences can build listing-linked 4K tours. You can still use the standalone 360 Studio separately without a residence.</p><Button onClick={()=>void chooseStandalone()}>Open standalone 360 Studio</Button></CardContent></Card>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#071326] text-white">{standalone?<><Box className="mr-1 h-3.5 w-3.5"/>Standalone</>:<><Crown className="mr-1 h-3.5 w-3.5 text-[#F5B32F]"/>Gold Tool</>}</Badge><Badge variant="outline">360 Studio V3 · 4K</Badge>{workspace?.access?.plan&&<Badge variant="secondary">{workspace.access.plan}</Badge>}</div><h2 className="mt-2 text-2xl font-black">{standalone ? "360 Studio · Any Space" : workspace?.residence?.name || "ResKonnect 360 Studio"}</h2><p className="text-sm text-muted-foreground">{standalone?"Capture or import 360 panoramas for rooms, objects, venues and spaces. Add scenes, navigation and hotspots, then publish a shareable immersive view.":"Guided mobile capture, private raw frames, 4K assembly, quality scoring, tour graph, hotspots, versioned publishing and public viewer."}</p></div><div className="flex flex-wrap gap-2">{admin&&!standaloneOnly&&!fixedResidenceId&&<Button variant="outline" onClick={()=>{setMode("home");setWorkspace(null);setBuilder(null);setSelectedTourId("");}}><Home className="mr-2 h-4 w-4"/>Studio home</Button>}<Button variant="outline" onClick={()=>void loadWorkspace()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div></div>

    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <aside className="space-y-4"><Card><CardHeader><CardTitle className="text-base">360 projects</CardTitle></CardHeader><CardContent className="space-y-2">{(workspace?.tours||[]).map((tour:any)=><button key={tour.id} onClick={()=>{setSelectedTourId(tour.id);void loadBuilder(tour.id);}} className={`w-full rounded-xl border p-3 text-left transition ${selectedTourId===tour.id?"border-primary bg-primary/5":"hover:bg-muted/50"}`}><div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{tour.title}</p><Badge variant={tour.status==="published"?"default":"outline"}>{tour.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{tour.virtual_tour_scenes?.length||0} scenes · v{tour.current_version||1}</p></button>)}{!(workspace?.tours||[]).length&&<p className="text-sm text-muted-foreground">No 360 projects yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">New 360 project</CardTitle></CardHeader><CardContent className="space-y-2"><Input value={tourTitle} onChange={(e)=>setTourTitle(e.target.value)} placeholder={standalone?"Room, showroom, venue…":"Residence Virtual Tour"}/><Button onClick={createTour} disabled={busy} className="w-full"><Plus className="mr-2 h-4 w-4"/>Create 360 project</Button></CardContent></Card></aside>

      <section className="space-y-5">{!selectedTourId?<Card><CardContent className="grid min-h-72 place-items-center p-8 text-center"><div><WandSparkles className="mx-auto h-10 w-10 text-muted-foreground"/><p className="mt-3 font-black">Create or select a 360 project</p><p className="mt-1 text-sm text-muted-foreground">A project can contain one standalone view or many connected scenes.</p></div></CardContent></Card>:<>
        <Card className="overflow-hidden"><CardHeader className="border-b bg-muted/20"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{selectedTour?.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{standalone?"Standalone project":"Residence project"} · token {selectedTour?.public_token}</p></div>{selectedTour?.status==="published"&&<Button size="sm" variant="outline" asChild><a href={`/tour/${selectedTour.public_token}`} target="_blank" rel="noreferrer"><View className="mr-2 h-4 w-4"/>View live</a></Button>}</div></CardHeader><CardContent className="p-5"><div className="grid gap-3 sm:grid-cols-4">{[["Ready",readiness.ready_scenes||0],["Total",readiness.scene_total||0],["Below quality",readiness.below_quality||0],["Minimum",`${readiness.min_quality||82}%`]].map(([label,value])=><div key={String(label)} className="rounded-2xl border bg-muted/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div><div className="mt-4 flex items-center gap-2"><Progress value={readiness.scene_total?Math.min(100,(readiness.ready_scenes||0)/readiness.scene_total*100):0} className="h-2 flex-1"/>{readiness.publishable?<Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5"/>Publishable</Badge>:<Badge variant="outline">Draft</Badge>}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Add a 360 scene</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-4"><Input value={sceneName} onChange={(e)=>setSceneName(e.target.value)} placeholder="Room / object / space"/><Select value={sceneArea} onValueChange={setSceneArea}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{areas.map((a)=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select><Input value={floorLabel} onChange={(e)=>setFloorLabel(e.target.value)} placeholder="Label / section (optional)"/><Button onClick={createScene} disabled={busy}><Camera className="mr-2 h-4 w-4"/>Create & capture</Button></CardContent></Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{scenes.map((scene:any)=><Card key={scene.id} className={scene.is_start?"border-[#F5B32F]/60":""}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black">{scene.name}</p><p className="text-xs text-muted-foreground">{scene.area_type}{scene.floor_label?` · ${scene.floor_label}`:""}</p></div><Badge variant={scene.status==="published"||scene.status==="ready"?"default":"outline"}>{scene.status}</Badge></div>{scene.panorama_url?<div className="relative overflow-hidden rounded-xl bg-muted"><img src={scene.thumbnail_path||scene.panorama_url} alt="" className="h-28 w-full object-cover"/><div className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black text-white">4K · {Math.round(Number(scene.quality_score||0))}%</div></div>:<div className="grid h-28 place-items-center rounded-xl border border-dashed bg-muted/20"><Camera className="h-7 w-7 text-muted-foreground"/></div>}<div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={()=>setCaptureScene(scene)}><Camera className="mr-1.5 h-3.5 w-3.5"/>{scene.panorama_url?"Recapture / import":"Capture / import"}</Button><Button size="sm" variant={scene.is_start?"default":"outline"} onClick={()=>void setStart(scene.id)}><MapPinned className="mr-1.5 h-3.5 w-3.5"/>{scene.is_start?"Start scene":"Set start"}</Button></div></CardContent></Card>)}</div>
        {scenes.length>1&&<Card><CardHeader><CardTitle className="text-base">Virtual navigation</CardTitle></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2"><div className="space-y-2 rounded-2xl border p-4"><p className="flex items-center gap-2 font-bold"><GitBranch className="h-4 w-4"/>Connect scenes</p><div className="grid grid-cols-2 gap-2"><Select value={connectionFrom} onValueChange={setConnectionFrom}><SelectTrigger><SelectValue placeholder="From"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Select value={connectionTo} onValueChange={setConnectionTo}><SelectTrigger><SelectValue placeholder="To"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><Button size="sm" onClick={addConnection} disabled={!connectionFrom||!connectionTo||connectionFrom===connectionTo}>Add connection</Button><div className="space-y-1 text-xs text-muted-foreground">{(builder?.connections||[]).map((c:any)=><p key={c.id}>• {scenes.find((s:any)=>s.id===c.from_scene_id)?.name} → {scenes.find((s:any)=>s.id===c.to_scene_id)?.name}</p>)}</div></div><div className="space-y-2 rounded-2xl border p-4"><p className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4"/>Information hotspot</p><Select value={hotspotScene} onValueChange={setHotspotScene}><SelectTrigger><SelectValue placeholder="Scene"/></SelectTrigger><SelectContent>{scenes.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Input value={hotspotLabel} onChange={(e)=>setHotspotLabel(e.target.value)} placeholder="Feature / information"/><div className="grid grid-cols-2 gap-2"><Input value={hotspotYaw} onChange={(e)=>setHotspotYaw(e.target.value)} placeholder="Yaw"/><Input value={hotspotPitch} onChange={(e)=>setHotspotPitch(e.target.value)} placeholder="Pitch"/></div><Button size="sm" onClick={addHotspot} disabled={!hotspotScene||!hotspotLabel}>Add hotspot</Button></div></CardContent></Card>}
        <Card className="border-emerald-500/20"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-emerald-600"/>{standalone?"Publish standalone view":"Review & publish"}</p><p className="mt-1 text-sm text-muted-foreground">Publishing creates an immutable version. Your editable Studio project stays separate from the public snapshot.</p></div><div className="flex gap-2">{!standalone&&!admin&&<Button variant="outline" disabled={!readiness.publishable} onClick={submitReview}><BadgeCheck className="mr-2 h-4 w-4"/>Submit review</Button>}{(standalone||admin)&&<Button disabled={!readiness.publishable} onClick={publish} className="bg-emerald-600 hover:bg-emerald-700"><ExternalLink className="mr-2 h-4 w-4"/>{standalone?"Publish view":"Publish live"}</Button>}</div></CardContent></Card>
      </>}</section>
    </div>
    {captureScene&&<Guided360Capture scene={{...captureScene,tour_id:selectedTourId}} onClose={()=>setCaptureScene(null)} onComplete={async()=>{setCaptureScene(null);await loadWorkspace();await loadBuilder();}}/>}
  </div>;
}
