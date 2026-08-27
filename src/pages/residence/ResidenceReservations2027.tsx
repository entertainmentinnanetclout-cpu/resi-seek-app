import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, Search, Users } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ResidencePortalContext } from "./ResidenceLayout";

const STATUS_LABELS: Record<string, string> = {
  reserved: "Reserved",
  contacted: "Contacted",
  provisional_hold: "Provisional hold",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const ResidenceReservations2027 = () => {
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_residence_portal_reservations", {
      p_residence_id: residence.id,
      p_year: 2027,
    });
    if (error) toast.error(error.message || "Could not load 2027 reservations");
    setRows(data || []);
    setLoading(false);
  }, [residence?.id]);

  useEffect(() => {
    if (!residence?.id) return;
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [residence?.id, load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || String(row.applicant_name || "").toLowerCase().includes(q) || String(row.room_preference || "").toLowerCase().includes(q) || String(row.funding_type || "").toLowerCase().includes(q);
    return matchesSearch && (status === "all" || row.status === status);
  }), [rows, search, status]);

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.status !== "cancelled").length,
    reserved: rows.filter((r) => r.status === "reserved").length,
    contacted: rows.filter((r) => r.status === "contacted").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
  }), [rows]);

  const updateReservation = async (row: any, patch: { status?: string; residence_notes?: string }) => {
    setSavingId(row.id);
    const { error } = await (supabase as any).rpc("residence_portal_update_reservation", {
      p_reservation_id: row.id,
      p_status: patch.status ?? row.status,
      p_note: patch.residence_notes ?? row.residence_notes ?? null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message || "Could not update reservation");
    toast.success("Reservation updated");
    await load();
  };

  if (!residence) return <div className="py-20 text-center text-sm text-muted-foreground">Loading residence...</div>;

  return (
    <>
      <SEO noIndex title={`2027 Reservations | ${residence.name} | ResKonnect`} description={`Manage 2027 reservation demand for ${residence.name}.`} />
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-[#071326] p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><div className="inline-flex items-center gap-2 rounded-full bg-[#F5B32F] px-3 py-1 text-xs font-black text-[#071326]"><CalendarDays className="h-3.5 w-3.5" /> 2027 INTAKE</div><h1 className="mt-4 text-3xl font-black md:text-4xl">2027 Reservations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Manage reservation demand for {residence.name}. This workspace intentionally excludes student phone numbers, email addresses and ID numbers; contact remains controlled through ResKonnect.</p></div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active demand", counts.active, Users],
            ["New reservations", counts.reserved, CalendarDays],
            ["Contacted", counts.contacted, Clock3],
            ["Confirmed", counts.confirmed, CheckCircle2],
          ].map(([label, value, Icon]: any) => <Card key={label}><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div></div></CardContent></Card>)}
        </div>

        <Card>
          <CardHeader><CardTitle>Reservation pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applicant, funding or room preference" className="pl-9" /></div>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_LABELS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            </div>

            {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading reservations...</div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center"><CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-bold">No matching 2027 reservations</p><p className="mt-1 text-sm text-muted-foreground">New reservations will appear here automatically.</p></div> : <div className="space-y-3">{filtered.map((row) => <ReservationRow key={row.id} row={row} saving={savingId === row.id} onSave={updateReservation} />)}</div>}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

function ReservationRow({ row, saving, onSave }: { row: any; saving: boolean; onSave: (row: any, patch: any) => Promise<void> }) {
  const [note, setNote] = useState(row.residence_notes || "");
  return <div className="rounded-2xl border bg-card p-4 md:p-5"><div className="grid gap-4 lg:grid-cols-[1.2fr,.8fr,.8fr,1fr] lg:items-start">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black">{row.applicant_name || "Applicant"}</p><Badge variant="outline">{row.funding_type || "Funding undecided"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Reserved {row.created_at ? new Date(row.created_at).toLocaleDateString("en-ZA") : "—"}</p><p className="mt-2 text-sm"><span className="text-muted-foreground">Room preference:</span> {row.room_preference || "Not specified"}</p></div>
    <div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Status</p><Select value={row.status || "reserved"} onValueChange={(value) => void onSave(row,{status:value,residence_notes:note})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    <div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Last contacted</p><p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{row.last_contacted_at ? new Date(row.last_contacted_at).toLocaleDateString("en-ZA") : "Not yet"}</p></div>
    <div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Residence notes</p><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal follow-up note" className="min-h-[76px]" /><Button size="sm" className="mt-2 w-full" disabled={saving || note === (row.residence_notes || "")} onClick={() => void onSave(row,{residence_notes:note})}>{saving ? "Saving..." : "Save note"}</Button></div>
  </div></div>;
}

export default ResidenceReservations2027;
