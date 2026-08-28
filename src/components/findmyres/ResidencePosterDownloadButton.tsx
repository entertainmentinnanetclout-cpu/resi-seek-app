import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/constants/brand";
import { toast } from "sonner";

interface Props {
  residence: any;
  compact?: boolean;
  className?: string;
}

const W = 4096;
const H = 5120;
const NAVY = "#000F2F";
const GOLD = "#F5B32F";
const WHITE = "#FFFFFF";
const MUTED = "#A9B8D0";

const money = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? `R${n.toLocaleString("en-ZA")}` : null;
};

const imageValue = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const v = value as any;
    const candidate = v.url || v.src || v.image_url;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
};

const residenceImages = (residence: any) => {
  const gallery = Array.isArray(residence?.images)
    ? residence.images
    : Array.isArray(residence?.gallery_images)
      ? residence.gallery_images
      : [];
  return Array.from(new Set([
    residence?.cover_image_url,
    ...gallery,
    residence?.image_url,
    residence?.studio_image_url,
  ].map(imageValue).filter(Boolean))) as string[];
};

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
};

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radius = 70) => {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
};

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length) {
    while (ctx.measureText(`${lines[lines.length - 1]}…`).width > maxWidth && lines[lines.length - 1].includes(" ")) {
      lines[lines.length - 1] = lines[lines.length - 1].split(" ").slice(0, -1).join(" ");
    }
    lines[lines.length - 1] += "…";
  }
  return lines;
};

const drawTextLines = (ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) => {
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
};

const safeName = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "residence";

