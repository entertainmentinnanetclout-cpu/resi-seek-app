import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Sheet, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateResidenceCampusPolicy } from "@/lib/residenceCampusPolicy";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1x18MYICyLHL_1YvgpquZ4rbrdGovUmuWxjy45cHY1Ek/edit";
const FEED_URL = "https://www.reskonnect.org/api/meta-residence-feed?format=csv";

type Props = {
  residences: any[];
  onEdit: (residence: any) => void;
  onRefresh: () => void;
  loading?: boolean;
};

export default function AdminMetaResidenceFeed({ residences, onEdit, onRefresh, loading = false }: Props) {
  const [search, setSearch] = useState("");
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [feedError, setFeedError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/meta-residence-feed?format=json")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Feed unavailable");
        if (active) {
          setLiveCount(Number(data?.row_count || 0));
          setFeedError("");
        }
      })
      .catch((error) => active && setFeedError(error?.message || "Feed unavailable"));
    return () => { active = false; };
  }, [residences.length]);

  const audited = useMemo(() => residences.map((row) => ({ row, policy: validateResidenceCampusPolicy(row) })), [residences]);
  const violations = audited.filter((item) => !item.policy.valid);
  const clean = audited.length - violations.length;
  const tosha = audited.filter((item) => item.policy.toshaException).length;
  const visible = audited.filter(({ row, policy }) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.name, row.campus, row.province, row.address, ...policy.violations].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return <div className="space-y-5">
    <section className="rounded-[28px] border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full"><Sheet className="mr-1 h-3.5 w-3.5"/>Meta Residence Feed</Badge>
            <Badge variant="outline" className="rounded-full">Supabase is source of truth</Badge>
          </div>
          <h3 className="mt-3 text-2xl font-black">Manage what the WhatsApp agent is allowed to say about accommodation.</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The Google Sheet is a read-only projection. Edit residence records here in AdminOS and the live feed updates automatically. Multiple campus accreditations are allowed only inside the residence province.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}/>Refresh</Button>
          <Button variant="outline" asChild><a href={SHEET_URL} target="_blank" rel="noreferrer"><Sheet className="mr-2 h-4 w-4"/>Open Google Sheet</a></Button>
          <Button asChild><a href={FEED_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Open live CSV</a></Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Live feed rows" value={liveCount ?? "—"} good={!feedError}/>
        <Metric label="Policy clean" value={clean} good={violations.length === 0}/>
        <Metric label="Needs correction" value={violations.length} good={violations.length === 0}/>
        <Metric label="TOSHA exceptions" value={tosha} good/>
      </div>
      {feedError && <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">Live feed check: {feedError}</div>}
    </section>

    <section className="rounded-[28px] border bg-background shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="font-black">Campus accreditation audit</h4>
            <p className="text-xs text-muted-foreground">Pretoria/Gauteng cannot serve Polokwane/Limpopo. Pretoria West may serve Soshanguve only for Ekhaya Junction or an explicit TOSHA-tagged residence.</p>
          </div>
          <Input className="w-full lg:w-80" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search residence, campus or province"/>
        </div>
      </div>
      <div className="divide-y">
        {visible.slice(0, 250).map(({ row, policy }) => <div key={row.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">{row.name}</p>
              {policy.valid ? <Badge className="rounded-full bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3"/>Policy clean</Badge> : <Badge variant="destructive" className="rounded-full"><AlertTriangle className="mr-1 h-3 w-3"/>Needs correction</Badge>}
              {policy.toshaException && <Badge variant="outline" className="rounded-full">TOSHA</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.province || "Province missing"} · {row.campus || "No served campuses"}</p>
            {!policy.valid && <div className="mt-2 space-y-1">{policy.violations.map((v) => <p key={v} className="text-xs font-medium text-destructive">{v}</p>)}</div>}
          </div>
          <Button size="sm" variant="outline" onClick={() => onEdit(row)}>Edit source record</Button>
        </div>)}
      </div>
    </section>
  </div>;
}

function Metric({ label, value, good }: { label: string; value: string | number; good: boolean }) {
  return <div className="rounded-2xl border p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {good ? <ShieldCheck className="h-4 w-4 text-emerald-600"/> : <AlertTriangle className="h-4 w-4 text-amber-600"/>}
    </div>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>;
}
