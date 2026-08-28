import { useState } from "react";
import { Download, Loader2, Monitor, Smartphone, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND } from "@/constants/brand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  residence: any;
  compact?: boolean;
  className?: string;
}

type PosterFormatKey = "square" | "story" | "landscape";
type PosterMarketingConfig = {
  network_claim: string;
  urgency_line: string;
  conversion_line: string;
  network_label: string;
  start_to_up_logo_url: string;
  show_referral_fee: boolean;
  visible_listing_count?: number;
};

type PosterSpec = {
  width: number;
  height: number;
  label: string;
  hint: string;
};

const POSTER_FORMATS: Record<PosterFormatKey, PosterSpec> = {
  square: { width: 4096, height: 4096, label: "Square 4K", hint: "1:1 · Facebook / Instagram" },
  story: { width: 2160, height: 3840, label: "Story 4K", hint: "9:16 · WhatsApp / Instagram / TikTok" },
  landscape: { width: 3840, height: 2160, label: "Landscape 4K", hint: "16:9 · 1920×1080 ratio" },
};

const NAVY = "#001A44";
const NAVY_DARK = "#000F2F";
const ORANGE = "#FF7900";
const WHITE = "#FFFFFF";
const INK = "#071326";
const MUTED = "#D8E0EC";
const TEAL = "#18D3C2";
const START_TO_UP_LOGO = "https://raw.githubusercontent.com/entertainmentinnanetclout-cpu/Start-To-Up/main/public/brand/start-to-up-logo-light.png";

const DEFAULT_MARKETING: PosterMarketingConfig = {
  network_claim: "300+ accommodation & rental options across ResKonnect",
  urgency_line: "Popular residences fill fast — apply early.",
  conversion_line: "Compare accommodation, review the live listing and apply online through ResKonnect.",
  network_label: "ACCOMMODATION & RENTALS",
  start_to_up_logo_url: START_TO_UP_LOGO,
  show_referral_fee: false,
};

let posterConfigPromise: Promise<PosterMarketingConfig> | null = null;

const loadPosterConfig = async (): Promise<PosterMarketingConfig> => {
  if (!posterConfigPromise) {
    posterConfigPromise = (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("get_residence_poster_marketing_config");
        if (error || !data) return DEFAULT_MARKETING;
        return { ...DEFAULT_MARKETING, ...(data as PosterMarketingConfig), show_referral_fee: false };
      } catch {
        return DEFAULT_MARKETING;
      }
    })();
  }
  return posterConfigPromise;
};

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

// Poster media is intentionally restricted to genuine listing photos.
// studio_image_url is not used because it can be a cut-out/marketing asset rather than a property photo.
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
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
};

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radius = 40) => {
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

const drawContain = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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

const fitFont = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initial: number, min: number, weight = 900) => {
  let size = initial;
  while (size > min) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
};

const safeName = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "residence";

const hasAmenity = (residence: any, needle: string) => {
  const amenities = Array.isArray(residence?.amenities) ? residence.amenities.map((x: unknown) => String(x).toLowerCase()) : [];
  return amenities.some((item: string) => item.includes(needle.toLowerCase()));
};

type FeatureIcon = "wifi" | "shield" | "bed" | "parking" | "laundry" | "power" | "apply" | "room";
type Feature = { icon: FeatureIcon; title: string; detail: string };

