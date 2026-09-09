export type CaptureTarget = { sequence: number; ring: number; target_yaw: number; target_pitch: number };
export type CapturedFrame = CaptureTarget & {
  blob: Blob;
  yaw: number;
  pitch: number;
  roll: number;
  width: number;
  height: number;
  sharpness: number;
  exposure: number;
  stability: number;
  overlap: number;
};

export const buildCapturePlan = (profile: "quick_24" | "gold_36" = "gold_36"): CaptureTarget[] => {
  const pitches = profile === "quick_24" ? [-35, 35] : [-50, 0, 50];
  const out: CaptureTarget[] = [];
  pitches.forEach((pitch, ring) => {
    for (let i = 0; i < 12; i++) out.push({ sequence: out.length + 1, ring, target_yaw: i * 30, target_pitch: pitch });
  });
  return out;
};

export const circularDelta = (a: number, b: number) => {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return Math.min(180, d);
};

export async function analyzeFrame(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 72;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let luminance = 0; let contrast = 0; let count = 0;
  const gray = new Float32Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const g = pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114;
    gray[p] = g; luminance += g; count++;
  }
  const mean = luminance / Math.max(1, count);
  for (let y = 1; y < canvas.height; y++) for (let x = 1; x < canvas.width; x++) {
    const i = y * canvas.width + x;
    contrast += Math.abs(gray[i] - gray[i - 1]) + Math.abs(gray[i] - gray[i - canvas.width]);
  }
  bmp.close();
  const sharpness = Math.max(0, Math.min(100, (contrast / Math.max(1, count) / 26) * 100));
  const exposure = Math.max(0, Math.min(100, 100 - Math.abs(mean - 128) / 1.28));
  return { width: bmp.width || 0, height: bmp.height || 0, sharpness: Math.round(sharpness), exposure: Math.round(exposure) };
}

const DB_NAME = "reskonnect-360-capture-v2";
const STORE = "frames";
function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveOfflineFrame(sessionId: string, frame: CapturedFrame) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put({ key: `${sessionId}:${frame.sequence}`, sessionId, ...frame }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}
export async function loadOfflineFrames(sessionId: string): Promise<CapturedFrame[]> {
  const db = await openDb();
  const rows = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction(STORE, "readonly"); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); });
  db.close();
  return rows.filter((row) => row.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence);
}
export async function clearOfflineFrames(sessionId: string) {
  const db = await openDb();
  const rows = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction(STORE, "readonly"); const req = tx.objectStore(STORE).getAllKeys(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); });
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); for (const key of rows) if (String(key).startsWith(`${sessionId}:`)) tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

async function imageBitmap(blob: Blob) { return createImageBitmap(blob); }
async function canvasBlob(canvas: HTMLCanvasElement, quality = .92) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode panorama")), "image/jpeg", quality));
}

export async function assemble4KPanorama(frames: CapturedFrame[], width = 4096, height = 2048) {
  if (frames.length < 12) throw new Error("Not enough accepted frames for a panorama");
  const rings = [...new Set(frames.map((frame) => frame.ring))].sort((a, b) => a - b);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#111827"; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const bandHeight = height / rings.length;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ringFrames = frames.filter((frame) => frame.ring === rings[ringIndex]).sort((a, b) => a.target_yaw - b.target_yaw);
    const cellWidth = width / Math.max(1, ringFrames.length);
    for (let i = 0; i < ringFrames.length; i++) {
      const frame = ringFrames[i]; const bmp = await imageBitmap(frame.blob);
      const cropW = Math.max(1, bmp.width * .42); const cropH = Math.max(1, bmp.height * .62);
      const sx = (bmp.width - cropW) / 2; const sy = (bmp.height - cropH) / 2;
      ctx.drawImage(bmp, sx, sy, cropW, cropH, Math.round(i * cellWidth), Math.round(ringIndex * bandHeight), Math.ceil(cellWidth + 1), Math.ceil(bandHeight + 1));
      bmp.close();
    }
  }
  const panorama = await canvasBlob(canvas, .94);
  const thumb = document.createElement("canvas"); thumb.width = 1024; thumb.height = 512; const tctx = thumb.getContext("2d")!; tctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const thumbnail = await canvasBlob(thumb, .86);
  return { panorama, thumbnail, width, height };
}

export async function normalizeImportedPanorama(file: File, width = 4096, height = 2048) {
  const bmp = await imageBitmap(file);
  const ratio = bmp.width / Math.max(1, bmp.height);
  if (Math.abs(ratio - 2) > .16) { bmp.close(); throw new Error("Use a 2:1 equirectangular 360 panorama."); }
  if (bmp.width < 3072 || bmp.height < 1536) { bmp.close(); throw new Error("Source panorama is too small for a premium 4K delivery asset."); }
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d")!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, width, height); bmp.close();
  const panorama = await canvasBlob(canvas, .94); const thumb = document.createElement("canvas"); thumb.width = 1024; thumb.height = 512; thumb.getContext("2d")!.drawImage(canvas, 0, 0, 1024, 512); const thumbnail = await canvasBlob(thumb, .86);
  return { panorama, thumbnail, width, height };
}

export function aggregateQuality(frames: CapturedFrame[], expected: number) {
  const avg = (key: keyof Pick<CapturedFrame, "sharpness" | "exposure" | "stability" | "overlap">) => frames.length ? frames.reduce((sum, frame) => sum + Number(frame[key] || 0), 0) / frames.length : 0;
  const coverage = Math.min(100, frames.length / Math.max(1, expected) * 100);
  const exposureValues = frames.map((frame) => frame.exposure);
  const exposureConsistency = exposureValues.length ? Math.max(0, 100 - (Math.max(...exposureValues) - Math.min(...exposureValues))) : 0;
  return { sharpness: Math.round(avg("sharpness")), lighting: Math.round(avg("exposure")), coverage: Math.round(coverage), overlap: Math.round(avg("overlap")), stability: Math.round(avg("stability")), exposure_consistency: Math.round(exposureConsistency) };
}
