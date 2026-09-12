import { useEffect, useMemo, useState } from "react";
import { Activity, BedDouble, Building2, CheckCircle2, CircleAlert, Gauge, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Mode = "reservations" | "applications";

type ActivityRow = {
  residence_id: string;
  residence_name?: string | null;
  status?: string | null;
  application_status?: string | null;
};

type ResidenceCapacity = {
  id: string;
  name: string;
  campus: string | null;
  capacity: number | null;
  available_spots: number | null;
};

type FillRow = ResidenceCapacity & {
  occupied: number | null;
  fillPct: number | null;
  remaining: number | null;
  activityCount: number;
  securedCount: number;
  activeCount: number;
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
  unknown: "Capacity needed",
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
  activityRows,
  selectedResidenceId = "all",
  onSelectResidence,
}: {
  mode: Mode;
  activityRows: ActivityRow[];
  selectedResidenceId?: string;
  onSelectResidence?: (residenceId: string) => void;
}) {
  const [residences, setResidences] = useState<ResidenceCapacity[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const db = supabase as any;

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await db
        .from("residences")
        .select("id,name,campus,capacity,available_spots")
        .eq("is_visible", true)
        .order("name");
      if (active) setResidences((data || []) as ResidenceCapacity[]);
    };
    void load();

    const channel = supabase
      .channel(`admin-fill-visual-${mode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "residences" }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [mode]);

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

    const known = residences.map((residence) => {
      const capacity = Number(residence.capacity || 0) || null;
      const availableRaw = residence.available_spots === null || residence.available_spots === undefined
        ? null
        : Number(residence.available_spots);
      const available = availableRaw === null || Number.isNaN(availableRaw) ? null : Math.max(0, availableRaw);
      const occupied = capacity && available !== null ? clamp(capacity - available, 0, capacity) : null;
      const fillPct = capacity && occupied !== null ? clamp((occupied / capacity) * 100) : null;
      const activity = activityByResidence.get(residence.id) || { total: 0, active: 0, secured: 0 };

      return {
        ...residence,
        capacity,
        available_spots: available,
        occupied,
        fillPct,
        remaining: available,
        activityCount: activity.total,
        activeCount: activity.active,
        securedCount: activity.secured,
        bucket: occupancyBucket(capacity, available),
      };
    });

    const knownIds = new Set(known.map((row) => row.id));
    for (const activity of activityRows) {
      if (!activity.residence_id || knownIds.has(activity.residence_id)) continue;
      const counts = activityByResidence.get(activity.residence_id) || { total: 0, active: 0, secured: 0 };
      known.push({
        id: activity.residence_id,
        name: activity.residence_name || "Residence",
        campus: null,
        capacity: null,
        available_spots: null,
        occupied: null,
        fillPct: null,
        remaining: null,
        activityCount: counts.total,
        activeCount: counts.active,
        securedCount: counts.secured,
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
  }, [activityRows, residences, mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTab = tab === "all" || row.bucket === tab || (tab === "attention" && ["full", "near_full"].includes(row.bucket));
      const matchesQuery = !q || `${row.name} ${row.campus || ""}`.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [rows, tab, query]);

  const totals = useMemo(() => {
    const measurable = rows.filter((row) => row.capacity !== null && row.remaining !== null);
    const capacity = measurable.reduce((sum, row) => sum + Number(row.capacity || 0), 0);
    const remaining = measurable.reduce((sum, row) => sum + Number(row.remaining || 0), 0);
    const occupied = Math.max(0, capacity - remaining);
    const nearFull = rows.filter((row) => row.bucket === "full" || row.bucket === "near_full").length;
    return {
      capacity,
      occupied,
      remaining,
      occupancy: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      nearFull,
      unknown: rows.filter((row) => row.bucket === "unknown").length,
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
                <h3 className="text-lg font-black">Residence fill command view</h3>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Scan occupancy before opening the detailed list. Fill percentage uses each residence&apos;s capacity and live available-spots fields; {activityLabel} are shown separately as demand signals so they are not double-counted as occupied beds.
              </p>
            </div>
            <div className="relative w-full xl:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a residence…" className="bg-background pl-9" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Metric icon={BedDouble} label="Total capacity" value={totals.capacity.toLocaleString("en-ZA")} />
            <Metric icon={CheckCircle2} label="Occupied" value={totals.occupied.toLocaleString("en-ZA")} />
            <Metric icon={Activity} label="Overall fill" value={`${totals.occupancy}%`} />
            <Metric icon={CircleAlert} label="Near / at full" value={String(totals.nearFull)} />
            <Metric icon={Building2} label="Capacity missing" value={String(totals.unknown)} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="p-4 sm:p-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="all">All {rows.length}</TabsTrigger>
            <TabsTrigger value="attention">Near full {rows.filter((r) => r.bucket === "full" || r.bucket === "near_full").length}</TabsTrigger>
            <TabsTrigger value="full">Full {rows.filter((r) => r.bucket === "full").length}</TabsTrigger>
            <TabsTrigger value="filling">Filling {rows.filter((r) => r.bucket === "filling").length}</TabsTrigger>
            <TabsTrigger value="available">Available {rows.filter((r) => r.bucket === "available").length}</TabsTrigger>
            <TabsTrigger value="unknown">Needs capacity {rows.filter((r) => r.bucket === "unknown").length}</TabsTrigger>
          </TabsList>

          {["all", "attention", "full", "filling", "available", "unknown"].map((value) => (
            <TabsContent key={value} value={value} className="mt-4">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No residences match this fill view.
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
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.campus || "Campus not set"}</p>
                            </div>
                            <Badge variant="outline" className={`shrink-0 ${bucketBadgeClass[row.bucket]}`}>{bucketLabel[row.bucket]}</Badge>
                          </div>

                          {row.fillPct === null ? (
                            <div className="mt-4 rounded-xl bg-muted/45 p-3">
                              <p className="text-xs font-bold">Capacity data required</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Set capacity and available spots to calculate the fill percentage.</p>
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 flex items-end justify-between gap-3">
                                <div><p className="text-3xl font-black tracking-tight">{Math.round(row.fillPct)}%</p><p className="text-[11px] text-muted-foreground">occupied</p></div>
                                <div className="text-right"><p className="text-sm font-black">{Number(row.remaining || 0).toLocaleString("en-ZA")} left</p><p className="text-[11px] text-muted-foreground">{Number(row.occupied || 0).toLocaleString("en-ZA")} / {Number(row.capacity || 0).toLocaleString("en-ZA")} beds</p></div>
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
