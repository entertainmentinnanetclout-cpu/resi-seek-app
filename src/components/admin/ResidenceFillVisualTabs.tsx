import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BedDouble, Building2, CheckCircle2, CircleAlert, Gauge, MailCheck, MessageCircle, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Mode = "reservations" | "applications";

type ActivityRow = {
  residence_id: string;
  residence_name?: string | null;
  status?: string | null;
  application_status?: string | null;
};

type AcademicInventory = {
  residence_id: string;
  capacity: number;
  reported_available_beds: number | null;
  blocked_beds: number;
  inventory_status: "planning" | "reported" | "verified" | "closed";
  residences?: { name?: string | null; campus?: string | null } | null;
};

type ResidenceOutreach = {
 residence_id: string;
 total_cases: number;
 emailed_cases: number;
 unemailed_cases: number;
 accepted_messages: number;
 unconfirmed_only_cases: number;
 failed_only_cases: number;
 whatsapp_marked_cases: number;
 whatsapp_opened_only_cases: number;
 emailed_whatsapp_pending: number;
 replied_cases: number;
 replies_needing_review: number;
 last_gmail_at: string | null;
 last_whatsapp_at: string | null;
 status_counts: Record<string,number>;
};

type OutreachFilter = "all" | "needs-email" | "contacted" | "completed" | "whatsapp-pending" | "replied" | "uncertain";

type FillRow = {
  id: string;
  name: string;
  campus: string | null;
  outreach: ResidenceOutreach | null;
  capacity: number | null;
  reportedAvailable: number | null;
  blocked: number;
  occupied: number | null;
  fillPct: number | null;
  activityCount: number;
  securedCount: number;
  activeCount: number;
  inventoryStatus: string;
  bucket: "full" | "near_full" | "filling" | "available" | "unknown";
};

const cancelledApplicationStatuses = new Set(["rejected", "withdrawn"]);
const securedApplicationStatuses = new Set(["approved", "conditionally_approved"]);
const cancelledReservationStatuses = new Set(["cancelled"]);
const securedReservationStatuses = new Set(["confirmed", "provisional_hold"]);

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const occupancyBucket = (capacity: number | null, available: number | null): FillRow["bucket"] => {
  if (!capacity || capacity <= 0 || available === null) return "unknown";
  const remaining = Math.max(0, available);
  const fillPct = clamp(((capacity - remaining) / capacity) * 100);
  if (remaining === 0 || fillPct >= 100) return "full";
  if (fillPct >= 85 || remaining <= 5) return "near_full";
  if (fillPct >= 50) return "filling";
  return "available";
};

const bucketLabel: Record<FillRow["bucket"], string> = {
  full: "Full",
  near_full: "Near full",
  filling: "Filling",
  available: "Space available",
  unknown: "Awaiting report",
};

const bucketBadgeClass: Record<FillRow["bucket"], string> = {
  full: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  near_full: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  filling: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  available: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  unknown: "border-muted-foreground/25 bg-muted text-muted-foreground",
};

