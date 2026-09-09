import { useEffect, useState } from "react";

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

let state: LiveLocationState = {
  status: "idle",
  position: null,
  deviceHeading: null,
  orientationAvailable: false,
  error: null,
};

let watchId: number | null = null;
let orientationListening = false;
const subscribers = new Set<(next: LiveLocationState) => void>();

function emit(patch: Partial<LiveLocationState>) {
  state = { ...state, ...patch };
  subscribers.forEach((listener) => listener(state));
}

function normalizeHeading(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const heading = Number(value) % 360;
  return heading < 0 ? heading + 360 : heading;
}

function readLastPosition(): LivePosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) return null;
    return {
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      accuracy: Number(parsed.accuracy || 0),
      altitude: parsed.altitude == null ? null : Number(parsed.altitude),
      heading: normalizeHeading(parsed.heading),
      speed: parsed.speed == null ? null : Number(parsed.speed),
      timestamp: Number(parsed.timestamp || Date.now()),
    };
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const cached = readLastPosition();
  if (cached) state = { ...state, position: cached };
}

function persistPosition(position: LivePosition) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Storage is optional; live tracking continues without it.
  }
}

function onPosition(position: GeolocationPosition) {
  const live: LivePosition = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: normalizeHeading(position.coords.heading),
    speed: position.coords.speed,
    timestamp: position.timestamp || Date.now(),
  };
  persistPosition(live);
  emit({ status: "granted", position: live, error: null });
}

function onPositionError(error: GeolocationPositionError) {
  const denied = error.code === error.PERMISSION_DENIED;
  emit({
    status: denied ? "denied" : state.position ? "granted" : "unavailable",
    error: error.message || (denied ? "Location permission was denied" : "Live location is unavailable"),
  });
}

function orientationHandler(event: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
  const webkitHeading = normalizeHeading(event.webkitCompassHeading);
  const alphaHeading = event.alpha == null ? null : normalizeHeading(360 - event.alpha);
  const heading = webkitHeading ?? alphaHeading;
  if (heading == null) return;
  emit({ deviceHeading: heading, orientationAvailable: true });
}

function attachOrientationListener() {
  if (typeof window === "undefined" || orientationListening) return;
  orientationListening = true;
  window.addEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
  window.addEventListener("deviceorientation", orientationHandler as EventListener, true);
}

async function requestOrientationPermission() {
  if (typeof window === "undefined") return false;
  const OrientationCtor = (window as any).DeviceOrientationEvent;
  if (!OrientationCtor) return false;
  try {
    if (typeof OrientationCtor.requestPermission === "function") {
      const result = await OrientationCtor.requestPermission();
      if (result !== "granted") return false;
    }
    attachOrientationListener();
    return true;
  } catch {
    return false;
  }
}

function startWatch() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    emit({ status: "unavailable", error: "This browser does not provide geolocation" });
    return;
  }
  if (watchId != null) return;
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 12000,
  });
}

export async function requestLiveLocation() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    emit({ status: "unavailable", error: "Live location is not available on this device" });
    return false;
  }

  emit({ status: "requesting", error: null });
  try { window.localStorage.setItem(OPT_IN_KEY, "1"); } catch { /* optional */ }

  // iOS requires DeviceOrientation permission from the same explicit user gesture.
  void requestOrientationPermission();

  return await new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition((position) => {
      onPosition(position);
      startWatch();
      resolve(true);
    }, (error) => {
      onPositionError(error);
      resolve(false);
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000,
    });
  });
}

export function resumeLiveLocationIfOptedIn() {
  if (typeof window === "undefined") return;
  let optedIn = false;
  try { optedIn = window.localStorage.getItem(OPT_IN_KEY) === "1"; } catch { /* optional */ }
  if (!optedIn) return;
  attachOrientationListener();
  startWatch();
}

export function hasLiveLocationOptIn() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(OPT_IN_KEY) === "1"; } catch { return false; }
}

export function stopLiveLocation() {
  if (typeof navigator !== "undefined" && navigator.geolocation && watchId != null) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("deviceorientationabsolute", orientationHandler as EventListener, true);
    window.removeEventListener("deviceorientation", orientationHandler as EventListener, true);
    orientationListening = false;
    try { window.localStorage.removeItem(OPT_IN_KEY); } catch { /* optional */ }
  }
  emit({ status: "idle", deviceHeading: null, orientationAvailable: false, error: null });
}

export function subscribeLiveLocation(listener: (next: LiveLocationState) => void) {
  subscribers.add(listener);
  listener(state);
  return () => { subscribers.delete(listener); };
}

export function getLiveLocationState() {
  return state;
}

export function useLiveLocation() {
  // The subscription forces React renders whenever the GPS/orientation source changes.
  // The returned properties deliberately read the module source-of-truth through getters.
  // That matters for async user gestures: after requestLiveLocation() resolves, a callback
  // created by the previous render must see the newly acquired GPS fix immediately rather
  // than a stale closure and requiring a second tap.
  const [, setSnapshot] = useState<LiveLocationState>(state);
  useEffect(() => {
    resumeLiveLocationIfOptedIn();
    return subscribeLiveLocation(setSnapshot);
  }, []);

  return {
    get status() { return state.status; },
    get position() { return state.position; },
    get deviceHeading() { return state.deviceHeading; },
    get orientationAvailable() { return state.orientationAvailable; },
    get error() { return state.error; },
    get effectiveHeading() { return state.position?.heading ?? state.deviceHeading; },
  };
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
