import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/accountRouting";

export type LiveLocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";
export interface LivePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}
export interface LiveLocationState {
  status: LiveLocationStatus;
  position: LivePosition | null;
  deviceHeading: number | null;
  orientationAvailable: boolean;
  error: string | null;
}

const OPT_IN_KEY = "reskonnect_resmap_live_location_opt_in";
const LAST_POSITION_KEY = "reskonnect_resmap_last_position";
const MAX_CACHED_AGE = 30 * 60 * 1000;
const LOCATION_OPTIONS = { enableHighAccuracy: false, maximumAge: 10_000, timeout: 16_000 };
let state: LiveLocationState = { status: "idle", position: null, deviceHeading: null, orientationAvailable: false, error: null };
let watchId: number | string | null = null;
let watchPlatform: "native" | "web" | null = null;
let watchStarting = false;
let watchGeneration = 0;
let orientationListening = false;
const subscribers = new Set<(next: LiveLocationState) => void>();

function emit(patch: Partial<LiveLocationState>) {
  state = { ...state, ...patch };
  subscribers.forEach(listener => listener(state));
}
function normalizeHeading(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return (Number(value) % 360 + 360) % 360;
}
function readLastPosition(): LivePosition | null {
  try {
    const raw = localStorage.getItem(LAST_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude) || Date.now() - Number(parsed.timestamp) > MAX_CACHED_AGE) return null;
    return { latitude: Number(parsed.latitude), longitude: Number(parsed.longitude), accuracy: Number(parsed.accuracy || 0), altitude: parsed.altitude ?? null, heading: normalizeHeading(parsed.heading), speed: parsed.speed ?? null, timestamp: Number(parsed.timestamp) };
  } catch { return null; }
}
if (typeof window !== "undefined") {
  const cached = readLastPosition();
  if (cached) state = { ...state, position: cached };
}
function onPosition(position: { coords: { latitude: number; longitude: number; accuracy: number; altitude?: number | null; heading?: number | null; speed?: number | null }; timestamp?: number }) {
  const live: LivePosition = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, altitude: position.coords.altitude ?? null, heading: normalizeHeading(position.coords.heading), speed: position.coords.speed ?? null, timestamp: position.timestamp || Date.now() };
  if (!Number.isFinite(live.latitude) || !Number.isFinite(live.longitude)) return;
  try { localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(live)); } catch { /* optional */ }
  emit({ status: "granted", position: live, error: null });
}
function onPositionError(error: { code?: number; message?: string }) {
  const denied = error.code === 1 || /denied|permission/i.test(error.message || "");
  emit({ status: denied ? "denied" : "unavailable", error: denied
    ? (isNativeApp() ? "Allow location for ResKonnect in your device's App permissions, or choose your campus manually." : "Allow location in your browser settings, or choose your campus manually.")
    : "We could not obtain your current position. Check that device Location is on and retry, or choose your campus manually." });
}
function orientationHandler(event: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
  const heading = normalizeHeading(event.webkitCompassHeading) ?? (event.alpha == null ? null : normalizeHeading(360 - event.alpha));
  if (heading != null) emit({ deviceHeading: heading, orientationAvailable: true });
}
function attachOrientationListener() {
  if (orientationListening || typeof window === "undefined") return;
  orientationListening = true;
  window.addEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
  window.addEventListener("deviceorientation", orientationHandler as EventListener, true);
}
async function requestOrientationPermission() {
  const OrientationCtor = (window as any).DeviceOrientationEvent;
  if (!OrientationCtor) return;
  try {
    if (typeof OrientationCtor.requestPermission === "function" && await OrientationCtor.requestPermission() !== "granted") return;
    attachOrientationListener();
  } catch { /* heading is optional */ }
}