export default function ResidenceFillVisualTabs({
  mode,
  academicYear,
  activityRows,
  selectedResidenceId = "all",
  onSelectResidence,
}: {
  mode: Mode;
  academicYear: number;
  activityRows: ActivityRow[];
  selectedResidenceId?: string;
  onSelectResidence?: (residenceId: string) => void;
}) {
  const [inventory, setInventory] = useState<AcademicInventory[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [outreachFilter,setOutreachFilter] = useState<OutreachFilter>("all");
  const [outreach,setOutreach] = useState<ResidenceOutreach[]>([]);
  const [outreachLoading,setOutreachLoading] = useState(true);
  const [outreachError,setOutreachError] = useState("");
  const [outreachVerified,setOutreachVerified] = useState(false);
  const requestRef=useRef(0);
  const db = supabase as any;

  const loadOutreach=useCallback(async()=>{
   const request=++requestRef.current;
   setOutreachLoading(true);
   try{
    const {data,error}=await supabase.functions.invoke("reskonnect-email-dock",{
     body:{action:"residence_outreach_summary",
      kind:mode==="reservations"?"reservation":"application",academic_year:academicYear}
    });
    if(error||data?.verified!==true||!Array.isArray(data?.items))
     throw new Error(data?.error||error?.message||"Unable to verify residence communication audit");
    if(request!==requestRef.current)return;
    setOutreach(data.items as ResidenceOutreach[]);
    setOutreachVerified(true);setOutreachError("");
   }catch(e){
    if(request!==requestRef.current)return;
    setOutreachVerified(false);
    setOutreach([]);
    setOutreachError(e instanceof Error?e.message:"Communications data temporarily unavailable");
   }finally{if(request===requestRef.current)setOutreachLoading(false);}
  },[academicYear,mode]);
  useEffect(()=>{
   void loadOutreach();
   const refresh=()=>{if(document.visibilityState==="visible")void loadOutreach();};
   window.addEventListener("focus",refresh);
   const interval=window.setInterval(refresh,60_000);
   return ()=>{requestRef.current++;window.removeEventListener("focus",refresh);window.clearInterval(interval);};
  },[loadOutreach]);

  const outreachByResidence=useMemo(
   ()=>new Map<string,ResidenceOutreach>(outreach.map(x=>[x.residence_id,x])),[outreach]);
  const outreachTotals=useMemo(()=>outreach.reduce((a,r)=>({
   cases:a.cases+r.total_cases,emailed:a.emailed+r.emailed_cases,
   unemailed:a.unemailed+r.unemailed_cases,
   sent:a.sent+r.accepted_messages,
   whatsappPending:a.whatsappPending+r.emailed_whatsapp_pending,
   replies:a.replies+r.replied_cases
  }),{cases:0,emailed:0,unemailed:0,sent:0,whatsappPending:0,replies:0}),[outreach]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await db
        .from("residence_academic_inventory")
        .select("residence_id,capacity,reported_available_beds,blocked_beds,inventory_status,residences(name,campus)")
        .eq("academic_year", academicYear)
        .order("residence_id");
      if (active) setInventory((data || []) as AcademicInventory[]);
    };
    void load();

    const channel = supabase
      .channel(`admin-fill-visual-${mode}-${academicYear}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "residence_academic_inventory", filter: `academic_year=eq.${academicYear}` }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [academicYear, mode]);

  const rows = useMemo<FillRow[]>(() => {
    const activityByResidence = new Map<string, { total: number; active: number; secured: number }>();

    for (const row of activityRows) {
      if (!row.residence_id) continue;
      const status = String(row.application_status || row.status || "").toLowerCase();
      const current = activityByResidence.get(row.residence_id) || { total: 0, active: 0, secured: 0 };
      current.total += 1;

      const cancelled = mode === "applications"
        ? cancelledApplicationStatuses.has(status)
        : cancelledReservationStatuses.has(status);
      const secured = mode === "applications"
        ? securedApplicationStatuses.has(status)
        : securedReservationStatuses.has(status);

      if (!cancelled) current.active += 1;
      if (secured) current.secured += 1;
      activityByResidence.set(row.residence_id, current);
    }

    const known = inventory.map((entry) => {
      const capacity = Number(entry.capacity || 0) || null;
      const availableRaw = entry.reported_available_beds === null || entry.reported_available_beds === undefined
        ? null
        : Number(entry.reported_available_beds);
      const available = availableRaw === null || Number.isNaN(availableRaw) ? null : Math.max(0, availableRaw);
      const blocked = Math.max(0, Number(entry.blocked_beds || 0));
      const occupied = capacity && available !== null ? clamp(capacity - available - blocked, 0, capacity) : null;
      const fillPct = capacity && occupied !== null ? clamp((occupied / capacity) * 100) : null;
      const activity = activityByResidence.get(entry.residence_id) || { total: 0, active: 0, secured: 0 };

      return {
        id: entry.residence_id,
        name: entry.residences?.name || "Residence",
        campus: entry.residences?.campus || null,
        outreach:outreachByResidence.get(entry.residence_id)||null,
        capacity,
        reportedAvailable: available,
        blocked,
        occupied,
        fillPct,
        activityCount: activity.total,
        activeCount: activity.active,
        securedCount: activity.secured,
        inventoryStatus: entry.inventory_status,
        bucket: occupancyBucket(capacity, available),
      } satisfies FillRow;
    });

    const knownIds = new Set(known.map((row) => row.id));
    for (const activity of activityRows) {
      if (!activity.residence_id || knownIds.has(activity.residence_id)) continue;
      const counts = activityByResidence.get(activity.residence_id) || { total: 0, active: 0, secured: 0 };
      known.push({
        id: activity.residence_id,
        name: activity.residence_name || "Residence",
        campus: null,
        outreach:outreachByResidence.get(activity.residence_id)||null,
        capacity: null,
        reportedAvailable: null,
        blocked: 0,
        occupied: null,
        fillPct: null,
        activityCount: counts.total,
        activeCount: counts.active,
        securedCount: counts.secured,
        inventoryStatus: "planning",
        bucket: "unknown",
      });
      knownIds.add(activity.residence_id);
    }

    return known.sort((a, b) => {
      if (a.fillPct === null && b.fillPct !== null) return 1;
      if (a.fillPct !== null && b.fillPct === null) return -1;
      return Number(b.fillPct || 0) - Number(a.fillPct || 0)
        || b.activeCount - a.activeCount
        || a.name.localeCompare(b.name);
    });
  }, [activityRows, inventory, mode, outreachByResidence]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTab = tab === "all" || row.bucket === tab || (tab === "attention" && ["full", "near_full"].includes(row.bucket));
      const matchesQuery = !q || `${row.name} ${row.campus || ""}`.toLowerCase().includes(q);
      const v=row.outreach;
      // Unknown audit state is not treated as "zero emails sent".
      const matchesOutreach=outreachFilter==="all"||
       (outreachVerified&&(
        (outreachFilter==="needs-email"&&!!v&&v.unemailed_cases>0)||
        (outreachFilter==="contacted"&&!!v&&v.emailed_cases>0)||
        (outreachFilter==="completed"&&!!v&&v.total_cases>0&&v.unemailed_cases===0)||
        (outreachFilter==="whatsapp-pending"&&!!v&&v.emailed_whatsapp_pending>0)||
        (outreachFilter==="replied"&&!!v&&v.replied_cases>0)||
        (outreachFilter==="uncertain"&&!!v&&v.unconfirmed_only_cases>0)
       ));
      return matchesTab && matchesQuery && matchesOutreach;
    });
  }, [rows, tab, query, outreachFilter, outreachVerified]);

  const totals = useMemo(() => {
    const measurable = rows.filter((row) => row.capacity !== null && row.reportedAvailable !== null);
    const capacity = measurable.reduce((sum, row) => sum + Number(row.capacity || 0), 0);
    const available = measurable.reduce((sum, row) => sum + Number(row.reportedAvailable || 0), 0);
    const blocked = measurable.reduce((sum, row) => sum + Number(row.blocked || 0), 0);
    const occupied = Math.max(0, capacity - available - blocked);
    const nearFull = rows.filter((row) => row.bucket === "full" || row.bucket === "near_full").length;
    return {
      capacity,
      occupied,
      available,
      blocked,
      occupancy: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      nearFull,
      unknown: rows.filter((row) => row.bucket === "unknown").length,
      reporting: measurable.length,
    };
  }, [rows]);

  const activityLabel = mode === "applications" ? "applications" : "reservations";
  const securedLabel = mode === "applications" ? "approved" : "confirmed / held";

  return (
    <Card className="overflow-hidden border-primary/15">
      <CardContent className="p-0">
        <div className="border-b bg-gradient-to-r from-primary/[0.08] via-background to-background p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-black">{academicYear} residence fill command view</h3>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Occupancy uses only the {academicYear} academic inventory ledger. {activityLabel} are demand signals and are not double-counted as occupied beds. A different year can never change this view.
              </p>
            </div>
            <div className="relative w-full xl:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a residence…" className="bg-background pl-9" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Metric icon={BedDouble} label="Reported capacity" value={totals.capacity.toLocaleString("en-ZA")} />
            <Metric icon={CheckCircle2} label="Reported occupied" value={totals.occupied.toLocaleString("en-ZA")} />
            <Metric icon={Activity} label="Reported fill" value={`${totals.occupancy}%`} />
            <Metric icon={BedDouble} label="Reported open" value={totals.available.toLocaleString("en-ZA")} />
            <Metric icon={CircleAlert} label="Near / at full" value={String(totals.nearFull)} />
            <Metric icon={Building2} label="Awaiting report" value={String(totals.unknown)} />
          </div>

          <section className="mt-4 space-y-3 border-t border-primary/10 pt-4" aria-label="Verified residence email and WhatsApp progress">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-black"><MailCheck className="h-4 w-4 text-primary"/>Communication progress</p>
                <p className="text-[11px] text-muted-foreground">Verified case-level Gmail audit. Sent means accepted by Gmail, not delivered or read.</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={outreachLoading} onClick={()=>void loadOutreach()}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${outreachLoading?"animate-spin":""}`}/>Refresh tracking
              </Button>
            </div>
            {outreachError&&<div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700">
              Communication audit unavailable: {outreachError}. No unsent counts are inferred while the audit is unavailable.
            </div>}
            {outreachLoading&&!outreachVerified&&!outreachError&&
              <p className="text-xs text-muted-foreground" role="status">Reconciling residence communication evidence…</p>}
            {outreachVerified&&<>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Metric icon={Building2} label="Cases tracked" value={outreachTotals.cases.toLocaleString("en-ZA")}/>
                <Metric icon={MailCheck} label="Cases emailed" value={outreachTotals.emailed.toLocaleString("en-ZA")}/>
                <Metric icon={CircleAlert} label="Still to email" value={outreachTotals.unemailed.toLocaleString("en-ZA")}/>
                <Metric icon={Activity} label="Gmail accepted" value={outreachTotals.sent.toLocaleString("en-ZA")}/>
                <Metric icon={MessageCircle} label="Emailed, WA pending" value={outreachTotals.whatsappPending.toLocaleString("en-ZA")}/>
                <Metric icon={CheckCircle2} label="Replies captured" value={outreachTotals.replies.toLocaleString("en-ZA")}/>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold">Show residences:</span>
                <Select value={outreachFilter} onValueChange={v=>setOutreachFilter(v as OutreachFilter)}>
                  <SelectTrigger className="h-9 w-[min(100%,285px)] bg-background" aria-label="Filter residences by verified communication status"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All residences</SelectItem>
                    <SelectItem value="needs-email">Email action needed</SelectItem>
                    <SelectItem value="contacted">At least one case emailed</SelectItem>
                    <SelectItem value="completed">Every case emailed</SelectItem>
                    <SelectItem value="whatsapp-pending">Emailed, WhatsApp not marked</SelectItem>
                    <SelectItem value="replied">Gmail response captured</SelectItem>
                    <SelectItem value="uncertain">Unconfirmed Gmail attempt</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Updated automatically while open. Select a residence card to filter its records.</p>
              </div>
            </>}
          </section>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="p-4 sm:p-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="all">All {rows.length}</TabsTrigger>
            <TabsTrigger value="attention">Near full {rows.filter((r) => r.bucket === "full" || r.bucket === "near_full").length}</TabsTrigger>
            <TabsTrigger value="full">Full {rows.filter((r) => r.bucket === "full").length}</TabsTrigger>
            <TabsTrigger value="filling">Filling {rows.filter((r) => r.bucket === "filling").length}</TabsTrigger>
            <TabsTrigger value="available">Available {rows.filter((r) => r.bucket === "available").length}</TabsTrigger>
            <TabsTrigger value="unknown">Awaiting report {rows.filter((r) => r.bucket === "unknown").length}</TabsTrigger>
          </TabsList>

          {["all", "attention", "full", "filling", "available", "unknown"].map((value) => (
            <TabsContent key={value} value={value} className="mt-4">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No residences match this {academicYear} fill view.
                </div>
              ) : (
                <div className="max-h-[680px] overflow-y-auto pr-1">
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {filtered.map((row) => {
                      const selected = selectedResidenceId === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => onSelectResidence?.(selected ? "all" : row.id)}
                          className={`rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:shadow-sm ${selected ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20" : "bg-card"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-black">{row.name}</p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.campus || "Campus not set"} · {row.inventoryStatus}</p>
                            </div>
                            <Badge variant="outline" className={`shrink-0 ${bucketBadgeClass[row.bucket]}`}>{bucketLabel[row.bucket]}</Badge>
                          </div>

                          {row.fillPct === null ? (
                            <div className="mt-4 rounded-xl bg-muted/45 p-3">
                              <p className="text-xs font-bold">{academicYear} availability not reported</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Capacity may be planned, but occupancy stays unknown until this academic year&apos;s open beds are explicitly reported.</p>
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 flex items-end justify-between gap-3">
                                <div><p className="text-3xl font-black tracking-tight">{Math.round(row.fillPct)}%</p><p className="text-[11px] text-muted-foreground">reported occupied</p></div>
                                <div className="text-right"><p className="text-sm font-black">{Number(row.reportedAvailable || 0).toLocaleString("en-ZA")} open</p><p className="text-[11px] text-muted-foreground">{Number(row.occupied || 0).toLocaleString("en-ZA")} / {Number(row.capacity || 0).toLocaleString("en-ZA")} beds{row.blocked ? ` · ${row.blocked} blocked` : ""}</p></div>
                              </div>
                              <Progress value={row.fillPct} className="mt-3 h-2.5" />
                            </>
                          )}

                          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                            <TinyStat label={activityLabel} value={row.activityCount} />
                            <TinyStat label="active" value={row.activeCount} />
                            <TinyStat label={securedLabel} value={row.securedCount} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {selectedResidenceId !== "all" && onSelectResidence && (
          <div className="border-t bg-muted/25 px-4 py-3 text-xs text-muted-foreground sm:px-5">
            Detailed list filtered to the selected residence. <button className="font-bold text-primary hover:underline" onClick={() => onSelectResidence("all")}>Show all records</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <div className="rounded-2xl border bg-background/85 p-3"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-wide">{label}</p></div><p className="mt-2 text-xl font-black">{value}</p></div>;
}

function TinyStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0"><p className="text-sm font-black">{value}</p><p className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}
