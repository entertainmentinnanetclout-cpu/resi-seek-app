import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, MessageCircle, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Reservation = {
  id: string;
  user_id: string;
  residence_id: string;
  academic_year: number;
  funding_type: string;
  room_preference: string | null;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  source: string;
  last_contacted_at: string | null;
  created_at: string;
  residence_name: string | null;
  residence_address: string | null;
  residence_campus: string | null;
  student_name: string | null;
  student_number: string | null;
  student_email: string | null;
  student_phone: string | null;
};

const statuses = ["reserved", "contacted", "provisional_hold", "confirmed", "cancelled"];
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());

export const AdminReservations2027Content = () => {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [funding, setFunding] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const db = supabase as any;

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("accommodation_reservations_admin_v").select("*").eq("academic_year", 2027).order("created_at", { ascending: false });
    if (error) toast.error(error.message || "Could not load 2027 reservations");
    const next = (data || []) as Reservation[];
    setRows(next);
    setNotes(Object.fromEntries(next.map((x) => [x.id, x.admin_notes || ""])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const haystack = `${r.student_name || ""} ${r.student_number || ""} ${r.student_email || ""} ${r.student_phone || ""} ${r.residence_name || ""} ${r.residence_campus || ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (status === "all" || r.status === status) && (funding === "all" || r.funding_type === funding);
  }), [rows, query, status, funding]);

  const total = rows.length;
  const pending = rows.filter((r) => ["reserved", "contacted", "provisional_hold"].includes(r.status)).length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;

  const updateStatus = async (row: Reservation, next: string) => {
    const payload: any = { status: next };
    if (next === "contacted") payload.last_contacted_at = new Date().toISOString();
    const { error } = await db.from("accommodation_reservations").update(payload).eq("id", row.id);
    if (error) return toast.error(error.message || "Could not update reservation");
    toast.success(`Reservation marked ${label(next)}`);
    await load();
  };

  const saveNotes = async (row: Reservation) => {
    const { error } = await db.from("accommodation_reservations").update({ admin_notes: notes[row.id] || null }).eq("id", row.id);
    if (error) return toast.error(error.message || "Could not save admin note");
    toast.success("Admin note saved");
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /><h2 className="text-2xl font-bold">2027 Accommodation Reservations</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Every reservation from Find My Res is recorded here and also creates an Overview alert + system activity event.</p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total reservations</p><p className="mt-1 text-2xl font-black">{total}</p></div><Users className="h-6 w-6 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Needs follow-up</p><p className="mt-1 text-2xl font-black">{pending}</p></div><Clock3 className="h-6 w-6 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Confirmed</p><p className="mt-1 text-2xl font-black">{confirmed}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div></CardContent></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student, number, residence or campus…" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select>
        <Select value={funding} onValueChange={setFunding}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All funding</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="nsfas">NSFAS</SelectItem><SelectItem value="undecided">Undecided</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
      </div>

      {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading reservations…</CardContent></Card> : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-2 font-semibold">No matching 2027 reservations</p><p className="text-sm text-muted-foreground">New reservations will appear here immediately after students reserve.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id} className="overflow-hidden"><CardContent className="p-0">
              <div className="grid gap-0 xl:grid-cols-[1.15fr_1fr_220px]">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2"><Badge>{label(row.status)}</Badge><Badge variant="outline">{row.funding_type.toUpperCase()}</Badge><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span></div>
                  <h3 className="mt-3 text-lg font-bold">{row.student_name || "Student"}</h3>
                  <p className="text-sm text-muted-foreground">{row.student_number || "No student number"} · {row.student_email || "No email"}</p>
                  {row.student_phone && <a href={`https://wa.me/${row.student_phone.replace(/\D/g, "").replace(/^0/, "27")}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><MessageCircle className="h-4 w-4" />{row.student_phone}</a>}
                  {row.notes && <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Student note:</span> {row.notes}</div>}
                </div>
                <div className="border-t p-4 sm:p-5 xl:border-l xl:border-t-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Residence</p>
                  <p className="mt-1 font-bold">{row.residence_name || "Residence"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.residence_address || "Address unavailable"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.residence_campus || "Campus not set"}</p>
                  <p className="mt-3 text-xs"><span className="font-semibold">Room:</span> {row.room_preference || "No preference"}</p>
                  <p className="mt-1 text-xs"><span className="font-semibold">Source:</span> {row.source}</p>
                </div>
                <div className="border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin action</p>
                  <Select value={row.status} onValueChange={(v) => updateStatus(row, v)}><SelectTrigger className="mb-3"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select>
                  <Textarea rows={3} value={notes[row.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [row.id]: e.target.value }))} placeholder="Internal follow-up note" />
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => saveNotes(row)}>Save note</Button>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReservations2027Content;
