import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, RefreshCw, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type InventoryRow = {
  id: string;
  residence_id: string;
  academic_year: number;
  capacity: number;
  reported_available_beds: number | null;
  blocked_beds: number;
  inventory_status: "planning" | "reported" | "verified" | "closed";
  notes: string | null;
  verified_at: string | null;
  updated_at: string;
  residences?: { name?: string | null; campus?: string | null } | null;
};

type Draft = {
  capacity: string;
  available: string;
  blocked: string;
  status: InventoryRow["inventory_status"];
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);

const AcademicInventoryManager = () => {
  const { user } = useAuth();
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const db = supabase as any;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("residence_academic_inventory")
      .select("*, residences(name,campus)")
      .eq("academic_year", academicYear)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message || "Could not load academic inventory");
      setRows([]);
      setLoading(false);
      return;
    }
    const next = (data || []) as InventoryRow[];
    setRows(next);
    setDrafts(Object.fromEntries(next.map((row) => [row.id, {
      capacity: String(row.capacity ?? 0),
      available: row.reported_available_beds === null ? "" : String(row.reported_available_beds),
      blocked: String(row.blocked_beds ?? 0),
      status: row.inventory_status,
    }])));
    setLoading(false);
  }, [academicYear]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel(`academic-inventory-${academicYear}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "residence_academic_inventory", filter: `academic_year=eq.${academicYear}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [academicYear, load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.residences?.name || ""} ${row.residences?.campus || ""}`.toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }), [rows, query]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.capacity += Number(row.capacity || 0);
    if (row.reported_available_beds !== null) {
      acc.reported += 1;
      acc.available += Number(row.reported_available_beds || 0);
      acc.occupied += Math.max(0, Number(row.capacity || 0) - Number(row.reported_available_beds || 0) - Number(row.blocked_beds || 0));
    }
    if (row.inventory_status === "verified") acc.verified += 1;
    return acc;
  }, { capacity: 0, available: 0, occupied: 0, reported: 0, verified: 0 }), [rows]);

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((current) => ({
    ...current,
    [id]: { ...current[id], ...patch },
  }));

  const save = async (row: InventoryRow) => {
    const draft = drafts[row.id];
    if (!draft) return;
    const capacity = Math.max(0, Number(draft.capacity || 0));
    const blocked = Math.max(0, Number(draft.blocked || 0));
    const available = draft.available.trim() === "" ? null : Math.max(0, Number(draft.available));
    if (available !== null && available + blocked > capacity) {
      toast.error("Open beds + blocked beds cannot exceed year capacity.");
      return;
    }
    setSavingId(row.id);
    const payload: any = {
      capacity,
      reported_available_beds: available,
      blocked_beds: blocked,
      inventory_status: draft.status,
      updated_at: new Date().toISOString(),
    };
    if (draft.status === "verified") {
      payload.verified_at = new Date().toISOString();
      payload.verified_by = user?.id || null;
    } else {
      payload.verified_at = null;
      payload.verified_by = null;
    }
    const { error } = await db.from("residence_academic_inventory").update(payload).eq("id", row.id);
    setSavingId(null);
    if (error) return toast.error(error.message || "Could not save academic inventory");
    toast.success(`${academicYear} inventory saved for ${row.residences?.name || "residence"}`);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-black">Academic Inventory</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Capacity and occupancy are isolated by academic year. A 2027 open-bed figure never changes 2026 occupancy. Blank availability means the residence has not reported that year yet.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(academicYear)} onValueChange={(value) => setAcademicYear(Number(value))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Year capacity", totals.capacity],
          ["Reported open", totals.available],
          ["Reported occupied", totals.occupied],
          ["Residences reporting", `${totals.reported}/${rows.length}`],
          ["Verified inventories", totals.verified],
        ].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{typeof value === "number" ? value.toLocaleString("en-ZA") : value}</p></CardContent></Card>)}
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search residence or campus…" />
      </div>

      {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading {academicYear} inventory…</CardContent></Card> :
        filtered.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No inventory records for this year.</CardContent></Card> :
        <div className="space-y-3">
          {filtered.map((row) => {
            const draft = drafts[row.id];
            if (!draft) return null;
            const available = draft.available.trim() === "" ? null : Number(draft.available || 0);
            const occupied = available === null ? null : Math.max(0, Number(draft.capacity || 0) - available - Number(draft.blocked || 0));
            return <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{row.residences?.name || "Residence"}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{row.residences?.campus || "Campus not set"} · Academic year {academicYear}</p>
                  </div>
                  <Badge variant={draft.status === "verified" ? "default" : "outline"}>{draft.status.toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-6">
                  <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Capacity</p><Input type="number" min="0" value={draft.capacity} onChange={(e) => setDraft(row.id, { capacity: e.target.value })} /></div>
                  <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Reported open</p><Input type="number" min="0" placeholder="Unknown" value={draft.available} onChange={(e) => setDraft(row.id, { available: e.target.value })} /></div>
                  <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Blocked beds</p><Input type="number" min="0" value={draft.blocked} onChange={(e) => setDraft(row.id, { blocked: e.target.value })} /></div>
                  <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Derived occupied</p><div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 font-bold">{occupied === null ? "Unknown" : occupied.toLocaleString("en-ZA")}</div></div>
                  <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Reporting state</p><Select value={draft.status} onValueChange={(value) => setDraft(row.id, { status: value as Draft["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planning">Planning</SelectItem><SelectItem value="reported">Reported</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div>
                  <div className="flex items-end"><Button className="w-full" onClick={() => void save(row)} disabled={savingId === row.id}>{draft.status === "verified" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{savingId === row.id ? "Saving…" : "Save"}</Button></div>
                </div>
              </CardContent>
            </Card>;
          })}
        </div>}
    </div>
  );
};

export default AcademicInventoryManager;