const residenceFeatures = (residence: any): Feature[] => {
  const features: Feature[] = [];
  if (residence?.has_wifi || hasAmenity(residence, "wifi") || hasAmenity(residence, "wi-fi")) features.push({ icon: "wifi", title: "Wi-Fi", detail: "Available at this residence" });
  if (hasAmenity(residence, "security") || hasAmenity(residence, "access control") || hasAmenity(residence, "cctv")) features.push({ icon: "shield", title: "Security", detail: "See listing for security details" });
  if (residence?.is_furnished || hasAmenity(residence, "furnished")) features.push({ icon: "bed", title: "Furnished", detail: "Furnished living option" });
  if (hasAmenity(residence, "laundry") || hasAmenity(residence, "washing")) features.push({ icon: "laundry", title: "Laundry", detail: "Laundry amenity listed" });
  if (residence?.has_parking || hasAmenity(residence, "parking")) features.push({ icon: "parking", title: "Parking", detail: "Parking listed" });
  if (hasAmenity(residence, "backup") || hasAmenity(residence, "generator") || hasAmenity(residence, "solar")) features.push({ icon: "power", title: "Backup Power", detail: "Power support listed" });
  const roomLabel = Array.isArray(residence?.room_types) && residence.room_types.length
    ? residence.room_types.filter(Boolean).slice(0, 2).join(" / ")
    : residence?.room_type;
  if (roomLabel) features.push({ icon: "room", title: String(roomLabel), detail: "Room option on this listing" });
  features.push({ icon: "apply", title: "Apply Online", detail: "Apply through ResKonnect" });
  return features.slice(0, 4);
};

