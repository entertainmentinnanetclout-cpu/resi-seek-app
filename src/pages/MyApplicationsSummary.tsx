import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const MATCHED = ["eligible", "published_requirements_met"];
const REVIEW = ["academic_minimum_selection_required", "eligible_with_conditional_curriculum_check", "official_confirmation_required"];

const resultView = (status: string) => {
  if (MATCHED.includes(status)) return { label: "Published minimums met", icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (REVIEW.includes(status)) return { label: "Selection / confirmation applies", icon: ShieldCheck, cls: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "Requirement not currently met", icon: XCircle, cls: "border-rose-200 bg-rose-50 text-rose-800" };
};

const MyApplicationsSummary = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [residenceCount, setResidenceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [history, applications] = await Promise.all([
        (supabase as any)
          .from("student_marks_profiles")
          .select("id,institution_type,highest_grade,estimated_aps,summary,metadata,created_at")
          .eq("user_id", user.id)
          .eq("readiness_result", "course_match_completed")
          .order("created_at", { ascending: false })
          .limit(8),
        (supabase as any)
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      const rows = history.error ? [] : history.data ?? [];
      setRuns(rows);
      setRunId((current) => current ?? rows[0]?.id ?? null);
      setResidenceCount(applications.count ?? 0);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !runId) {
      setResults([]);
      return;
    }
    const loadResults = async () => {
      const { data, error } = await (supabase as any)
        .from("student_programme_match_results")
        .select("id,match_status,student_aps,aps_required,missing_requirements,source_context")
        .eq("user_id", user.id)
        .eq("marks_profile_id", runId)
        .limit(200);
      setResults(error ? [] : data ?? []);
    };
    loadResults();
  }, [user?.id, runId]);

  const currentRun = runs.find((run) => run.id === runId) ?? runs[0] ?? null;
  const counts = useMemo(
    () => results.reduce(
      (acc, row) => {
        if (MATCHED.includes(row.match_status)) acc.matched += 1;
        else if (REVIEW.includes(row.match_status)) acc.review += 1;
        else acc.notMet += 1;
        return acc;
      },
      { matched: 0, review: 0, notMet: 0 },
    ),
    [results],
  );

  if (loading) {
    return <DashboardLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <SEO title="My Applications & Course Matches | ResKonnect" description="Review your saved APS profiles and Course Match history in your ResKonnect account." />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <Badge className="rounded-full">Phase 6C • My Applications</Badge>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your tertiary application dashboard.</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Return to saved APS profiles and programme comparisons without starting from scratch. Your Course Match history is tied to your signed-in account.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/apply">Run Course Match <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link to="/documents">My documents</Link></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Latest saved APS</p><p className="mt-1 text-3xl font-black">{currentRun?.estimated_aps ?? "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">{currentRun?.highest_grade ?? "No saved check yet"}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Minimums met</p><p className="mt-1 text-3xl font-black text-emerald-700">{counts.matched}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Selection / confirmation</p><p className="mt-1 text-3xl font-black text-amber-700">{counts.review}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Residence applications</p><p className="mt-1 text-3xl font-black">{residenceCount}</p></CardContent></Card>
        </section>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Course Match history</p>
              <div className="mt-4 space-y-2">
                {runs.length ? runs.map((run) => (
                  <button key={run.id} type="button" onClick={() => setRunId(run.id)} className={`w-full rounded-xl border p-3 text-left ${runId === run.id ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
                    <div className="flex items-center justify-between gap-2"><Badge variant="outline" className="text-[10px]">{String(run.institution_type).toUpperCase()}</Badge><span className="text-[10px] text-muted-foreground">{new Date(run.created_at).toLocaleDateString()}</span></div>
                    <p className="mt-2 text-sm font-bold">{Array.isArray(run.metadata?.institution_scope) ? run.metadata.institution_scope.join(" + ") : "Programme comparison"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">APS {run.estimated_aps ?? "—"}</p>
                  </button>
                )) : <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No saved Course Match yet.</div>}
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Programme results</p><h2 className="mt-1 text-2xl font-black">Your saved comparison</h2>{currentRun?.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{currentRun.summary}</p>}</div>
            {results.length ? results.map((row) => {
              const ctx = row.source_context ?? {};
              const view = resultView(String(row.match_status ?? ""));
              const StatusIcon = view.icon;
              const missing = Array.isArray(row.missing_requirements) ? row.missing_requirements : [];
              return (
                <Card key={row.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{ctx.institution_name ?? String(ctx.institution ?? "Institution").toUpperCase()}</Badge><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${view.cls}`}><StatusIcon className="h-3.5 w-3.5" />{view.label}</span></div>
                    <h3 className="mt-3 font-bold">{ctx.programme_name ?? "Programme"}</h3>
                    {(row.student_aps != null || row.aps_required != null) && <p className="mt-1 text-xs text-muted-foreground">Your APS {row.student_aps ?? "—"}{row.aps_required != null ? ` • published minimum ${row.aps_required}` : ""}</p>}
                    {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{missing.length} requirement check{missing.length === 1 ? "" : "s"} still outstanding.</p>}
                  </CardContent>
                </Card>
              );
            }) : <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">No saved programme results in this view. Run Course Match to create a new comparison.</CardContent></Card>}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border bg-muted/35 p-4 text-xs leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p><strong className="text-foreground">Important:</strong> Course Match is planning guidance. A saved match is not an admission offer; the institution remains responsible for final admission, selection, capacity and verification.</p></div>
      </div>
    </DashboardLayout>
  );
};

export default MyApplicationsSummary;
