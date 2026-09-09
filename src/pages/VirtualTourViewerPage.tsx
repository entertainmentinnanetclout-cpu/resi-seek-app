import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Compass, Expand, ExternalLink, MapPin, Pause, Play, Rotate3D, Share2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VirtualTourPanorama from "@/components/virtualTours/VirtualTourPanorama";
import { publicTourSnapshot, recordTourEvent } from "@/lib/virtualTours/api";
import { toast } from "sonner";

function anonymousId() {
  try {
    const existing = localStorage.getItem("rk360-anon");
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem("rk360-anon", next);
    return next;
  } catch { return undefined; }
}

export default function VirtualTourViewerPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [sceneId, setSceneId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [guided, setGuided] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const viewerSession = useRef(crypto.randomUUID());
  const anon = useRef<string | undefined>(undefined);

  useEffect(() => { anon.current = anonymousId(); }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const snapshot = await publicTourSnapshot(token);
        if (!active) return;
        setData(snapshot);
        const scenes = snapshot?.scenes || [];
        const start = scenes.find((scene: any) => scene.is_start) || scenes[0];
        if (start) setSceneId(start.id);
        if (snapshot?.tour?.id) void recordTourEvent({ tourId: snapshot.tour.id, eventType: "tour_open", viewerSession: viewerSession.current, anonymousId: anon.current });
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!data?.tour?.id || !sceneId) return;
    const started = Date.now();
    void recordTourEvent({ tourId: data.tour.id, sceneId, eventType: "scene_view", viewerSession: viewerSession.current, anonymousId: anon.current });
    return () => {
      const dwellMs = Math.max(0, Date.now() - started);
      if (dwellMs >= 750) void recordTourEvent({ tourId: data.tour.id, sceneId, eventType: "scene_dwell", viewerSession: viewerSession.current, anonymousId: anon.current, metadata: { dwell_ms: dwellMs } });
    };
  }, [data?.tour?.id, sceneId]);

  const scenes = useMemo(() => data?.scenes || [], [data]);
  const scene = scenes.find((item: any) => item.id === sceneId) || scenes[0];
  const currentIndex = Math.max(0, scenes.findIndex((item: any) => item.id === scene?.id));
  const connections = useMemo(() => (data?.connections || []).filter((item: any) => item.from_scene_id === scene?.id), [data, scene?.id]);
  const hotspots = useMemo(() => (data?.hotspots || []).filter((item: any) => item.scene_id === scene?.id), [data, scene?.id]);

  useEffect(() => {
    if (!guided || scenes.length < 2) return;
    const timer = window.setInterval(() => setSceneId((current) => {
      const index = scenes.findIndex((item: any) => item.id === current);
      if (index >= scenes.length - 1) { setGuided(false); if (data?.tour?.id) void recordTourEvent({ tourId: data.tour.id, eventType: "guided_complete", viewerSession: viewerSession.current, anonymousId: anon.current }); return scenes[index]?.id || current; }
      return scenes[index + 1].id;
    }), 5500);
    return () => window.clearInterval(timer);
  }, [guided, scenes, data?.tour?.id]);

  const enableMotion = async () => {
    if (motionEnabled) { setMotionEnabled(false); return; }
    try {
      const Orientation = DeviceOrientationEvent as any;
      if (typeof Orientation?.requestPermission === "function") {
        const permission = await Orientation.requestPermission();
        if (permission !== "granted") return toast.error("Motion access was not granted.");
      }
      setMotionEnabled(true);
      if (data?.tour?.id) void recordTourEvent({ tourId: data.tour.id, sceneId: scene?.id, eventType: "motion_enabled", viewerSession: viewerSession.current, anonymousId: anon.current });
    } catch { toast.error("Motion view is not available on this device."); }
  };

  const shareTour = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${data?.residence?.name || "Residence"} 360 Tour`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Tour link copied."); }
      if (data?.tour?.id) void recordTourEvent({ tourId: data.tour.id, sceneId: scene?.id, eventType: "share", viewerSession: viewerSession.current, anonymousId: anon.current });
    } catch { /* share sheet cancelled */ }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#050b14] text-white"><div className="text-center"><Rotate3D className="mx-auto h-9 w-9 animate-pulse text-[#F5B32F]"/><p className="mt-3 text-sm text-white/65">Loading verified 4K virtual tour…</p></div></div>;
  if (!data?.tour || !scene) return <div className="grid min-h-screen place-items-center p-6"><div className="text-center"><Rotate3D className="mx-auto h-12 w-12 text-muted-foreground"/><h1 className="mt-4 text-2xl font-black">Virtual tour unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This tour may be unpublished or replaced by a newer verified version.</p><Button className="mt-5" onClick={() => navigate("/find")}>Find accommodation</Button></div></div>;

  const residenceKey = data.residence?.slug || data.residence?.id;
  const listingPath = residenceKey ? `/find-my-res/${residenceKey}` : "/find";
  const title = `${data.residence?.name || data.tour.title} 360° Virtual Tour | ResKonnect`;
  return <main className="min-h-[100dvh] bg-[#050b14] text-white">
    <SEO title={title} description={`Explore ${data.residence?.name || "this residence"} through a verified ResKonnect 4K virtual residence tour.`} />
    <div className="relative h-[100dvh] overflow-hidden">
      <VirtualTourPanorama
        panoramaUrl={scene.panorama_url}
        hotspots={hotspots}
        connections={connections}
        onNavigate={(next) => { void recordTourEvent({ tourId: data.tour.id, sceneId: scene.id, eventType: "scene_navigation", viewerSession: viewerSession.current, anonymousId: anon.current, metadata: { to_scene_id: next } }); setSceneId(next); }}
        motionEnabled={motionEnabled}
        onHotspotAction={(item) => void recordTourEvent({ tourId: data.tour.id, sceneId: scene.id, eventType: item.cta_url ? "hotspot_cta" : "hotspot_click", viewerSession: viewerSession.current, anonymousId: anon.current, metadata: { hotspot_id: item.id, label: item.label, kind: item.kind, target_scene_id: item.target_scene_id || null } })}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:p-5">
        <button onClick={() => navigate(-1)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/55 backdrop-blur" aria-label="Back"><ArrowLeft className="h-5 w-5"/></button>
        <div className="pointer-events-auto max-w-[70vw] rounded-2xl border border-white/15 bg-black/55 px-4 py-3 text-center backdrop-blur-xl"><div className="flex items-center justify-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-400"/><p className="truncate text-sm font-black">{data.residence?.name || data.tour.title}</p></div><p className="mt-1 truncate text-[10px] uppercase tracking-[.18em] text-[#F5B32F]">ResKonnect Gold 360 · verified 4K</p></div>
        <button onClick={() => { document.documentElement.requestFullscreen?.(); void recordTourEvent({ tourId: data.tour.id, sceneId: scene.id, eventType: "fullscreen", viewerSession: viewerSession.current, anonymousId: anon.current }); }} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/55 backdrop-blur" aria-label="Fullscreen"><Expand className="h-5 w-5"/></button>
      </header>

      <div className="pointer-events-auto absolute right-3 top-[max(4.4rem,calc(env(safe-area-inset-top)+4.1rem))] z-20 flex flex-col gap-2 sm:right-5">
        <button onClick={() => void enableMotion()} className={`grid h-10 w-10 place-items-center rounded-full border backdrop-blur ${motionEnabled ? "border-[#F5B32F] bg-[#F5B32F] text-[#071326]" : "border-white/20 bg-black/55 text-white"}`} aria-label="Toggle motion view"><Compass className="h-4 w-4"/></button>
        <button onClick={() => void shareTour()} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur" aria-label="Share virtual tour"><Share2 className="h-4 w-4"/></button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/78 to-transparent p-3 pb-[max(.8rem,env(safe-area-inset-bottom))] pt-16 sm:p-5">
        <div className="mx-auto max-w-5xl rounded-[24px] border border-white/15 bg-black/55 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-white text-[#071326]">{scene.area_type}</Badge>{scene.floor_label&&<Badge variant="outline" className="border-white/25 text-white">{scene.floor_label}</Badge>}{Number(scene.quality_score||0)>0&&<Badge className="bg-emerald-600">{Math.round(Number(scene.quality_score))}% quality</Badge>}</div><h1 className="mt-2 text-xl font-black">{scene.name}</h1><p className="mt-1 flex items-center gap-1.5 text-xs text-white/60"><MapPin className="h-3.5 w-3.5"/>{data.residence?.address || data.residence?.campus || "ResKonnect residence"}</p></div><div className="flex gap-2"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" disabled={currentIndex<=0} onClick={()=>setSceneId(scenes[currentIndex-1]?.id)}><ChevronLeft className="h-4 w-4"/></Button><Button className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffd16e]" onClick={()=>{setGuided((value)=>!value);if(!guided)void recordTourEvent({tourId:data.tour.id,eventType:"guided_start",viewerSession:viewerSession.current,anonymousId:anon.current});}}>{guided?<Pause className="mr-2 h-4 w-4"/>:<Play className="mr-2 h-4 w-4"/>}{guided?"Pause":"Guided tour"}</Button><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" disabled={currentIndex>=scenes.length-1} onClick={()=>setSceneId(scenes[currentIndex+1]?.id)}><ChevronRight className="h-4 w-4"/></Button></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={()=>{void recordTourEvent({tourId:data.tour.id,sceneId:scene.id,eventType:"listing_click",viewerSession:viewerSession.current,anonymousId:anon.current});navigate(listingPath);}}><ExternalLink className="mr-2 h-4 w-4"/>View listing</Button>
            <Button className="bg-emerald-600 font-black text-white hover:bg-emerald-700" onClick={()=>{void recordTourEvent({tourId:data.tour.id,sceneId:scene.id,eventType:"apply_click",viewerSession:viewerSession.current,anonymousId:anon.current});navigate(`${listingPath}?intent=secure`);}}>Apply / secure</Button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{scenes.map((item:any)=><button key={item.id} onClick={()=>setSceneId(item.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${item.id===scene.id?"border-[#F5B32F] bg-[#F5B32F]/15":"border-white/15 bg-white/5 hover:bg-white/10"}`}><p className="font-black">{item.name}</p><p className="text-[10px] text-white/50">{item.floor_label||item.area_type}</p></button>)}</div>
        </div>
      </div>
    </div>
  </main>;
}