const drawFeatureIcon = (ctx: CanvasRenderingContext2D, icon: FeatureIcon, cx: number, cy: number, r: number) => {
  ctx.save();
  ctx.strokeStyle = WHITE;
  ctx.fillStyle = WHITE;
  ctx.lineWidth = Math.max(4, r * 0.09);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (icon === "wifi") {
    [0.45, 0.72, 1].forEach((scale) => {
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.35, r * scale, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, r * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (icon === "shield") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.9); ctx.lineTo(cx + r * 0.7, cy - r * 0.55); ctx.lineTo(cx + r * 0.55, cy + r * 0.35); ctx.lineTo(cx, cy + r * 0.9); ctx.lineTo(cx - r * 0.55, cy + r * 0.35); ctx.lineTo(cx - r * 0.7, cy - r * 0.55); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.05, r * 0.18, Math.PI, 0); ctx.stroke();
    ctx.strokeRect(cx - r * 0.24, cy - r * 0.02, r * 0.48, r * 0.4);
  } else if (icon === "bed" || icon === "room") {
    ctx.strokeRect(cx - r * 0.78, cy - r * 0.05, r * 1.56, r * 0.65);
    ctx.strokeRect(cx - r * 0.72, cy - r * 0.45, r * 0.55, r * 0.35);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.82, cy + r * 0.6); ctx.lineTo(cx - r * 0.82, cy + r * 0.82); ctx.moveTo(cx + r * 0.82, cy + r * 0.6); ctx.lineTo(cx + r * 0.82, cy + r * 0.82); ctx.stroke();
  } else if (icon === "parking") {
    ctx.font = `900 ${r * 1.4}px Arial, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("P", cx, cy + r * 0.06);
  } else if (icon === "laundry") {
    ctx.strokeRect(cx - r * 0.7, cy - r * 0.75, r * 1.4, r * 1.5);
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.18, r * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.48, r * 0.08, 0, Math.PI * 2); ctx.fill();
  } else if (icon === "power") {
    ctx.beginPath(); ctx.moveTo(cx + r * 0.08, cy - r); ctx.lineTo(cx - r * 0.48, cy + r * 0.08); ctx.lineTo(cx + r * 0.05, cy + r * 0.08); ctx.lineTo(cx - r * 0.08, cy + r); ctx.lineTo(cx + r * 0.55, cy - r * 0.2); ctx.lineTo(cx + r * 0.02, cy - r * 0.2); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(cx - r * 0.72, cy); ctx.lineTo(cx - r * 0.15, cy + r * 0.55); ctx.lineTo(cx + r * 0.78, cy - r * 0.6); ctx.stroke();
  }
  ctx.restore();
};

const drawPhotoPlaceholder = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = 40) => {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#06285A");
  g.addColorStop(1, NAVY_DARK);
  ctx.fillStyle = g;
  roundedRect(ctx, x, y, w, h, radius); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.textAlign = "center";
  ctx.font = `900 ${Math.max(30, Math.min(w, h) * 0.08)}px Arial, sans-serif`;
  ctx.fillText("RESIDENCE PHOTOS PENDING", x + w / 2, y + h / 2);
  ctx.textAlign = "left";
};

const drawLocationCard = (ctx: CanvasRenderingContext2D, province: string, campus: string, x: number, y: number, w: number, h: number, scale = 1) => {
  ctx.fillStyle = WHITE;
  roundedRect(ctx, x, y, w, h, 44 * scale); ctx.fill();
  ctx.fillStyle = ORANGE;
  ctx.beginPath(); ctx.arc(x + 88 * scale, y + h / 2 - 12 * scale, 35 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 88 * scale, y + h / 2 + 48 * scale); ctx.lineTo(x + 58 * scale, y + h / 2 + 10 * scale); ctx.lineTo(x + 118 * scale, y + h / 2 + 10 * scale); ctx.closePath(); ctx.fill();
  const tx = x + 150 * scale;
  ctx.fillStyle = INK;
  ctx.font = `800 ${34 * scale}px Arial, sans-serif`;
  ctx.fillText(`FOR STUDENTS IN ${province.toUpperCase()}`, tx, y + 66 * scale);
  ctx.fillStyle = NAVY;
  ctx.font = `900 ${45 * scale}px Arial, sans-serif`;
  const campusText = `NEAR ${campus.toUpperCase()}`;
  const fontSize = fitFont(ctx, campusText, w - 190 * scale, 45 * scale, 25 * scale, 900);
  ctx.font = `900 ${fontSize}px Arial, sans-serif`;
  ctx.fillText(campusText, tx, y + 122 * scale);
};

const drawFeaturesStrip = (ctx: CanvasRenderingContext2D, features: Feature[], x: number, y: number, w: number, h: number, columns: number) => {
  ctx.fillStyle = WHITE;
  roundedRect(ctx, x, y, w, h, Math.min(56, h * 0.12)); ctx.fill();
  const rows = Math.ceil(features.length / columns);
  const cellW = w / columns;
  const cellH = h / rows;
  features.forEach((feature, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cx = x + col * cellW;
    const cy = y + row * cellH;
    if (col > 0) {
      ctx.strokeStyle = "#D7DEE9"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy + 28); ctx.lineTo(cx, cy + cellH - 28); ctx.stroke();
    }
    const iconR = Math.min(56, cellH * 0.22);
    const iconX = cx + 82;
    const iconY = cy + cellH / 2;
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2); ctx.fill();
    drawFeatureIcon(ctx, feature.icon, iconX, iconY, iconR * 0.55);
    const textX = cx + 160;
    ctx.fillStyle = INK;
    ctx.font = `900 ${Math.max(25, Math.min(42, cellH * 0.13))}px Arial, sans-serif`;
    const titleLines = wrap(ctx, feature.title, cellW - 190, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, textX, cy + cellH * 0.4 + i * 42));
    ctx.fillStyle = "#3C4657";
    ctx.font = `600 ${Math.max(20, Math.min(29, cellH * 0.09))}px Arial, sans-serif`;
    const detailLines = wrap(ctx, feature.detail, cellW - 190, 2);
    detailLines.forEach((line, i) => ctx.fillText(line, textX, cy + cellH * 0.72 + i * 31));
  });
};

const drawFooter = (ctx: CanvasRenderingContext2D, reskonnectLogo: HTMLImageElement, marketing: PosterMarketingConfig, x: number, y: number, w: number, h: number, layout: "wide" | "stacked") => {
  ctx.fillStyle = NAVY_DARK;
  roundedRect(ctx, x, y, w, h, 48); ctx.fill();
  if (layout === "wide") {
    drawContain(ctx, reskonnectLogo, x + 56, y + 36, w * 0.28, h * 0.42);
    ctx.fillStyle = WHITE; ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(BRAND.tagline, x + 70, y + h * 0.72);
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + 40); ctx.lineTo(x + w * 0.35, y + h - 40); ctx.stroke();
    ctx.fillStyle = WHITE; ctx.font = "800 31px Arial, sans-serif";
    ctx.fillText(BRAND.contact.phone, x + w * 0.39, y + 78);
    ctx.fillText(BRAND.contact.email, x + w * 0.58, y + 78);
    ctx.fillText(BRAND.contact.website, x + w * 0.80, y + 78);
    ctx.fillStyle = ORANGE; ctx.font = "900 34px Arial, sans-serif";
    ctx.fillText(marketing.network_claim, x + w * 0.39, y + 142);
    ctx.fillStyle = MUTED; ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText(marketing.urgency_line, x + w * 0.39, y + 188);
  } else {
    drawContain(ctx, reskonnectLogo, x + 50, y + 34, w * 0.60, h * 0.27);
    ctx.fillStyle = WHITE; ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText(BRAND.tagline, x + 60, y + h * 0.36);
    ctx.fillStyle = WHITE; ctx.font = "800 28px Arial, sans-serif";
    ctx.fillText(BRAND.contact.phone, x + 60, y + h * 0.53);
    ctx.fillText(BRAND.contact.email, x + 60, y + h * 0.63);
    ctx.fillText(BRAND.contact.website, x + 60, y + h * 0.73);
    ctx.fillStyle = ORANGE; ctx.font = "900 30px Arial, sans-serif";
    const claim = wrap(ctx, marketing.network_claim, w - 120, 2);
    claim.forEach((line, i) => ctx.fillText(line, x + 60, y + h * 0.84 + i * 36));
  }
};

const drawSquarePoster = (
  ctx: CanvasRenderingContext2D,
  residence: any,
  photos: HTMLImageElement[],
  startLogo: HTMLImageElement,
  reskonnectLogo: HTMLImageElement,
  marketing: PosterMarketingConfig,
) => {
  const W = 4096, H = 4096;
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#06285A"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1730, 0); ctx.quadraticCurveTo(1600, 850, 1250, 1170); ctx.lineTo(0, 1030); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(0, 1030); ctx.quadraticCurveTo(1220, 1180, 1730, 0); ctx.stroke();
  drawContain(ctx, startLogo, 120, 115, 1220, 560);

  const heroX = 1450, heroY = 0, heroW = 2646, heroH = 1770;
  if (photos[0]) drawCover(ctx, photos[0], heroX, heroY, heroW, heroH, 0); else drawPhotoPlaceholder(ctx, heroX, heroY, heroW, heroH, 0);
  if (photos[1]) drawCover(ctx, photos[1], 2710, 900, 1386, 870, 0);
  if (photos[2]) drawCover(ctx, photos[2], 1450, 1210, 1240, 560, 0);

  const province = String(residence?.province || "South Africa");
  const campus = String(residence?.campus || residence?.place_label || "Nearby campus");
  drawLocationCard(ctx, province, campus, 120, 820, 1230, 300, 1.55);

  const spots = Number(residence?.available_spots || 0);
  const status = residence?.reservations_2027_open ? "2027 RESERVATIONS OPEN" : spots > 0 ? "ACCOMMODATION AVAILABLE" : "ENQUIRE FOR AVAILABILITY";
  ctx.fillStyle = ORANGE; roundedRect(ctx, 1320, 1630, 1530, 190, 60); ctx.fill();
  ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.font = "900 72px Arial, sans-serif"; ctx.fillText(status, 2085, 1754); ctx.textAlign = "left";

  const name = String(residence?.name || "Student Accommodation").toUpperCase();
  ctx.fillStyle = WHITE;
  const fs = fitFont(ctx, name, 3600, 190, 95, 900); ctx.font = `900 ${fs}px Arial, sans-serif`;
  const nameLines = wrap(ctx, name, 3600, 2); nameLines.forEach((line, i) => ctx.fillText(line, 180, 2070 + i * (fs + 18)));

  const privateRate = money(residence?.promo_price || residence?.private_price || residence?.price);
  const nsfasRate = money(residence?.nsfas_price);
  const subline = [privateRate ? `Private from ${privateRate}/month` : null, residence?.accepts_nsfas ? (nsfasRate ? `NSFAS ${nsfasRate}/month` : "NSFAS option listed") : null, campus].filter(Boolean).join("  •  ");
  ctx.fillStyle = ORANGE; ctx.font = "900 58px Arial, sans-serif"; ctx.fillText(subline || campus, 180, 2450);
  ctx.fillStyle = WHITE; ctx.font = "700 40px Arial, sans-serif"; ctx.fillText(marketing.conversion_line, 180, 2525);

  drawFeaturesStrip(ctx, residenceFeatures(residence), 170, 2630, 3756, 660, 4);

  ctx.fillStyle = ORANGE; roundedRect(ctx, 520, 3370, 3056, 270, 80); ctx.fill();
  ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.font = "900 88px Arial, sans-serif"; ctx.fillText(residence?.reservations_2027_open ? "VIEW • APPLY • RESERVE FOR 2027" : "VIEW & APPLY ON RESKONNECT", W / 2, 3540); ctx.textAlign = "left";
  ctx.fillStyle = TEAL; ctx.font = "900 42px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(marketing.network_claim, W / 2, 3715); ctx.fillStyle = WHITE; ctx.font = "800 38px Arial, sans-serif"; ctx.fillText(marketing.urgency_line, W / 2, 3770); ctx.textAlign = "left";

  drawFooter(ctx, reskonnectLogo, marketing, 130, 3820, 3836, 240, "wide");
};

const drawStoryPoster = (
  ctx: CanvasRenderingContext2D,
  residence: any,
  photos: HTMLImageElement[],
  startLogo: HTMLImageElement,
  reskonnectLogo: HTMLImageElement,
  marketing: PosterMarketingConfig,
) => {
  const W = 2160, H = 3840;
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#06285A"; roundedRect(ctx, 0, 0, 980, 930, 0); ctx.fill();
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(0, 900); ctx.quadraticCurveTo(840, 1030, 1120, 0); ctx.stroke();
  drawContain(ctx, startLogo, 85, 105, 790, 350);

  if (photos[0]) drawCover(ctx, photos[0], 780, 0, 1380, 1270, 0); else drawPhotoPlaceholder(ctx, 780, 0, 1380, 1270, 0);
  if (photos[1]) drawCover(ctx, photos[1], 1080, 900, 1080, 560, 0);
  if (photos[2]) drawCover(ctx, photos[2], 780, 1130, 300, 330, 0);

  const province = String(residence?.province || "South Africa");
  const campus = String(residence?.campus || residence?.place_label || "Nearby campus");
  drawLocationCard(ctx, province, campus, 75, 620, 780, 250, 1.25);

  const spots = Number(residence?.available_spots || 0);
  const status = residence?.reservations_2027_open ? "2027 RESERVATIONS OPEN" : spots > 0 ? "ACCOMMODATION AVAILABLE" : "ENQUIRE FOR AVAILABILITY";
  ctx.fillStyle = ORANGE; roundedRect(ctx, 450, 1375, 1260, 155, 50); ctx.fill();
  ctx.fillStyle = WHITE; ctx.font = "900 60px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(status, W / 2, 1477); ctx.textAlign = "left";

  const name = String(residence?.name || "Student Accommodation").toUpperCase();
  const fs = fitFont(ctx, name, 1940, 128, 70, 900); ctx.font = `900 ${fs}px Arial, sans-serif`; ctx.fillStyle = WHITE;
  wrap(ctx, name, 1940, 2).forEach((line, i) => ctx.fillText(line, 110, 1700 + i * (fs + 12)));

  const privateRate = money(residence?.promo_price || residence?.private_price || residence?.price);
  const nsfasRate = money(residence?.nsfas_price);
  const pricing = [privateRate ? `PRIVATE FROM ${privateRate}/MONTH` : null, residence?.accepts_nsfas ? (nsfasRate ? `NSFAS ${nsfasRate}/MONTH` : "NSFAS OPTION LISTED") : null].filter(Boolean).join("  •  ");
  ctx.fillStyle = ORANGE; ctx.font = "900 45px Arial, sans-serif"; ctx.fillText(pricing || campus.toUpperCase(), 110, 1960);
  ctx.fillStyle = WHITE; ctx.font = "700 30px Arial, sans-serif"; wrap(ctx, marketing.conversion_line, 1940, 2).forEach((line, i) => ctx.fillText(line, 110, 2020 + i * 38));

  drawFeaturesStrip(ctx, residenceFeatures(residence), 90, 2170, 1980, 790, 2);

  ctx.fillStyle = ORANGE; roundedRect(ctx, 160, 3040, 1840, 220, 70); ctx.fill();
  ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.font = "900 62px Arial, sans-serif"; ctx.fillText(residence?.reservations_2027_open ? "APPLY / RESERVE ON RESKONNECT" : "APPLY ON RESKONNECT", W / 2, 3180);
  ctx.fillStyle = TEAL; ctx.font = "900 34px Arial, sans-serif"; ctx.fillText(marketing.network_claim, W / 2, 3315);
  ctx.fillStyle = WHITE; ctx.font = "800 31px Arial, sans-serif"; ctx.fillText(marketing.urgency_line, W / 2, 3360); ctx.textAlign = "left";

  drawFooter(ctx, reskonnectLogo, marketing, 90, 3440, 1980, 330, "wide");
};

const drawLandscapePoster = (
  ctx: CanvasRenderingContext2D,
  residence: any,
  photos: HTMLImageElement[],
  startLogo: HTMLImageElement,
  reskonnectLogo: HTMLImageElement,
  marketing: PosterMarketingConfig,
) => {
  const W = 3840, H = 2160;
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#06285A"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1680, 0); ctx.quadraticCurveTo(1520, 650, 1290, 980); ctx.lineTo(0, 980); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 980); ctx.quadraticCurveTo(1280, 1080, 1680, 0); ctx.stroke();
  drawContain(ctx, startLogo, 90, 80, 1120, 400);

  if (photos[0]) drawCover(ctx, photos[0], 1600, 0, 2240, 1100, 0); else drawPhotoPlaceholder(ctx, 1600, 0, 2240, 1100, 0);
  if (photos[1]) drawCover(ctx, photos[1], 2080, 710, 820, 390, 0);
  if (photos[2]) drawCover(ctx, photos[2], 2910, 710, 930, 390, 0);

  const province = String(residence?.province || "South Africa");
  const campus = String(residence?.campus || residence?.place_label || "Nearby campus");
  drawLocationCard(ctx, province, campus, 95, 570, 1190, 255, 1.25);

  const spots = Number(residence?.available_spots || 0);
  const status = residence?.reservations_2027_open ? "2027 RESERVATIONS OPEN" : spots > 0 ? "ACCOMMODATION AVAILABLE" : "ENQUIRE FOR AVAILABILITY";
  ctx.fillStyle = ORANGE; roundedRect(ctx, 100, 965, 1280, 160, 50); ctx.fill();
  ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.font = "900 58px Arial, sans-serif"; ctx.fillText(status, 740, 1070); ctx.textAlign = "left";

  const name = String(residence?.name || "Student Accommodation").toUpperCase();
  const fs = fitFont(ctx, name, 1500, 118, 68, 900); ctx.font = `900 ${fs}px Arial, sans-serif`; ctx.fillStyle = WHITE;
  wrap(ctx, name, 1500, 2).forEach((line, i) => ctx.fillText(line, 105, 1285 + i * (fs + 8)));

  const privateRate = money(residence?.promo_price || residence?.private_price || residence?.price);
  const nsfasRate = money(residence?.nsfas_price);
  const pricing = [privateRate ? `Private from ${privateRate}/month` : null, residence?.accepts_nsfas ? (nsfasRate ? `NSFAS ${nsfasRate}/month` : "NSFAS option listed") : null].filter(Boolean).join(" • ");
  ctx.fillStyle = ORANGE; ctx.font = "900 40px Arial, sans-serif"; ctx.fillText(pricing || campus, 105, 1550);
  ctx.fillStyle = WHITE; ctx.font = "700 30px Arial, sans-serif"; wrap(ctx, marketing.conversion_line, 1450, 2).forEach((line, i) => ctx.fillText(line, 105, 1605 + i * 36));

  drawFeaturesStrip(ctx, residenceFeatures(residence), 1560, 1160, 2180, 570, 4);

  ctx.fillStyle = ORANGE; roundedRect(ctx, 1540, 1780, 2190, 190, 65); ctx.fill();
  ctx.fillStyle = WHITE; ctx.textAlign = "center"; ctx.font = "900 64px Arial, sans-serif"; ctx.fillText(residence?.reservations_2027_open ? "VIEW • APPLY • RESERVE" : "VIEW & APPLY ON RESKONNECT", 2635, 1900); ctx.textAlign = "left";
  ctx.fillStyle = TEAL; ctx.font = "900 29px Arial, sans-serif"; ctx.fillText(marketing.network_claim, 105, 1775);
  ctx.fillStyle = WHITE; ctx.font = "800 29px Arial, sans-serif"; ctx.fillText(marketing.urgency_line, 105, 1820);

  drawFooter(ctx, reskonnectLogo, marketing, 80, 1880, 1420, 225, "stacked");
};

async function generatePoster(residence: any, format: PosterFormatKey) {
  const spec = POSTER_FORMATS[format];
  const marketing = await loadPosterConfig();
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Poster renderer is unavailable on this device.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const photoSources = residenceImages(residence);
  const photos = (await Promise.all(photoSources.slice(0, 4).map(loadImage))).filter(Boolean) as HTMLImageElement[];
  const [startLogo, reskonnectLogo] = await Promise.all([
    loadImage(marketing.start_to_up_logo_url || START_TO_UP_LOGO),
    loadImage(BRAND.logos.full || BRAND.logos.icon),
  ]);

  if (!startLogo) throw new Error("Official Start To Up logo could not load. Poster generation was stopped to protect brand accuracy.");
  if (!reskonnectLogo) throw new Error("Official ResKonnect logo could not load. Poster generation was stopped to protect brand accuracy.");

  if (format === "square") drawSquarePoster(ctx, residence, photos, startLogo, reskonnectLogo, marketing);
  else if (format === "story") drawStoryPoster(ctx, residence, photos, startLogo, reskonnectLogo, marketing);
  else drawLandscapePoster(ctx, residence, photos, startLogo, reskonnectLogo, marketing);

  const slug = residence?.slug || residence?.id || "";
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = `${Math.max(22, spec.width * 0.008)}px Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(`www.reskonnect.org/find-my-res/${slug}`, spec.width - 50, spec.height - 32);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("Could not render the poster PNG.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ResKonnect-${safeName(residence?.name || "residence")}-${format}-${spec.width}x${spec.height}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const formatIcon = (format: PosterFormatKey) => {
  if (format === "story") return Smartphone;
  if (format === "landscape") return Monitor;
  return Square;
};

export default function ResidencePosterDownloadButton({ residence, compact = false, className = "" }: Props) {
  const [working, setWorking] = useState<PosterFormatKey | null>(null);

  const download = async (format: PosterFormatKey) => {
    setWorking(format);
    try {
      await generatePoster(residence, format);
      toast.success(`${POSTER_FORMATS[format].label} residence poster downloaded`);
    } catch (error: any) {
      toast.error(error?.message || "Could not generate residence poster");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div onClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onKeyDown={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            variant="outline"
            disabled={Boolean(working)}
            className={`border-white/70 bg-white text-[#071326] shadow-xl hover:border-[#FF7900] hover:bg-[#FF7900] hover:text-white ${compact ? "h-9 gap-1.5 rounded-full px-3 text-xs font-black" : ""} ${className}`}
            title="Download a high-resolution residence marketing poster"
          >
            {working ? <Loader2 className="animate-spin" /> : <Download />}
            {compact ? (working ? "Rendering…" : "Poster") : (working ? "Rendering poster…" : "Download poster")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuLabel>Residence marketing studio</DropdownMenuLabel>
          <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">Uses only this residence's real listing photos and live province, campus, prices and availability.</p>
          <DropdownMenuSeparator />
          {(Object.keys(POSTER_FORMATS) as PosterFormatKey[]).map((format) => {
            const Icon = formatIcon(format);
            const spec = POSTER_FORMATS[format];
            return (
              <DropdownMenuItem key={format} disabled={Boolean(working)} onSelect={() => void download(format)} className="gap-3 py-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="font-bold">{spec.label}</p>
                  <p className="text-xs text-muted-foreground">{spec.hint} · {spec.width}×{spec.height}</p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <p className="px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">No referral-fee copy. Start To Up + ResKonnect branding is locked to official logo assets.</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
