import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, ExternalLink, FileCheck2, FileText, GraduationCap, Loader2, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const matchLabel = (status: string) => {
  if (["eligible", "published_requirements_met"].includes(status)) return { label: "Published minimums met", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 };
  if (["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(status)) return { label: "Official confirmation / selection", tone: "text-amber-700 bg-amber-50 border-amber-200", icon: ShieldCheck };
  if (status.includes("aps")) return { label: "APS below minimum", tone: "text-rose-700 bg-rose-50 border-rose-200", icon: XCircle };
  if (status.includes("subject") || status.includes("grade")) return { label: "Requirement not currently met", tone: "text-rose-700 bg-rose-50 border-rose-200", icon: XCircle };
  return { label: status.replace(/_/g, " "), tone: "text-muted-foreground bg-muted border-border", icon: AlertCircle };
};

const applicationStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under review",
    documents_required: "Documents required",
    approved: "Approved",
    rejected: "Not approved",
    waitlisted: "Waitlisted",
    cancelled: "Cancelled",
  };
  return map[status] ?? status.replace(/_/g, " ");
};

const MyApplicationsCenter = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [accommodationApplications, setAccommodationApplications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "matches" | "confirmation" | "not_met">("all");

  const loadOverview = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [historyResult, institutionResult, appResult, docsResult] = await Promise.all([
        (supabase as any).from("student_marks_profiles")
          .select("id,institution_type,highest_grade,estimated_aps,subjects,summary,metadata,created_at")
          .eq("user_id", user.id)
          .eq("readiness_result", "course_match_completed")
          .order("created_at", { ascending: false })
          .limit(12),
        (supabase as any).from("application_hub_institutions")
          .select("institution_id,slug,short_name,display_name,category,matcher_key,application_url,official_url")
          .eq("is_active", true),
        (supabase as any).from("applications")
          .select("id,residence_id,status,created_at,updated_at,institution_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
        (supabase as any).from("documents")
          .select("id,document_type,created_at")
          .eq("user_id", user.id),
      ]);

      if (historyResult.error) throw historyResult.error;
      if (institutionResult.error) throw institutionResult.error;
      if (appResult.error) throw appResult.error;
      if (docsResult.error) throw docsResult.error;

      const runs = historyResult.data ?? [];
      setHistory(runs);
      setInstitutions(institutionResult.data ?? []);
      setDocuments(docsResult.data ?? []);
      if (!selectedRun && runs[0]?.id) setSelectedRun(runs[0].id);

      const apps = appResult.data ?? [];
      const residenceIds = [...new Set(apps.map((row: any) => row.residence_id).filter(Boolean))];
      let residenceMap = new Map<string, any>();
      if (residenceIds.length) {
        const { data: residences } = await (supabase as any).from("residences").select("id,name,address").in("id", residenceIds);
        residenceMap = new Map((residences ?? []).map((row: any) => [String(row.id), row]));
      }
      setAccommodationApplications(apps.map((row: any) => ({ ...row, residence: residenceMap.get(String(row.residence_id)) })));
    } catch (error) {
      console.error("My Applications overview failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, [user?.id]);

  useEffect(() => {
    const loadResults = async () => {
      if (!user || !selectedRun) { setResults([]); return; }
      setResultsLoading(true);
      const { data, error } = await (supabase as any).from("student_programme_match_results")
        .select("id,programme_id,match_status,student_aps,aps_required,subject_match_summary,missing_requirements,matched_requirements,source_context,created_at")
        .eq("user_id", user.id)
        .eq("marks_profile_id", selectedRun)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) {
        console.error("Could not load Course Match results", error);
        setResults([]);
      } else {
        setResults(data ?? []);
      }
      setResultsLoading(false);
    };
    loadResults();
  }, [user?.id, selectedRun]);

  const selectedProfile = history.find((run) => run.id === selectedRun) ?? history[0] ?? null;
  const documentTypes = new Set(documents.map((doc) => doc.document_type));
  const coreDocs = ["student_card", "proof_of_registration"];
  const coreDocsComplete = coreDocs.every((type) => documentTypes.has(type));

  const resultSummary = useMemo(() => results.reduce((acc, row) => {
    if (["eligible", "published_requirements_met"].includes(row.match_status)) acc.matches += 1;
    else if (["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(row.match_status)) acc.confirmation += 1;
    else acc.notMet += 1;
    acc.total += 1;
    return acc;
  }, { total: 0, matches: 0, confirmation: 0, notMet: 0 }), [results]);

  const filteredResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return results.filter((row) => {
      const status = String(row.match_status ?? "");
      if (filter === "matches" && !["eligible", "published_requirements_met"].includes(status)) return false;
      if (filter === "confirmation" && !["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(status)) return false;
      if (filter === "not_met" && ["eligible", "published_requirements_met", "academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"].includes(status)) return false;
      const ctx = row.source_context ?? {};
      const haystack = `${ctx.programme_name ?? ""} ${ctx.qualification_code ?? ""} ${ctx.qualification_type ?? ""} ${ctx.institution ?? ""} ${ctx.institution_name ?? ""} ${ctx.campus ?? ""}`.toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [results, query, filter]);

  const institutionFor = (ctx: any) => {
    const code = String(ctx?.institution ?? "").toLowerCase();
    const slug = String(ctx?.institution_slug ?? "").toLowerCase();
    return institutions.find((row) =>
      (row.matcher_key && String(row.matcher_key).toLowerCase() === code) ||
      (row.slug && String(row.slug).toLowerCase() === slug) ||
      (ctx?.institution_name && row.display_name === ctx.institution_name)
    );
  };

  if (loading) {
    return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <SEO title="My Applications & Course Matches | ResKonnect" description="Review your APS, saved Course Match results, application readiness and student accommodation applications in one ResKonnect dashboard." />
      <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-3xl border bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_34%),hsl(var(--card))] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="rounded-full">Phase 6C • My Applications</Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Your tertiary application command centre.</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Keep your latest APS and subject profile, programme matches, verification items and accommodation applications together. Course Match guides your planning; the institution still makes the official admission decision.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/apply">Run Course Match <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link to="/documents">My documents</Link></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Latest saved APS</p><p className="mt-1 text-3xl font-black">{selectedProfile?.estimated_aps ?? "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">{selectedProfile?.highest_grade ?? "Run Course Match to create a profile"}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Published minimums met</p><p className="mt-1 text-3xl font-black text-emerald-700">{resultSummary.matches}</p><p className="mt-1 text-[11px] text-muted-foreground">From the selected Course Match run</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Need confirmation / selection</p><p className="mt-1 text-3xl font-black text-amber-700">{resultSummary.confirmation}</p><p className="mt-1 text-[11px] text-muted-foreground">Official checks still apply</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Accommodation applications</p><p className="mt-1 text-3xl font-black">{accommodationApplications.length}</p><p className="mt-1 text-[11px] text-muted-foreground">ResKonnect residence applications</p></CardContent></Card>
        </section>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Course Match history</p><h2 className="mt-1 font-black">Saved checks</h2></div><RefreshCw className="h-4 w-4 text-muted-foreground" /></div>
                <div className="mt-4 space-y-2">
                  {history.length ? history.map((run) => (
                    <button key={run.id} type="button" onClick={() => setSelectedRun(run.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedRun === run.id ? "border-primary bg-primary/8 ring-1 ring-primary/20" : "hover:border-primary/40"}`}>
                      <div className="flex items-center justify-between gap-2"><Badge variant="outline" className="text-[10px]">{String(run.institution_type).toUpperCase()}</Badge><span className="text-[10px] text-muted-foreground">{new Date(run.created_at).toLocaleDateString()}</span></div>
                      <p className="mt-2 text-sm font-bold">{Array.isArray(run.metadata?.institution_scope) ? run.metadata.institution_scope.join(" + ") : "Programme comparison"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">APS {run.estimated_aps ?? "—"} • {run.metadata?.total_results ?? "—"} routes</p>
                    </button>
                  )) : <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No saved Course Match yet.</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" /><h2 className="font-black">Document readiness</h2></div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Student card</span>{documentTypes.has("student_card") ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}</div>
                  <div className="flex items-center justify-between"><span>Proof of registration</span>{documentTypes.has("proof_of_registration") ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}</div>
                </div>
                <Badge variant="outline" className={`mt-4 ${coreDocsComplete ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>{coreDocsComplete ? "Core documents available" : "Core documents incomplete"}</Badge>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full"><Link to="/documents">Manage documents</Link></Button>
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Programme results</p>
              <h2 className="mt-1 text-2xl font-black">What your latest saved check found</h2>
              {selectedProfile?.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedProfile.summary}</p>}
            </div>

            <Card><CardContent className="p-4"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search institution, programme or campus…" className="pl-9" /></div><select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "matches" | "confirmation" | "not_met")} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All results</option><option value="matches">Minimums met</option><option value="confirmation">Confirmation / selection</option><option value="not_met">Not currently met</option></select></div></CardContent></Card>

            {resultsLoading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : filteredResults.length ? (
              <div className="grid gap-3">
                {filteredResults.map((row) => {
                  const ctx = row.source_context ?? {};
                  const institution = institutionFor(ctx);
                  const status = matchLabel(String(row.match_status ?? ""));
                  const StatusIcon = status.icon;
                  const programmeName = ctx.programme_name ?? "Programme";
                  const institutionName = ctx.institution_name ?? institution?.display_name ?? String(ctx.institution ?? "Institution").toUpperCase();
                  const applicationUrl = ctx.application_url ?? institution?.application_url ?? null;
                  const sourceUrl = ctx.official_url ?? institution?.official_url ?? null;
                  const missing = Array.isArray(row.missing_requirements) ? row.missing_requirements : [];
                  return (
                    <Card key={row.id}>
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{institutionName}</Badge><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.tone}`}><StatusIcon className="h-3.5 w-3.5" />{status.label}</span></div>
                            <h3 className="mt-3 text-base font-bold sm:text-lg">{programmeName}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{ctx.qualification_code ? `${ctx.qualification_code} • ` : ""}{ctx.qualification_type ?? ""}{ctx.campus ? ` • ${ctx.campus}` : ""}</p>
                            {(row.student_aps != null || row.aps_required != null) && <p className="mt-2 text-xs text-muted-foreground">Your APS: <strong className="text-foreground">{row.student_aps ?? "—"}</strong>{row.aps_required != null ? ` • Published minimum: ${row.aps_required}` : ""}</p>}
                            {missing.length > 0 && <div className="mt-3 rounded-xl bg-muted/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Missing / still to check</p>{missing.slice(0, 3).map((item: any, index: number) => <p key={index} className="mt-1 text-xs">• {item.subject ?? item.label ?? item.group_key ?? item.raw_requirement ?? "Additional requirement"}</p>)}</div>}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {sourceUrl && <Button asChild size="sm" variant="outline"><a href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                            {applicationUrl && <Button asChild size="sm"><a href={applicationUrl} target="_blank" rel="noreferrer">Continue application <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : <Card className="border-dashed"><CardContent className="p-10 text-center"><GraduationCap className="mx-auto h-9 w-9 text-primary" /><h3 className="mt-4 font-bold">No programme results in this view</h3><p className="mt-2 text-sm text-muted-foreground">Run Course Match or change your current filters.</p><Button asChild className="mt-4"><Link to="/apply">Go to Course Match</Link></Button></CardContent></Card>}
          </div>
        </div>

        <section className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Accommodation</p><h2 className="mt-1 text-2xl font-black">Residence applications</h2><p className="mt-2 text-sm text-muted-foreground">Accommodation applications submitted inside ResKonnect are shown here alongside your tertiary planning.</p></div>
          {accommodationApplications.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{accommodationApplications.map((app) => <Card key={app.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{app.residence?.name ?? "Student accommodation"}</h3><p className="mt-1 text-xs text-muted-foreground">{app.residence?.address ?? "Residence application"}</p></div><Badge variant="outline">{applicationStatusLabel(app.status)}</Badge></div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Applied {new Date(app.created_at).toLocaleDateString()}</div>{app.residence_id && <Button asChild variant="outline" size="sm" className="mt-4 w-full"><Link to={`/res/${app.residence_id}`}>View residence</Link></Button>}</CardContent></Card>)}</div> : <Card className="border-dashed"><CardContent className="p-8 text-center"><FileText className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 text-sm text-muted-foreground">No accommodation applications yet.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/find">Find accommodation</Link></Button></CardContent></Card>}
        </section>

        <div className="rounded-2xl border bg-muted/35 p-4 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Important:</strong> Course Match is planning guidance based on the information you entered and captured published requirements. A saved match is not an admission offer. Final admission, placement, ranking, capacity, deadlines and document verification remain controlled by the relevant institution.
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyApplicationsCenter;
