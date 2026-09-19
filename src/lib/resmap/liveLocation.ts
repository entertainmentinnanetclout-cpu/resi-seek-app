import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/accountRouting";

export type LiveLocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";
export interface LivePosition { latitude: number; longitude: number; accuracy: number; altitude: number | null; heading: number | null; speed: number | null; timestamp: number; }
export interface LiveLocationState { status: LiveLocationStatus; position: LivePosition | null; deviceHeading: number | null; orientationAvailable: boolean; error: string | null; }
const OPT_IN_KEY = "reskonnect_resmap_live_location_opt_in";
const LAST_POSITION_KEY = "reskonnect_resmap_last_position";
let state: LiveLocationState = { status: "idle", position: null, deviceHeading: null, orientationAvailable: false, error: null };
let watchId: number | null = null;
let nativePolling: ReturnType<typeof setInterval> | null = null;
let orientationListening = false;
let pending: Promise<boolean> | null = null;
const subscribers = new Set<(next: LiveLocationState) => void>();
function emit(patch: Partial<LiveLocationState>) { state = { ...state, ...patch }; subscribers.forEach(listener => listener(state)); }
function normalizeHeading(value: number | null | undefined) { if (value == null || !Number.isFinite(Number(value))) return null; const heading = Number(value) % 360; return heading < 0 ? heading + 360 : heading; }
function readLastPosition(): LivePosition | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_POSITION_KEY) || "null");
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) return null;
    return { latitude: Number(parsed.latitude), longitude: Number(parsed.longitude), accuracy: Number(parsed.accuracy || 0), altitude: parsed.altitude == null ? null : Number(parsed.altitude), heading: normalizeHeading(parsed.heading), speed: parsed.speed == null ? null : Number(parsed.speed), timestamp: Number(parsed.timestamp || Date.now()) };
  } catch { return null; }
}
if (typeof window !== "undefined") { const cached = readLastPosition(); if (cached) state = { ...state, position: cached }; }
function storePosition(position: LivePosition) { try { localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(position)); } catch { /* optional */ } }
function onNativePosition(position: any) {
  if (!Number.isFinite(Number(position?.latitude)) || !Number.isFinite(Number(position?.longitude))) throw new Error("Location coordinates were invalid");
  const next: LivePosition = { latitude: Number(position.latitude), longitude: Number(position.longitude), accuracy: Number(position.accuracy || 0), altitude: position.altitude == null ? null : Number(position.altitude), heading: normalizeHeading(position.heading), speed: position.speed == null ? null : Number(position.speed), timestamp: Number(position.timestamp || Date.now()) };
  storePosition(next); emit({ status: "granted", position: next, error: null });
}
function onPosition(position: GeolocationPosition) { onNativePosition({ ...position.coords, timestamp: position.timestamp }); }
function onPositionError(error: GeolocationPositionError) {
  const denied = error.code === error.PERMISSION_DENIED;
  emit({ status: denied ? "denied" : state.position ? "granted" : "unavailable", error: error.message || (denied ? "Location permission was denied" : "Location is unavailable. Select your campus manually.") });
}
function orientationHandler(event: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
  const heading = normalizeHeading(event.webkitCompassHeading) ?? (event.alpha == null ? null : normalizeHeading(360 - event.alpha));
  if (heading != null) emit({ deviceHeading: heading, orientationAvailable: true });
}
function attachOrientationListener() {
  if (typeof window === "undefined" || orientationListening) return;
  orientationListening = true;
  window.addEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
  window.addEventListener("deviceorientation", orientationHandler as EventListener, true);
}
async function requestOrientationPermission() {
  if (typeof window === "undefined") return;
  const ctor = (window as any).DeviceOrientationEvent;
  if (!ctor) return;
  try { if (typeof ctor.requestPermission === "function" && await ctor.requestPermission() !== "granted") return; attachOrientationListener(); } catch { /* orientation is optional */ }
}
function nativeProvider() { return (window as any).Capacitor?.Plugins?.ResKonnectLocation as { getPosition: () => Promise<any> } | undefined; }
async function nativeFix() {
  const provider = nativeProvider();
  if (!provider?.getPosition) throw new Error("Native location module is unavailable. Update ResKonnect or select your campus manually.");
  // Bound the promise even if a vendor location provider never calls back.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([provider.getPosition(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Location timed out. Select your campus manually or try again outside.")), 14000); })]);
    onNativePosition(position);
  } finally { if (timer) clearTimeout(timer); }
}
function startWatch() {
  if (typeof window === "undefined") return;
  if (isNativeApp()) {
    if (nativePolling) return;
    nativePolling = setInterval(() => { if (document.visibilityState === "visible") void nativeFix().catch(() => { /* retain last valid fix */ }); }, 60000);
    return;
  }
  if (!navigator.geolocation) { emit({ status: "unavailable", error: "This browser does not provide geolocation" }); return; }
  if (watchId != null) return;
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: false, maximumAge: 30000, timeout: 14000 });
}
export async function requestLiveLocation() {
  if (typeof window === "undefined") return false;
  if (pending) return pending;
  emit({ status: "requesting", error: null });
  try { localStorage.setItem(OPT_IN_KEY, "1"); } catch { /* optional */ }
  void requestOrientationPermission();
  pending = (async () => {
    if (isNativeApp()) {
      try { await nativeFix(); startWatch(); return true; }
      catch (error: any) {
        const message = String(error?.message || "Location is unavailable. Select your campus manually.");
        const denied = String(error?.code || "") === "PERMISSION_DENIED" || /permission.*denied/i.test(message);
        emit({ status: denied ? "denied" : "unavailable", error: message });
        return false;
      }
    }
    if (!navigator.geolocation) { emit({ status: "unavailable", error: "This browser does not provide geolocation" }); return false; }
    return await new Promise<boolean>(resolve => {
      let finished = false;
      const timer = setTimeout(() => { if (finished) return; finished = true; emit({ status: "unavailable", error: "Location timed out. Select your campus manually." }); resolve(false); }, 15000);
      navigator.geolocation.getCurrentPosition(position => { if (finished) return; finished = true; clearTimeout(timer); onPosition(position); startWatch(); resolve(true); }, error => { if (finished) return; finished = true; clearTimeout(timer); onPositionError(error); resolve(false); }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 });
    });
  })();
  try { return await pending; } finally { pending = null; }
}
export function resumeLiveLocationIfOptedIn() {
  if (typeof window === "undefined") return;
  try { if (localStorage.getItem(OPT_IN_KEY) !== "1") return; } catch { return; }
  attachOrientationListener();
  if (isNativeApp()) {
    // Never request Android permissions in the background: only after an explicit user action.
    if (state.status === "granted") startWatch();
  } else startWatch();
}
export function hasLiveLocationOptIn() { if (typeof window === "undefined") return false; try { return localStorage.getItem(OPT_IN_KEY) === "1"; } catch { return false; } }
export function stopLiveLocation() {
  if (typeof navigator !== "undefined" && navigator.geolocation && watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (nativePolling) clearInterval(nativePolling);
  nativePolling = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
    window.removeEventListener("deviceorientation", orientationHandler as EventListener, true);
    orientationListening = false;
    try { localStorage.removeItem(OPT_IN_KEY); } catch { /* optional */ }
  }
  emit({ status: "idle", deviceHeading: null, orientationAvailable: false, error: null });
}
export function subscribeLiveLocation(listener: (next: LiveLocationState) => void) { subscribers.add(listener); listener(state); return () => { subscribers.delete(listener); }; }
export function getLiveLocationState() { return state; }
export function useLiveLocation() {
  const [, setSnapshot] = useState<LiveLocationState>(state);
  useEffect(() => { resumeLiveLocationIfOptedIn(); return subscribeLiveLocation(setSnapshot); }, []);
  return { get status() { return state.status; }, get position() { return state.position; }, get deviceHeading() { return state.deviceHeading; }, get orientationAvailable() { return state.orientationAvailable; }, get error() { return state.error; }, get effectiveHeading() { return state.position?.heading ?? state.deviceHeading; } };
}
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const h = Math.sin(toRad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(toRad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
