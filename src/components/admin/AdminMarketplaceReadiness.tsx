import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type QualityRow = {
  residence_id: string;
  has_photo_reference: boolean;
  has_verified_private_price: boolean;
  has_verified_location: boolean;
  has_configured_room_rate: boolean;
  has_basic_listing_details: boolean;
  marketplace_review_ready: boolean;
  readiness_score: number;
  readiness_gaps: string[];
};
type ResidenceName = { id: string; name: string; city?: string | null; campus?: string | null };
const descriptions: Record<string, string> = {
  photo_reference: "Property photographs needed",
  verified_private_price: "Monthly price not verified",
  verified_location: "Exact map location not verified",
  configured_room_rate: "Room-type prices/capacity not configured",
  basic_listing_details: "Property description or location incomplete",
};

export default function AdminMarketplaceReadiness({ residences }: { residences: ResidenceName[] }) {
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: issue } = await (supabase as any)
        .from("reskonnect_marketplace_readiness_v")
        .select("residence_id,has_photo_reference,has_verified_private_price,has_verified_location,has_configured_room_rate,has_basic_listing_details,marketplace_review_ready,readiness_score,readiness_gaps")
        .order("readiness_score", { ascending: false })
        .limit(1000);
      if (issue) throw issue;
      setRows(data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Readiness data unavailable");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const names = useMemo(() => new Map(residences.map((r) => [r.id, r])), [residences]);
  const filtered = useMemo(() => rows
    .filter((row) => {
      const property = names.get(row.residence_id);
      return !search || [property?.name, property?.city, property?.campus].some((value) =>
        String(value || "").toLowerCase().includes(search.toLowerCase()));
    }).sort((a, b) => a.readiness_score - b.readiness_score), [rows, names, search]);
  const count = (key: keyof QualityRow) => rows.filter((row) => Boolean(row[key])).length;
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Marketplace listing readiness</CardTitle>
      <p className="text-sm text-muted-foreground">Evidence-completeness audit for visible properties. A readiness score does not mean ResKonnect has accredited, inspected or guaranteed a property.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input aria-label="Find a property in the quality audit" placeholder="Search property or city" className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)}/>
        <Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh readiness</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["Visible records", rows.length],
          ["Photo references", count("has_photo_reference")],
          ["Verified prices", count("has_verified_private_price")],
          ["Verified locations", count("has_verified_location")],
          ["Review-ready", count("marketplace_review_ready")],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-muted/30 p-3"><p className="text-lg font-black">{loading ? "…" : value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto">
        {filtered.slice(0, 100).map((row) => <div className="rounded-xl border p-3" key={row.residence_id}>
          <div className="flex items-start justify-between gap-2"><div>
            <p className="font-semibold">{names.get(row.residence_id)?.name || "Residence"}</p>
            <p className="text-xs text-muted-foreground">{names.get(row.residence_id)?.city || names.get(row.residence_id)?.campus || "Area unconfirmed"}</p>
          </div><strong className="shrink-0 text-sm">{row.readiness_score}/100</strong></div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {row.marketplace_review_ready ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/>Evidence complete — review still required</span> :
              (row.readiness_gaps || []).map((gap) => <span key={gap} className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5"/>{descriptions[gap] || gap}</span>)}
          </div>
        </div>)}
        {!loading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching published properties.</p>}
        {filtered.length > 100 && <p className="text-xs text-muted-foreground">Showing 100 lowest-readiness matching properties. Refine search to see more.</p>}
      </div>
    </CardContent>
  </Card>;
}
