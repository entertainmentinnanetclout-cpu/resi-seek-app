import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, ImageIcon, MapPin, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Evidence = {
  residence_id: string;
  readiness_score: number;
  marketplace_review_ready: boolean;
  has_photo_reference: boolean;
  has_verified_private_price: boolean;
  has_verified_location: boolean;
  has_configured_room_rate: boolean;
  has_basic_listing_details: boolean;
  readiness_gaps: string[];
};
type Draft = { status: string; reviewer_note: string | null; updated_at: string | null };
type Room = { id: string; academic_year: number; is_active: boolean; capacity: number; available_beds: number; private_price: number | null; nsfas_price: number | null };

const gapLabel: Record<string,string> = {
  photo_reference: "Real property photographs missing",
  verified_private_price: "Platform price verification outstanding",
  verified_location: "Property entrance/location verification outstanding",
  configured_room_rate: "Current academic-year room rates or capacity missing",
  basic_listing_details: "Public description or location information incomplete",
};

const actionLinks = [
  { to: "/residence/listing/wizard", title: "Complete guided listing", detail: "Photos, property details and submission", icon: ImageIcon },
  { to: "/residence/inventory", title: "Confirm room inventory", detail: "2027 capacity, fees and actual rates", icon: WalletCards },
  { to: "/residence/compliance", title: "Prepare compliance evidence", detail: "Authority review stays separate", icon: ShieldCheck },
  { to: "/residence/virtual-tour", title: "Prepare property media", detail: "Tours require real published evidence", icon: MapPin },
];

export default function ResidenceSupplyReadiness({ residenceId }: { residenceId: string }) {
  const [quality, setQuality] = useState<Evidence | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!residenceId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Live listing checks need a network connection. Existing session and drafts remain unchanged.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const db = supabase as any;
      const [evidence, studio, inventory] = await Promise.all([
        db.from("reskonnect_marketplace_readiness_v")
          .select("residence_id,readiness_score,marketplace_review_ready,has_photo_reference,has_verified_private_price,has_verified_location,has_configured_room_rate,has_basic_listing_details,readiness_gaps")
          .eq("residence_id", residenceId).maybeSingle(),
        db.from("reskonnect_listing_studio_drafts")
          .select("status,reviewer_note,updated_at").eq("residence_id", residenceId).maybeSingle(),
        db.from("residence_room_types")
          .select("id,academic_year,is_active,capacity,available_beds,private_price,nsfas_price")
          .eq("residence_id", residenceId).eq("academic_year", 2027).eq("is_active", true).limit(200),
      ]);
      if (evidence.error) throw evidence.error;
      if (studio.error) throw studio.error;
      if (inventory.error) throw inventory.error;
      setQuality((evidence.data || null) as Evidence | null);
      setDraft((studio.data || null) as Draft | null);
      setRooms((inventory.data || []) as Room[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live evidence is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [residenceId]);
  useEffect(() => {
    // Run nonessential readiness checks after the time-critical login/role flow.
    const timer = window.setTimeout(() => { void load(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const roomStats = useMemo(() => ({
    configured: rooms.filter(r => Number(r.capacity) > 0 && Number(r.available_beds) >= 0 && Number(r.available_beds) <= Number(r.capacity)
      && (Number(r.private_price) > 0 || Number(r.nsfas_price) > 0)).length,
    beds: rooms.reduce((sum, r) => sum + Math.max(0, Number(r.available_beds) || 0), 0),
  }), [rooms]);
  const stateLabel = draft?.status === "submitted" ? "Awaiting staff review"
    : draft?.status === "changes_requested" ? "Corrections requested"
    : draft?.status === "approved" ? "Listing updates approved"
    : draft ? "Draft in progress" : "Listing not submitted";

  return <Card className="border-primary/25">
    <CardHeader className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary"/>Property operating readiness</CardTitle>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4"/>Refresh evidence
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Follow the work from draft to moderated publication. Quality checks are evidence signals, not official accreditation or confirmed room allocations.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 p-3 text-sm text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/><span>Readiness could not be refreshed: {error}. No changes were made to your listing.</span>
      </div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Guided listing</p>
          <p className="mt-1 font-bold">{loading ? "Checking…" : stateLabel}</p>
          {draft?.reviewer_note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{draft.reviewer_note}</p>}
        </div>
        <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">2027 room types</p>
          <p className="mt-1 font-bold">{loading ? "Checking…" : `${roomStats.configured} configured`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{roomStats.beds} landlord-reported beds; not confirmed allocations</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Published listing evidence</p>
          <p className="mt-1 font-bold">{loading ? "Checking…" : quality ? `${quality.readiness_score}/100` : "Not yet published / unavailable"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Review readiness is not approval or accreditation</p>
        </div>
      </div>
      {!!quality?.marketplace_review_ready && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600"/>The required listing evidence is recorded. Independent review is still required.
      </div>}
      {!!quality?.readiness_gaps?.length && <div className="space-y-2">
        <p className="text-sm font-semibold">Items for follow-up</p>
        <div className="flex flex-wrap gap-2">
          {quality.readiness_gaps.map(gap => <Badge key={gap} variant="outline" className="whitespace-normal">{gapLabel[gap] || gap}</Badge>)}
        </div>
      </div>}
      <div className="grid gap-2 md:grid-cols-2">
        {actionLinks.map(item => <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50">
          <item.icon className="h-5 w-5 shrink-0 text-primary"/><span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{item.title}</span>
            <span className="block text-xs text-muted-foreground">{item.detail}</span>
          </span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
        </Link>)}
      </div>
    </CardContent>
  </Card>;
}