type NativeGeo = {
  requestPermissions: () => Promise<{ location?: string; coarseLocation?: string }>;
  getCurrentPosition: (options: typeof LOCATION_OPTIONS) => Promise<any>;
  watchPosition: (options: typeof LOCATION_OPTIONS, callback: (position: any, error?: any) => void) => Promise<string>;
  clearWatch: (options: { id: string }) => Promise<void>;
};
function nativeGeo(): NativeGeo | null {
  if (!isNativeApp()) return null;
  return (window as any).Capacitor?.Plugins?.Geolocation ?? null;
}
function browserPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: 2, message: "Location is unavailable" }); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
async function obtainPosition() {
  const native = nativeGeo();
  if (native) {
    const permissions = await native.requestPermissions();
    if (permissions.location === "denied" && permissions.coarseLocation === "denied") throw { code: 1, message: "Location permission denied" };
    return await native.getCurrentPosition(LOCATION_OPTIONS);
  }
  // Low-power network location is usually available before a first GPS satellite fix.
  // Retry with GPS only if the fast fix fails; neither attempt can hang indefinitely.
  try { return await browserPosition({ enableHighAccuracy: false, maximumAge: 10_000, timeout: 9_000 }); }
  catch (error: any) {
    if (error?.code === 1) throw error;
    return await browserPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 14_000 });
  }
}
async function startWatch() {
  if (watchId != null || watchStarting || state.status === "denied") return;
  watchStarting = true;
  const generation = ++watchGeneration;
  try {
    const native = nativeGeo();
    if (native) {
      const id = await native.watchPosition({ ...LOCATION_OPTIONS, maximumAge: 10_000 }, (position, error) => {
        if (generation !== watchGeneration) return;
        if (position) onPosition(position);
        else if (error) onPositionError(error);
      });
      if (generation !== watchGeneration) { await native.clearWatch({ id }); return; }
      watchId = id; watchPlatform = "native";
    } else if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: false, maximumAge: 10_000, timeout: 16_000 });
      if (generation !== watchGeneration) { navigator.geolocation.clearWatch(id); return; }
      watchId = id; watchPlatform = "web";
    }
  } catch (error: any) { if (generation === watchGeneration) onPositionError(error); }
  finally { watchStarting = false; }
}
export async function requestLiveLocation() {
  if (typeof window === "undefined") return false;
  if (!nativeGeo() && !navigator.geolocation) {
    emit({ status: "unavailable", error: isNativeApp() ? "Location is unavailable on this device. Choose your campus manually." : "This browser cannot provide location. Choose your campus manually." });
    return false;
  }
  if (state.status === "requesting") return false;
  emit({ status: "requesting", error: null });
  void requestOrientationPermission();
  try {
    const position = await obtainPosition();
    onPosition(position);
    try { localStorage.setItem(OPT_IN_KEY, "1"); } catch { /* optional */ }
    void startWatch();
    return true;
  } catch (error: any) {
    onPositionError(error);
    return false;
  }
}
export function resumeLiveLocationIfOptedIn() {
  try { if (localStorage.getItem(OPT_IN_KEY) !== "1") return; } catch { return; }
  attachOrientationListener();
  void startWatch();
}
export function hasLiveLocationOptIn() {
  try { return localStorage.getItem(OPT_IN_KEY) === "1"; } catch { return false; }
}
export function stopLiveLocation() {
  ++watchGeneration;
  if (watchId != null) {
    if (watchPlatform === "native") { const native = nativeGeo(); if (native) void native.clearWatch({ id: String(watchId) }).catch(() => undefined); }
    else if (navigator.geolocation) navigator.geolocation.clearWatch(Number(watchId));
  }
  watchId = null; watchPlatform = null;
  window.removeEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
  window.removeEventListener("deviceorientation", orientationHandler as EventListener, true);
  orientationListening = false;
  try { localStorage.removeItem(OPT_IN_KEY); localStorage.removeItem(LAST_POSITION_KEY); } catch { /* optional */ }
  emit({ status: "idle", position: null, deviceHeading: null, orientationAvailable: false, error: null });
}
export function subscribeLiveLocation(listener: (next: LiveLocationState) => void) {
  subscribers.add(listener); listener(state);
  return () => { subscribers.delete(listener); };
}
export function getLiveLocationState() { return state; }
export function useLiveLocation() {
  const [, setSnapshot] = useState<LiveLocationState>(state);
  useEffect(() => { resumeLiveLocationIfOptedIn(); return subscribeLiveLocation(setSnapshot); }, []);
  return { get status() { return state.status; }, get position() { return state.position; }, get deviceHeading() { return state.deviceHeading; }, get orientationAvailable() { return state.orientationAvailable; }, get error() { return state.error; }, get effectiveHeading() { return state.position?.heading ?? state.deviceHeading; } };
}
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude), dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
