import type { CSSProperties } from "react";
import { Building2, Camera, MapPin, ShieldCheck } from "lucide-react";
import { BRAND } from "@/constants/brand";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";

interface ResidenceBrandStudioCardProps {
  residence: any;
  className?: string;
  showPrice?: boolean;
}

const safeHex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;

const money = (value: unknown) => {
  const amount = Number(value || 0);
  return amount > 0 ? `R${amount.toLocaleString("en-ZA")}` : null;
};

const imageUrl = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const candidate = (value as any).url || (value as any).src || (value as any).image_url;
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  }
  return null;
};

const galleryImages = (residence: any) => {
  const raw = Array.isArray(residence?.images)
    ? residence.images
    : Array.isArray(residence?.gallery_images)
      ? residence.gallery_images
      : [];

  const candidates = [
    residence?.cover_image_url,
    ...raw,
    residence?.image_url,
    residence?.studio_image_url,
  ]
    .map(imageUrl)
    .filter(Boolean) as string[];

  return Array.from(new Set(candidates));
};

export default function ResidenceBrandStudioCard({ residence, className = "", showPrice = true }: ResidenceBrandStudioCardProps) {
  const navy = safeHex(residence?.brand_primary_color, "#000F2F");
  const gold = safeHex(residence?.brand_accent_color, "#E09008");
  const photos = galleryImages(residence);
  const preview = photos[0] || null;
  const studio = imageUrl(residence?.studio_image_url);
  const place = residence?.place_label || residence?.campus || residence?.city || "Student living";
  const headline = residence?.brand_headline || residence?.name || "Student Accommodation";
  const subheadline = residence?.brand_subheadline || "STUDENT ACCOMMODATION, CONNECTED";
  const badge = residence?.brand_badge || "RESKONNECT LIVING";
  const price = money(residence?.promo_price || residence?.private_price || residence?.price);
  const style = { "--rk-navy": navy, "--rk-gold": gold } as CSSProperties;

  return (
    <div
      style={style}
      className={`relative isolate aspect-[9/13] w-full min-w-0 overflow-hidden rounded-[24px] bg-[var(--rk-navy)] text-white shadow-2xl ${className}`}
      aria-label={`${residence?.name || "Residence"} branded accommodation card`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(0,15,47,1)_0%,rgba(0,15,47,.99)_48%,rgba(4,42,94,.96)_100%)]" />
      <div className="absolute -right-[18%] top-[8%] h-[70%] w-[62%] bg-[#06285a]/75 [clip-path:polygon(42%_0,100%_0,100%_100%,0_100%)]" />
      <div className="absolute -right-[10%] bottom-[-1%] h-[29%] w-[58%] bg-[var(--rk-gold)] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
      <div className="absolute left-5 top-[49%] h-36 w-36 rounded-full border border-blue-400/10" />
      <div className="absolute right-6 top-[47%] h-20 w-20 rotate-12 rounded-[24px] border-2 border-blue-400/15" />

      <div className="absolute inset-x-0 top-0 z-30 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img src={BRAND.logos.icon} alt="" className="h-9 w-9 rounded-lg bg-white/95 p-1 object-contain" />
            <span className="text-lg font-black tracking-tight sm:text-xl">ResKonnect</span>
          </div>
          <ResidencePosterDownloadButton residence={residence} compact className="shrink-0" />
        </div>
        <div className="mt-5 inline-flex max-w-[72%] items-center rounded-md bg-[var(--rk-gold)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#00102f] shadow-lg sm:text-xs">
          {badge}
        </div>
      </div>

      <div className="absolute inset-x-5 top-[18%] z-20 h-[31%] overflow-hidden rounded-[18px] border border-white/15 bg-[#041a40] shadow-[0_18px_45px_rgba(0,0,0,.36)] sm:inset-x-6">
        {preview ? (
          <>
            <img
              src={preview}
              alt={`${residence?.name || "Residence"} accommodation preview`}
              className="h-full w-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#00102f]/75 via-transparent to-black/10" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_70%_20%,rgba(224,144,8,.22),transparent_38%),linear-gradient(135deg,#06285a,#00102f)]">
            <Building2 className="h-16 w-16 text-white/22" />
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#00102f]/88 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
          <Camera className="h-3 w-3 text-[var(--rk-gold)]" />
          {photos.length > 0 ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"}` : "Photo pending"}
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-[var(--rk-gold)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#00102f] shadow-lg">
          Property preview
        </div>

        {photos.length > 1 && (
          <div className="absolute right-3 top-3 flex gap-1.5">
            {photos.slice(1, 4).map((photo) => (
              <div key={photo} className="h-9 w-9 overflow-hidden rounded-lg border border-white/30 bg-[#00102f] shadow-lg">
                <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute left-0 top-[51%] z-20 w-[82%] p-5 sm:p-6">
        <p className="text-[clamp(1.35rem,5vw,2.25rem)] font-black uppercase leading-[0.94] tracking-[-0.04em] drop-shadow-xl">
          {headline}
        </p>
        <p className="mt-2 text-[clamp(1.05rem,4.4vw,1.75rem)] font-black uppercase leading-none text-[var(--rk-gold)] drop-shadow-lg">
          {place}
        </p>
        <p className="mt-3 max-w-[19rem] text-[10px] font-black uppercase leading-tight tracking-wide text-white/95 sm:text-xs">
          {subheadline}
        </p>
      </div>

      {studio && preview && studio !== preview && (
        <div className="absolute bottom-[9%] right-[-5%] z-10 h-[31%] w-[46%] opacity-95">
          <img src={studio} alt="" className="h-full w-full object-contain object-bottom drop-shadow-2xl" loading="lazy" decoding="async" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#000b24] via-[#000b24]/92 to-transparent px-5 pb-5 pt-14 sm:px-6 sm:pb-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/75 sm:text-xs">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--rk-gold)]" />
              <span className="truncate">{residence?.address || place}</span>
            </div>
            {showPrice && price && (
              <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                From {price}<span className="text-[10px] font-semibold text-white/60"> / month</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-[9px] font-bold text-white/80 backdrop-blur">
            {residence?.is_trusted || residence?.trusted ? <ShieldCheck className="h-3 w-3 text-[var(--rk-gold)]" /> : <Building2 className="h-3 w-3 text-[var(--rk-gold)]" />}
            {residence?.is_trusted || residence?.trusted ? "TRUSTED" : "LISTING"}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center rounded-lg bg-[var(--rk-gold)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#00102f] shadow-xl">
          View • Apply • Reserve
        </div>
      </div>
    </div>
  );
}
