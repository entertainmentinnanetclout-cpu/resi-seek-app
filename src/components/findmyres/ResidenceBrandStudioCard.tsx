import type { CSSProperties } from "react";
import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { BRAND } from "@/constants/brand";

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

export default function ResidenceBrandStudioCard({ residence, className = "", showPrice = true }: ResidenceBrandStudioCardProps) {
  const navy = safeHex(residence?.brand_primary_color, "#000F2F");
  const gold = safeHex(residence?.brand_accent_color, "#E09008");
  const studio = residence?.studio_image_url || null;
  const cover = residence?.cover_image_url || residence?.image_url || null;
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
      {cover && !studio && (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" decoding="async" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,15,47,.99)_0%,rgba(0,15,47,.96)_52%,rgba(3,42,99,.88)_100%)]" />
      <div className="absolute -right-[16%] top-[12%] h-[68%] w-[58%] rotate-[1deg] bg-[#06285a]/90 [clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)]" />
      <div className="absolute -right-[16%] bottom-[-2%] h-[34%] w-[62%] bg-[var(--rk-gold)] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
      <div className="absolute left-6 top-[45%] h-40 w-40 rounded-full border border-blue-400/10" />
      <div className="absolute right-7 top-[23%] h-24 w-24 rotate-12 rounded-[28px] border-2 border-blue-400/20" />

      <div className="absolute inset-x-0 top-0 z-20 p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <img src={BRAND.logos.icon} alt="" className="h-9 w-9 rounded-lg bg-white/95 p-1 object-contain" />
          <span className="text-lg font-black tracking-tight sm:text-xl">ResKonnect</span>
        </div>
        <div className="mt-7 inline-flex max-w-[88%] items-center rounded-md bg-[var(--rk-gold)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#00102f] shadow-lg sm:text-xs">
          {badge}
        </div>
      </div>

      <div className="absolute left-0 top-[26%] z-20 w-[74%] p-5 sm:p-6">
        <p className="text-[clamp(1.45rem,5.5vw,2.5rem)] font-black uppercase leading-[0.94] tracking-[-0.04em] drop-shadow-xl">
          {headline}
        </p>
        <p className="mt-2 text-[clamp(1.2rem,5vw,2.1rem)] font-black uppercase leading-none text-[var(--rk-gold)] drop-shadow-lg">
          {place}
        </p>
        <p className="mt-4 max-w-[20rem] text-xs font-black uppercase leading-tight tracking-wide text-white sm:text-sm">
          {subheadline}
        </p>
        {residence?.description && (
          <p className="mt-3 line-clamp-3 max-w-[15rem] text-[10px] font-medium leading-relaxed text-white/78 sm:text-xs">
            {residence.description}
          </p>
        )}
      </div>

      {studio && (
        <div className="absolute bottom-0 right-[-5%] z-10 h-[58%] w-[72%]">
          <div className="absolute inset-x-[16%] bottom-[4%] h-[20%] rounded-full bg-black/40 blur-2xl" />
          <img src={studio} alt={`${residence?.name || "Residence"} cover`} className="relative h-full w-full object-contain object-bottom drop-shadow-2xl" loading="lazy" decoding="async" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#000b24] via-[#000b24]/80 to-transparent px-5 pb-5 pt-20 sm:px-6 sm:pb-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/75 sm:text-xs">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--rk-gold)]" />
              <span className="truncate">{residence?.address || place}</span>
            </div>
            {showPrice && price && <p className="mt-1 text-xl font-black text-white sm:text-2xl">From {price}<span className="text-[10px] font-semibold text-white/60"> / month</span></p>}
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
