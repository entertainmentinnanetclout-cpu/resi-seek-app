import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, ExternalLink, GraduationCap, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const resultStyle = (status: string) => {
  if (["eligible", "published_requirements_met"].includes(status)) {
    return { label: "Published minimums met", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
  }
  if (["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(status)) {
    return { label: "Selection / confirmation applies", tone: "border-amber-200 bg-amber-50 text-amber-800", icon: ShieldCheck };
  }
  return { label: "Requirement not currently met", tone: "border-rose-200 bg-rose-50 text-rose-800", icon: XCircle };
};

const MyApplicationsCenter = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [resApplications, setResApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [history, institutionRows, applications] = await Promise.all([
        (supabase as any).from("student_marks_profiles")
          .select("id,institution_type,highest_grade,estimated_aps,summary,metadata,created_at")
          .eq("user_id", user.id)
          .eq("readiness_result", "course_match_completed")
          .order("created_at", { ascending: false })
          .limit(12),
        (supabase as any).from("application_hub_institutions")
          .select("slug,short_name,display_name,matcher_key,application_url,official_url")
          .eq("is_active", true),
        (supabase as any).from("applications")
          .select("id,residence_id,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      if (!history.error) {
        const rows = history.data ?? [];
        setRuns(rows);
        setSelectedRun((current) => current ?? rows[0]?.id ?? null);
      }
      if (!institutionRows.error) setInstitutions(institutionRows.data ?? []);

      if (!applications.error) {
        const rows = applications.data ?? [];
        const ids = [...new Set(rows.map((row: any) => row.residence_id).filter(Boolean))];
        let residenceMap = new Map<string, any>();
        if (ids.length) {
          const { data } = await (supabase as any).from("residences").select("id,name,address").in("id", ids);
          residenceMap = new Map((data ?? []).map((row: any) => [String(row.id), row]));
        }
        setResApplications(rows.map((row: any) => ({ ...row, residence: residenceMap.get(String(row.residence_id)) })));
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !selectedRun) {
      setResults([]);
      return;
    }
    const loadResults = async () => {
      const { data, error } = await (supabase as any).from("student_programme_match_results")
        .select("id,match_status,student_aps,aps_required,missing_requirements,source_context,created_at")
        .eq("user_id", user.id)
        .eq("marks_profile_id", selectedRun)
        .order("created_at", { ascending: false })
        .limit(300);
      setResults(error ? [] : data ?? []);
    };
    loadResults();
  }, [user?.id, selectedRun]);

  const currentRun = runs.find((row) => row.id === selectedRun) ?? runs[0] ?? null;
  const counts = useMemo(() => results.reduce((acc, item) => {
    if (["eligible", "published_requirements_met"].includes(item.match_status)) acc.met += 1;
    else if (["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(item.match_status)) acc.confirm += 1;
    else acc.notMet += 1;
    return acc;
  }, { met: 0, confirm: 0, notMet: 0 }), [results]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return results;
    return results.filter((item) => {
      const context = item.source_context ?? {};
      return `${context.programme_name ?? ""} ${context.institution_name ?? ""} ${context.institution ?? ""} ${context.campus ?? ""}`.toLowerCase().includes(needle);
    });
  }, [results, query]);

  const institutionFor = (context: any) => {
    const code = String(context?.institution ?? "").toLowerCase();
    const slug = String(context?.institution_slug ?? "").toLowerCase();
    return institutions.find((row) =>
      String(row.matcher_key ?? "").toLowerCase() === code ||
      String(row.slug ?? "").toLowerCase() === slug ||
      row.display_name === context?.institution_name
    );
  };

  if (loading) {
    return <DashboardLayout><div className="flex min-h[[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <SEO title="My Applications & Course Matches | ResKonnect" description="Review saved APS profiles, Course Match results and ResKonnect accommodation applications." />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <Badge className="rounded-full">Phase 6C • My Applications</Badge>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your tertiary application dashboard.</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Your saved APS profile, programme comparisons and accommodation applications now live in one place so you can return to your planning instead of starting again.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/apply">Run Course Match <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link to="/documents">My documents</Link></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Latest saved APS</p><p className="mt-1 text-3xl font-black">{currentRun?.estimated_aps ?? "—"=</p><p className="mt-1 text-[11px] text-muted-foreground">{currentRun?.highest_grade ?? "No saved check yet"}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Published minimums met</p><p className="mt-1 text-3xl font-black text-emerald-700">{counts.met}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Selection / confirmation</p><p className="mt-1 text-3xl font-black text-amber-700">{counts.confirm}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Residence applications</p><p className="mt-1 text-3xl font-black">{resApplications.length}</p></CardContent></Card>
        </section>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Course Match history</p>
              <h2 className="mt-1 font-black">Saved checks</h2>
              <div className="mt-4 space-y-2">
                {runs.length ? runs.map((run) => (
                  <button key={run.id} type="button" onClick={() => setSelectedRun(run.id)} className={`wfull rounded-xl border p-3 text-left transition ${selectedRun === run.id ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">{String(run.institution_type).toUpperCase()}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(run.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold">{Array.isArray(run.metadata?.institution_scope) ? run.metadata.institution_scope.join(" + ") : "Programme comparison"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">APS {run.estimated_aps ?? "—" } • {run.metadata?.total_results ?? "—"} routes</p>
                  </button>
                )) : <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No saved Course Match yet.</div>}
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Programme results</p>
              <h2 className="mt-1 text-2xl font-black">Your saved comparison</h2>
              {currentRun?.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{currentRun.summary}</p>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search programme, institution or campus…" className="pl-9" />
            </div>

            {filtered.length ? filtered.map((row) => {
              const context = row.source_context ?? {};
              const institution = institutionFor(context);
              const style = resultStyle(String(row.match_status ?? ""));
              const StatusIcon = style.icon;
              const applicationUrl = context.application_url ?? institution?.application_url ?? null;
              const sourceUrl = context.official_url ?? institution?.official_url ?? null;
              const missing = Array.isArray(row.missing_requirements) ? row.missing_requirements : [];
              return (
                <Card key={row.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{context.institution_name ?? institution?.display_name ?? String(context.institution ?? "Institution").toUpperCase()}</Badge>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${style.tone}`~<StatusIcon className="h-3.5 w-3.5" />{style.label}</span>
                      </div>
                      <h3 className="mt-3 font-bold">{context.programme_name ?? "Programme"}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{context.qualification_code ?? ""}{context.qualification_type ? `: ${context.qualification_type}` : ""}{context.campus ? ` • ${context.campus}` : ""}</p>
                      {(row.student_aps != null || row.aps_required != null) && <p className="mt-2 text-xs text-muted-foreground">Your APS: <strong className="text-foreground">{row.student_aps ?? "—"=</strong>{row.aps_required != null ? ` • Published minimum: ${row.aps_required}` : ""}</p>}
                      {missing.length > 0 && <div className="mt-3 rounded-xl bg-muted/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Still to check</p>{missing.slice(0, 3).map((item: any, index: number) => <p key={index} className="mt-1 text-xs">• {item.subject ?? item.label ?? item.group_key ?? item.raw_requirement ?? "Additional requirement"}</p>)}</div>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {sourceUrl && <Button asChild variant="outline" size="sm"><a href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                      {applicationUrl && <Button asChild size="sm"><a href={applicationUrl} target="_blank" rel="noreferrer">Official application <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <Card className="border-dashed"><CardContent className="p-8 text-center"><GraduationCap className="mx-auto h-9 w-9 text-primary" /><h3 className="mt-3 font-bold">No saved programme results in this view</h3><Button asChild className="mt-4"><Link to="/apply">Run Course Match</Link></Button></CardContent></Card>
            )}
          </div>
        </div>

        <section className="space-y-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Accommodation</p><h2 className="mt-1 text-2xl font-black">Residence applications</h2></div>
          {resApplications.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{resApplications.map((app) => <Card key={app.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{app.residence?.name ?? "Student accommodation"}</h3><p className="mt-1 text-[11px] text-muted-foreground">{app.residence?.address ?? "Residence application"}</p></div><Badge variant="outline">{String(app.status).replace(/_/g, " ")}</Badge></div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Applied {new Date(app.created_at).toLocaleDateString()}</div>{app.residence_id && <Button asChild variant="outline" size="sm" className="mt-4 w-full"><Link to={ /res/${app.residence_id}`}>View residence</Link></Button>}</CardContent></Card>)}</div> : <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No accommodation applications yet.</CardContent></Card>}
        </section>

        <div className="flex items-start gap-2 rounded-2xl border bg-muted/35 p-4 text-xs leading-5 text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong className="text-foreground">Important:</strong> Course Match is planning guidance based on captured published requirements and the information entered. It is not an admission offer. Final admission, placement, capacity, deadlines and verification remain controlled by the institution.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyApplicationsCenter;