async function generatePoster(residence: any) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Poster renderer is unavailable on this device.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const accent = /^#[0-9A-Fa-f]{6}$/.test(residence?.brand_accent_color || "") ? residence.brand_accent_color : GOLD;
  const primary = /^#[0-9A-Fa-f]{6}$/.test(residence?.brand_primary_color || "") ? residence.brand_primary_color : NAVY;
  const photos = residenceImages(residence);
  const loaded = (await Promise.all(photos.slice(0, 4).map(loadImage))).filter(Boolean) as HTMLImageElement[];
  const logo = await loadImage(BRAND.logos.full || BRAND.logos.icon);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, primary);
  bg.addColorStop(0.62, NAVY);
  bg.addColorStop(1, "#06285A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ResKonnect geometric treatment.
  ctx.fillStyle = "rgba(12,61,126,.58)";
  ctx.beginPath();
  ctx.moveTo(2900, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 3350); ctx.lineTo(2140, 5120); ctx.lineTo(1540, 5120); ctx.closePath(); ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.moveTo(2750, 5120); ctx.lineTo(W, 3720); ctx.lineTo(W, 5120); ctx.closePath(); ctx.fill();

  // Brand header.
  if (logo) {
    const logoH = 220;
    const ratio = logo.naturalWidth / Math.max(1, logo.naturalHeight);
    ctx.drawImage(logo, 260, 230, Math.min(1200, logoH * ratio), logoH);
  } else {
    ctx.fillStyle = WHITE; ctx.font = "900 150px Arial, sans-serif"; ctx.fillText("ResKonnect", 260, 390);
  }
  ctx.fillStyle = accent;
  roundedRect(ctx, 260, 535, 1500, 180, 35); ctx.fill();
  ctx.fillStyle = NAVY; ctx.font = "900 78px Arial, sans-serif"; ctx.fillText("2027 ACCOMMODATION", 330, 655);

  // Primary hero photo/fallback.
  const heroX = 260, heroY = 850, heroW = 3576, heroH = 1670;
  ctx.fillStyle = "#09244B"; roundedRect(ctx, heroX, heroY, heroW, heroH, 80); ctx.fill();
  if (loaded[0]) drawCover(ctx, loaded[0], heroX, heroY, heroW, heroH, 80);
  else {
    const fallback = ctx.createRadialGradient(3100, 1100, 50, 2300, 1600, 1900);
    fallback.addColorStop(0, `${accent}66`); fallback.addColorStop(1, "#06285A");
    ctx.fillStyle = fallback; roundedRect(ctx, heroX, heroY, heroW, heroH, 80); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.font = "900 220px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText("RESKONNECT LIVING", W / 2, 1700); ctx.textAlign = "left";
  }
  const overlay = ctx.createLinearGradient(0, heroY, 0, heroY + heroH);
  overlay.addColorStop(0, "rgba(0,15,47,.02)"); overlay.addColorStop(1, "rgba(0,15,47,.86)");
  ctx.fillStyle = overlay; roundedRect(ctx, heroX, heroY, heroW, heroH, 80); ctx.fill();

  // Gallery strip: genuine photos only.
  if (loaded.length > 1) {
    const gap = 32; const gy = 2210; const gh = 260; const count = Math.min(3, loaded.length - 1); const gw = (1500 - gap * (count - 1)) / count;
    loaded.slice(1, 4).forEach((img, i) => drawCover(ctx, img, heroX + 55 + i * (gw + gap), gy, gw, gh, 34));
  }

  const place = residence?.place_label || residence?.campus || residence?.city || "Student accommodation";
  const name = residence?.brand_headline || residence?.name || "Student Accommodation";
  ctx.fillStyle = WHITE; ctx.font = "900 190px Arial, sans-serif";
  drawTextLines(ctx, wrap(ctx, String(name).toUpperCase(), 3000, 2), 330, 2820, 200);
  ctx.fillStyle = accent; ctx.font = "900 115px Arial, sans-serif";
  drawTextLines(ctx, wrap(ctx, String(place).toUpperCase(), 3000, 2), 330, 3210, 125);

  const privateRate = money(residence?.promo_price || residence?.private_price || residence?.price);
  const nsfasRate = money(residence?.nsfas_price);
  const spots = Number(residence?.available_spots);
  const capacity = Number(residence?.capacity);
  const roomTypes = Array.isArray(residence?.room_types) ? residence.room_types.filter(Boolean).slice(0, 4).join(" • ") : residence?.room_type || "Room options available";
  const address = residence?.address || place;
  const amenityList = Array.isArray(residence?.amenities) ? residence.amenities.filter(Boolean).slice(0, 7).join(" • ") : "View listing for full amenities";

  // Information panel.
  ctx.fillStyle = "rgba(0,8,31,.82)"; roundedRect(ctx, 260, 3480, 3576, 1110, 70); ctx.fill();
  const info = [
    ["PRIVATE", privateRate || "RATE ON LISTING"],
    ["NSFAS", nsfasRate || (residence?.accepts_nsfas ? "FUNDED RATE" : "CHECK ELIGIBILITY")],
    ["AVAILABILITY", Number.isFinite(spots) ? `${spots}${Number.isFinite(capacity) && capacity > 0 ? ` / ${capacity}` : ""} SPOTS` : "CHECK LIVE LISTING"],
    ["ROOMS", String(roomTypes).toUpperCase()],
  ];
  const cols = 2, cardW = 1680, cardH = 255;
  info.forEach(([label, value], index) => {
    const cx = 330 + (index % cols) * 1740;
    const cy = 3560 + Math.floor(index / cols) * 300;
    ctx.fillStyle = "rgba(255,255,255,.07)"; roundedRect(ctx, cx, cy, cardW, cardH, 36); ctx.fill();
    ctx.fillStyle = accent; ctx.font = "900 48px Arial, sans-serif"; ctx.fillText(label, cx + 45, cy + 72);
    ctx.fillStyle = WHITE; ctx.font = "900 64px Arial, sans-serif";
    drawTextLines(ctx, wrap(ctx, value, cardW - 90, 2), cx + 45, cy + 160, 70);
  });
  ctx.fillStyle = MUTED; ctx.font = "600 48px Arial, sans-serif";
  drawTextLines(ctx, wrap(ctx, `📍 ${address}`, 3350, 2), 330, 4245, 62);
  ctx.fillStyle = WHITE; ctx.font = "700 44px Arial, sans-serif";
  drawTextLines(ctx, wrap(ctx, amenityList, 3350, 2), 330, 4395, 58);

  // Conversion footer.
  ctx.fillStyle = accent; roundedRect(ctx, 260, 4680, 3576, 235, 55); ctx.fill();
  ctx.fillStyle = NAVY; ctx.font = "900 74px Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(residence?.reservations_2027_open ? "VIEW • APPLY • RESERVE FOR 2027" : "VIEW RESIDENCE • APPLY ONLINE", W / 2, 4827);
  ctx.textAlign = "left";
  ctx.fillStyle = WHITE; ctx.font = "700 48px Arial, sans-serif";
  const slug = residence?.slug || residence?.id || "";
  ctx.fillText(`www.reskonnect.org/find-my-res/${slug}`, 280, 5050);
  ctx.fillStyle = MUTED; ctx.font = "600 34px Arial, sans-serif"; ctx.textAlign = "right";
  ctx.fillText("Connecting Residents. Advancing Futures.", 3820, 5050); ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("Could not render the poster PNG.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ResKonnect-${safeName(residence?.name || "residence")}-2027-4K.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function ResidencePosterDownloadButton({ residence, compact = false, className = "" }: Props) {
  const [working, setWorking] = useState(false);
  const download = async (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    setWorking(true);
    try {
      await generatePoster(residence);
      toast.success("4K ResKonnect residence poster downloaded");
    } catch (error: any) {
      toast.error(error?.message || "Could not generate residence poster");
    } finally { setWorking(false); }
  };

  return (
    <Button
      type="button"
      size={compact ? "sm" : "default"}
      variant="outline"
      onClick={download}
      disabled={working}
      className={`border-white/70 bg-white text-[#071326] shadow-xl hover:border-[#F5B32F] hover:bg-[#F5B32F] hover:text-[#071326] ${className}`}
      title="Download a 4096px ResKonnect marketing poster"
    >
      {working ? <Loader2 className="animate-spin" /> : <Download />}
      {!compact && (working ? "Rendering 4K…" : "Download 4K poster")}
    </Button>
  );
}
