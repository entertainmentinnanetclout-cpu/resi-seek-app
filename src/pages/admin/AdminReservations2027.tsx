import { useCallback, useEffect, useMemo, useState } from "react";
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
  academic_cycle: "unspecified" | "annual" | "semester" | "trimester";
  academic_period: number;
  study_level: "unspecified" | "undergraduate" | "postgraduate" | "advanced" | "other";
  student_stage: "unspecified" | "first_time" | "continuing" | "returning" | "advanced" | "graduating" | "other";
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
const cycles = ["annual", "semester", "trimester", "unspecified"] as const;
const studyLevels = ["undergraduate", "postgraduate", "advanced", "other", "unspecified"] as const;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());

const periodOptions = (cycle: string) => {
  if (cycle === "semester") return [1, 2];
  if (cycle === "trimester") return [1, 2, 3];
  if (cycle === "annual") return [1];
  if (cycle === "unspecified") return [0];
  return [0, 1, 2, 3];
};

export const AdminReservations2027Content = () => {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [academicYear, setAcademicYear] = useState(currentYear + 1);
  const [cycle, setCycle] = useState("all");
  const [period, setPeriod] = useState("all");
  const [studyLevel, setStudyLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [funding, setFunding] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const db = supabase as any;

  const load = useCallback(async () => {
    setLoading(true);
    let request = db
      .from("accommodation_reservations_admin_v")
      .select("*")
      .eq("academic_year", academicYear)
      .order("created_at", { ascending: false });
    if (cycle !== "all") request = request.eq("academic_cycle", cycle);
    if (period !== "all") request = request.eq("academic_period", Number(period));
    if (studyLevel !== "all") request = request.eq("study_level", studyLevel);
    const { data, error } = await request;
    if (error) toast.error(error.message || "Could not load academic reservations");
    const next = (data || []) as Reservation[];
    setRows(next);
    setNotes(Object.fromEntries(next.map((x) => [x.id, x.admin_notes || ""])));
    setLoading(false);
  }, [academicYear, cycle, period, studyLevel]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel("admin-academic-reservations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_reservations" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  useEffect(() => {
    if (period !== "all" && !periodOptions(cycle).includes(Number(period))) setPeriod("all");
  }, [cycle, period]);

  const filtered = useMemo(() => rows.filter((r) => {
    const haystack = `${r.student_name || ""} ${r.student_number || ""} ${r.student_email || ""} ${r.student_phone || ""} ${r.residence_name || ""} ${r.residence_campus || ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (status === "all" || r.status === status)
      && (funding === "all" || r.funding_type === funding);
  }), [rows, query, status, funding]);

  const total = rows.length;
  const pending = rows.filter((r) => ["reserved", "contacted", "provisional_hold"].includes(r.status)).length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const cohortKnown = rows.filter((r) => r.academic_cycle !== "unspecified").length;

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

  const updateAcademicContext = async (row: Reservation, patch: Partial<Reservation>) => {
    const nextCycle = String(patch.academic_cycle ?? row.academic_cycle);
    let nextPeriod = Number(patch.academic_period ?? row.academic_period);
    if (nextCycle === "annual") nextPeriod = 1;
    if (nextCycle === "unspecified") nextPeriod = 0;
    if (nextCycle === "semester") nextPeriod = Math.max(1, Math.min(2, nextPeriod || 1));
    if (nextCycle === "trimester") nextPeriod = Math.max(1, Math.min(3, nextPeriod || 1));
    const payload = { ...patch, academic_period: nextPeriod };
    const { error } = await db.from("accommodation_reservations").update(payload).eq("id", row.id);
    if (error) return toast.error(error.message || "Could not update academic context");
    toast.success("Academic intake context updated");
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /><h2 className="text-2xl font-black">Academic Reservations & Intake</h2></div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage annual, semester and trimester accommodation cohorts independently by academic year. A 2027 intake never changes 2026 occupancy.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>Refresh</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{academicYear} reservations</p><p className="mt-1 text-2xl font-black">{total}</p></div><Users className="h-6 w-6 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Needs follow-up</p><p className="mt-1 text-2xl font-black">{pending}</p></div><Clock3 className="h-6 w-6 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Confirmed</p><p className="mt-1 text-2xl font-black">{confirmed}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div><p className="text-xs text-muted-foreground">Cycle classified</p><p className="mt-1 text-2xl font-black">{cohortKnown}/{total}</p><p className="mt-1 text-[11px] text-muted-foreground">Annual / semester / trimester known</p></div></CardContent></Card>
      </div>

      <Card className="border-primary/20 bg-primary/[0.025]"><CardContent className="p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Academic cohort filters</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Select value={String(academicYear)} onValueChange={(value) => setAcademicYear(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
          <Select value={cycle} onValueChange={setCycle}><SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger><SelectContent><SelectItem value="all">All cycles</SelectItem>{cycles.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent></Select>
          <Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger><SelectContent><SelectItem value="all">All periods</SelectItem>{periodOptions(cycle).map((value) => <SelectItem key={value} value={String(value)}>{value === 0 ? "Unspecified" : `Period ${value}`}</SelectItem>)}</SelectContent></Select>
          <Select value={studyLevel} onValueChange={setStudyLevel}><SelectTrigger><SelectValue placeholder="Study level" /></SelectTrigger><SelectContent><SelectItem value="all">All study levels</SelectItem>{studyLevels.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select>
          <Select value={funding} onValueChange={setFunding}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All funding</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="nsfas">NSFAS</SelectItem><SelectItem value="undecided">Undecided</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
        </div>
      </CardContent></Card>

      <div className="relative max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student, number, residence or campus…" /></div>

      {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading academic intake…</CardContent></Card> : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-2 font-semibold">No matching academic reservations</p><p className="text-sm text-muted-foreground">Change the academic year or cohort filters to review another intake.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id} className="overflow-hidden"><CardContent className="p-0">
              <div className="grid gap-0 xl:grid-cols-[1.15fr_1fr_270px]">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{label(row.status)}</Badge><Badge variant="outline">{row.funding_type.toUpperCase()}</Badge>
                    <Badge variant="outline">{row.academic_year} · {label(row.academic_cycle)}{row.academic_period > 0 ? ` ${row.academic_period}` : ""}</Badge>
                    <Badge variant="outline">{label(row.study_level)}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{row.student_name || "Student"}</h3>
                  <p className="text-sm text-muted-foreground">{row.student_number || "No student number"} · {row.student_email || "No email"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Stage: {label(row.student_stage || "unspecified")}</p>
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
                <div className="space-y-3 border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Institutional classification</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={row.academic_cycle} onValueChange={(value) => void updateAcademicContext(row, { academic_cycle: value as Reservation["academic_cycle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cycles.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent></Select>
                    <Select value={String(row.academic_period)} onValueChange={(value) => void updateAcademicContext(row, { academic_period: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{periodOptions(row.academic_cycle).map((value) => <SelectItem key={value} value={String(value)}>{value === 0 ? "Unspecified" : `Period ${value}`}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <Select value={row.study_level} onValueChange={(value) => void updateAcademicContext(row, { study_level: value as Reservation["study_level"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{studyLevels.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent></Select>
                  <p className="pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Reservation action</p>
                  <Select value={row.status} onValueChange={(value) => void updateStatus(row, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select>
                  <Textarea rows={3} value={notes[row.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [row.id]: e.target.value }))} placeholder="Internal follow-up note" />
                  <Button size="sm" variant="outline" className="w-full" onClick={() => void saveNotes(row)}>Save note</Button>
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
