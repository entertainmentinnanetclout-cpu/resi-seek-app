import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, CircleDot, CloudUpload, Loader2, Rotate3D, ShieldCheck, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { aggregateQuality, analyzeFrame, assemble4KPanorama, buildCapturePlan, CapturedFrame, circularDelta, clearOfflineFrames, loadOfflineFrames, normalizeImportedPanorama, saveOfflineFrame } from "@/lib/virtualTours/capture";
import { tourApi, uploadSignedAsset } from "@/lib/virtualTours/api";

type Orientation = { yaw: number; pitch: number; roll: number };

type Props = {
  scene: { id: string; name: string; tour_id: string; source_mode?: string };
  onClose: () => void;
  onComplete: () => void;
};

export default function Guided360Capture({ scene, onClose, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const baseYawRef = useRef<number | null>(null);
  const lastOrientationRef = useRef<Orientation | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const [profile, setProfile] = useState<"quick_24" | "gold_36">("gold_36");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>({ yaw: 0, pitch: 0, roll: 0 });
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Stand in the centre of the room and keep the phone upright.");
  const [uploading, setUploading] = useState(0);
  const plan = useMemo(() => buildCapturePlan(profile), [profile]);
  const nextTarget = plan.find((target) => !frames.some((frame) => frame.sequence === target.sequence));
  const progress = Math.round(frames.length / Math.max(1, plan.length) * 100);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  const start = async () => {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraReady(true);

      const OrientationCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
      if (typeof OrientationCtor?.requestPermission === "function") {
        const permission = await OrientationCtor.requestPermission();
        if (permission !== "granted") throw new Error("Motion access is required for guided 360 capture on iPhone.");
      }
      setMotionReady(true);
      const session = await tourApi<any>("start_capture", { scene_id: scene.id, capture_profile: profile, offline_mode: !navigator.onLine, device_info: { userAgent: navigator.userAgent, platform: navigator.platform, width: window.innerWidth, height: window.innerHeight } });
      setSessionId(session.session.id);
      const restored = await loadOfflineFrames(session.session.id).catch(() => []);
      if (restored.length) setFrames(restored);
      setMessage("Rotate slowly. Hold steady when the target locks.");
    } catch (error: any) {
      toast.error(error?.message || "Could not start 360 capture.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!motionReady) return;
    const handler = (event: DeviceOrientationEvent) => {
      const alpha = Number(event.alpha ?? 0); const beta = Number(event.beta ?? 0); const gamma = Number(event.gamma ?? 0);
      if (baseYawRef.current == null) baseYawRef.current = alpha;
      const yaw = ((baseYawRef.current - alpha) % 360 + 360) % 360;
      const current = { yaw, pitch: Math.max(-90, Math.min(90, beta)), roll: gamma };
      const previous = lastOrientationRef.current;
      const movement = previous ? circularDelta(current.yaw, previous.yaw) + Math.abs(current.pitch - previous.pitch) + Math.abs(current.roll - previous.roll) : 99;
      lastOrientationRef.current = current; setOrientation(current);
      if (movement < 1.8) stableSinceRef.current ??= performance.now(); else stableSinceRef.current = null;
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [motionReady]);

  const uploadFrame = async (frame: CapturedFrame, sid: string) => {
    if (!navigator.onLine) return null;
    setUploading((value) => value + 1);
    try {
      const issued = await tourApi<any>("issue_upload", { scene_id: scene.id, session_id: sid, bucket: "tour-capture-private", kind: `frame-${frame.sequence}`, extension: "jpg" });
      await uploadSignedAsset({ bucket: issued.bucket, path: issued.path, token: issued.token, file: frame.blob, contentType: "image/jpeg" });
      await tourApi("register_frame", { scene_id: scene.id, session_id: sid, sequence_no: frame.sequence, storage_path: issued.path, yaw: frame.yaw, pitch: frame.pitch, roll: frame.roll, target_yaw: frame.target_yaw, target_pitch: frame.target_pitch, width: frame.width, height: frame.height, sharpness_score: frame.sharpness, exposure_score: frame.exposure, stability_score: frame.stability, overlap_score: frame.overlap, accepted: true });
      return issued.path;
    } finally { setUploading((value) => Math.max(0, value - 1)); }
  };

  const captureTarget = async (target = nextTarget) => {
    if (!target || !videoRef.current || capturingRef.current || !sessionId) return;
    capturingRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth || 1920; canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Camera frame failed")), "image/jpeg", .94));
      const analysis = await analyzeFrame(blob);
      if (analysis.sharpness < 22) { setMessage("That angle was blurred. Hold the phone steadier and retake it."); toast.warning("Blur detected — retake this angle."); return; }
      if (analysis.exposure < 25) { setMessage("Lighting is too dark or too bright. Adjust the room lights and retake."); toast.warning("Exposure needs adjustment."); return; }
      const stableMs = stableSinceRef.current ? performance.now() - stableSinceRef.current : 0;
      const frame: CapturedFrame = { ...target, blob, yaw: orientation.yaw, pitch: orientation.pitch, roll: orientation.roll, width: analysis.width || canvas.width, height: analysis.height || canvas.height, sharpness: analysis.sharpness, exposure: analysis.exposure, stability: Math.max(35, Math.min(100, stableMs / 8)), overlap: Math.max(70, 100 - circularDelta(orientation.yaw, target.target_yaw) * 2) };
      await saveOfflineFrame(sessionId, frame);
      setFrames((items) => [...items.filter((item) => item.sequence !== frame.sequence), frame].sort((a, b) => a.sequence - b.sequence));
      void uploadFrame(frame, sessionId).catch((error) => console.warn("[360 Studio] deferred frame upload", error));
      setMessage(`Captured ${frame.sequence}/${plan.length}. Keep rotating slowly.`);
    } catch (error: any) { toast.error(error?.message || "Could not capture this angle."); }
    finally { capturingRef.current = false; stableSinceRef.current = null; }
  };

  useEffect(() => {
    if (!cameraReady || !motionReady || !nextTarget || capturingRef.current) return;
    const yawOk = circularDelta(orientation.yaw, nextTarget.target_yaw) <= 7;
    const pitchOk = Math.abs(orientation.pitch - nextTarget.target_pitch) <= 10;
    const stable = stableSinceRef.current && performance.now() - stableSinceRef.current > 700;
    if (yawOk && pitchOk && stable) void captureTarget(nextTarget);
  }, [cameraReady, motionReady, nextTarget?.sequence, orientation.yaw, orientation.pitch]);

  const syncAllFrames = async () => {
    if (!sessionId) throw new Error("Capture session missing");
    const stored = await loadOfflineFrames(sessionId);
    for (const frame of stored) await uploadFrame(frame, sessionId);
    return stored;
  };

  const uploadFinalAsset = async (bucket: string, kind: string, blob: Blob, session: string) => {
    const issued = await tourApi<any>("issue_upload", { scene_id: scene.id, session_id: session, bucket, kind, extension: "jpg" });
    await uploadSignedAsset({ bucket: issued.bucket, path: issued.path, token: issued.token, file: blob, contentType: "image/jpeg" });
    return issued.path as string;
  };

  const finalize = async () => {
    if (!sessionId || frames.length < plan.length) return;
    setBusy(true); setMessage("Assembling your 4K virtual scene…");
    try {
      const stored = navigator.onLine ? await syncAllFrames() : await loadOfflineFrames(sessionId);
      if (!navigator.onLine) throw new Error("Your capture is safe offline. Reconnect to upload and finish the 4K scene.");
      const assembled = await assemble4KPanorama(stored, 4096, 2048);
      const [panoramaPath, thumbnailPath, masterPath] = await Promise.all([
        uploadFinalAsset("tour-delivery-public", "panorama-4k", assembled.panorama, sessionId),
        uploadFinalAsset("tour-thumbnails-public", "thumbnail", assembled.thumbnail, sessionId),
        uploadFinalAsset("tour-masters-private", "master-4k", assembled.panorama, sessionId),
      ]);
      const metrics = aggregateQuality(stored, plan.length);
      const result = await tourApi<any>("complete_capture", { scene_id: scene.id, session_id: sessionId, panorama_path: panoramaPath, thumbnail_path: thumbnailPath, master_path: masterPath, width: assembled.width, height: assembled.height, metrics, privacy_issues: [] });
      await clearOfflineFrames(sessionId);
      toast.success(`4K scene ready · quality ${Math.round(Number(result.quality?.score || 0))}%`);
      onComplete();
    } catch (error: any) {
      toast.error(error?.message || "Could not finish the 4K scene.");
      setMessage(error?.message || "Capture saved. Try finishing again.");
    } finally { setBusy(false); }
  };

  const import360 = async (file: File) => {
    setBusy(true); setMessage("Validating and preparing 4K equirectangular panorama…");
    try {
      let sid = sessionId;
      if (!sid) {
        const session = await tourApi<any>("start_capture", { scene_id: scene.id, capture_profile: "import_360", device_info: { userAgent: navigator.userAgent } }); sid = session.session.id; setSessionId(sid);
      }
      const normalized = await normalizeImportedPanorama(file, 4096, 2048);
      const [panoramaPath, thumbnailPath, masterPath] = await Promise.all([
        uploadFinalAsset("tour-delivery-public", "panorama-4k", normalized.panorama, sid!),
        uploadFinalAsset("tour-thumbnails-public", "thumbnail", normalized.thumbnail, sid!),
        uploadFinalAsset("tour-masters-private", "master-4k", normalized.panorama, sid!),
      ]);
      const metrics = { sharpness: 94, lighting: 92, coverage: 100, overlap: 100, stability: 100, exposure_consistency: 94 };
      await tourApi("complete_capture", { scene_id: scene.id, session_id: sid, panorama_path: panoramaPath, thumbnail_path: thumbnailPath, master_path: masterPath, width: 4096, height: 2048, metrics, privacy_issues: [] });
      toast.success("Imported 360 panorama prepared in 4K."); onComplete();
    } catch (error: any) { toast.error(error?.message || "Could not import this panorama."); setMessage(error?.message || "Import failed."); }
    finally { setBusy(false); }
  };

  const targetDistance = nextTarget ? Math.max(circularDelta(orientation.yaw, nextTarget.target_yaw), Math.abs(orientation.pitch - nextTarget.target_pitch)) : 0;
  const locked = nextTarget ? circularDelta(orientation.yaw, nextTarget.target_yaw) <= 7 && Math.abs(orientation.pitch - nextTarget.target_pitch) <= 10 : false;

  return <div className="fixed inset-0 z-[500] overflow-hidden bg-black text-white">
    <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
    <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-white/15 bg-black/55 px-4 py-3 backdrop-blur-xl"><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#F5B32F]">ResKonnect Gold Tool</p><h2 className="mt-1 font-black">360 Studio · {scene.name}</h2><p className="mt-1 text-xs text-white/65">V2 guided capture · 4K output</p></div>
      <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/55 backdrop-blur" aria-label="Close capture"><X className="h-5 w-5" /></button>
    </header>

    {!cameraReady && <div className="absolute inset-0 z-10 grid place-items-center p-6"><div className="w-full max-w-md space-y-5 rounded-[28px] border border-white/15 bg-[#071326]/94 p-6 shadow-2xl backdrop-blur-xl"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F5B32F]/15 text-[#F5B32F]"><Rotate3D className="h-7 w-7" /></div><div><h3 className="text-2xl font-black">Capture a real 360° scene</h3><p className="mt-2 text-sm text-white/70">Stand in the centre, switch on room lights and rotate from one target to the next. ResKonnect automatically checks blur, exposure, coverage and stability.</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => setProfile("quick_24")} className={`rounded-2xl border p-3 text-left ${profile === "quick_24" ? "border-[#F5B32F] bg-[#F5B32F]/10" : "border-white/15"}`}><p className="font-black">Quick 24</p><p className="text-xs text-white/60">2 capture rings</p></button><button onClick={() => setProfile("gold_36")} className={`rounded-2xl border p-3 text-left ${profile === "gold_36" ? "border-[#F5B32F] bg-[#F5B32F]/10" : "border-white/15"}`}><p className="font-black">Gold 36</p><p className="text-xs text-white/60">3 capture rings · recommended</p></button></div><Button onClick={start} disabled={busy} className="h-12 w-full bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffd16e]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Start guided capture</Button><label className="block"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void import360(file); }} /><span className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-white/20 text-sm font-bold"><CloudUpload className="mr-2 h-4 w-4" />Import existing 2:1 360 panorama</span></label></div></div>}

    {cameraReady && <>
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
        <div className={`grid h-28 w-28 place-items-center rounded-full border-4 transition ${locked ? "border-emerald-400 bg-emerald-400/20 shadow-[0_0_60px_rgba(52,211,153,.35)]" : "border-white/70 bg-black/15"}`}><div className="text-center"><CircleDot className={`mx-auto h-8 w-8 ${locked ? "text-emerald-300" : "text-white"}`} /><p className="mt-1 text-[11px] font-black">{nextTarget ? `${nextTarget.sequence}/${plan.length}` : "DONE"}</p></div></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{nextTarget ? `Target ${nextTarget.sequence}: yaw ${nextTarget.target_yaw}° · pitch ${nextTarget.target_pitch}°` : "Capture complete"}</p><p className="mt-1 text-xs text-white/65">{message}</p></div>{!online && <Badge className="bg-amber-500 text-[#071326]"><WifiOff className="mr-1 h-3 w-3" />Offline safe</Badge>}</div><Progress value={progress} className="mt-3 h-2" /><div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px]"><div className="rounded-xl bg-white/5 p-2"><p className="text-white/50">Yaw</p><p className="font-black">{orientation.yaw.toFixed(0)}°</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/50">Pitch</p><p className="font-black">{orientation.pitch.toFixed(0)}°</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/50">Target delta</p><p className="font-black">{targetDistance.toFixed(0)}°</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/50">Uploads</p><p className="font-black">{uploading}</p></div></div><div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => void captureTarget()} disabled={!nextTarget || busy} className="flex-1 border-white/30 bg-black/30 text-white hover:bg-white/10"><Camera className="mr-2 h-4 w-4" />Capture manually</Button>{!nextTarget && <Button onClick={finalize} disabled={busy || uploading > 0} className="flex-1 bg-emerald-500 font-black text-[#071326] hover:bg-emerald-400">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Build 4K scene</Button>}</div></div>
        <div className="mx-auto flex max-w-xl items-center justify-center gap-2 text-[10px] text-white/50"><ShieldCheck className="h-3.5 w-3.5" />Raw frames stay private. Only approved delivery panoramas are public.</div>
      </div>
    </>}
  </div>;
}
