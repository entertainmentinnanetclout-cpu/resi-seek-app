import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Rotate3D } from "lucide-react";
import { publicTourForResidence } from "@/lib/virtualTours/api";
import { cn } from "@/lib/utils";

type Props = {
  residenceId?: string | null;
  residenceName?: string | null;
  className?: string;
  compact?: boolean;
};

const cache = new Map<string, any>();
const pending = new Map<string, Promise<any>>();

async function load(residenceId: string) {
  if (cache.has(residenceId)) return cache.get(residenceId);
  if (!pending.has(residenceId)) {
    pending.set(residenceId, publicTourForResidence(residenceId).then((value) => {
      cache.set(residenceId, value || null);
      pending.delete(residenceId);
      return value || null;
    }).catch(() => {
      cache.set(residenceId, null);
      pending.delete(residenceId);
      return null;
    }));
  }
  return pending.get(residenceId)!;
}

export default function VirtualTourMarketBadge({ residenceId, residenceName, className, compact = false }: Props) {
  const [publication, setPublication] = useState<any>(() => residenceId ? cache.get(residenceId) : null);

  useEffect(() => {
    let active = true;
    if (!residenceId) return;
    void load(residenceId).then((value) => { if (active) setPublication(value); });
    return () => { active = false; };
  }, [residenceId]);

  if (!publication?.public_token) return null;

  return <Link
    to={`/tour/${publication.public_token}`}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
    aria-label={`Open ${residenceName || "residence"} 4K Gold 360 virtual tour`}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-[#F5B32F]/50 bg-[#071326]/94 font-black text-white shadow-xl backdrop-blur transition hover:scale-[1.02] hover:border-[#F5B32F]",
      compact ? "px-2.5 py-1 text-[9px] uppercase tracking-[.12em]" : "px-3 py-1.5 text-[10px] uppercase tracking-[.14em]",
      className,
    )}
  >
    <Crown className="h-3.5 w-3.5 text-[#F5B32F]" />
    <Rotate3D className="h-3.5 w-3.5 text-cyan-300" />
    Gold 360
  </Link>;
}
