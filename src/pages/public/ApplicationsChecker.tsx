import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  CourseMatchResult,
  CourseMatchSubject,
  estimateAcademicAps,
  runUnisaCourseMatch,
  saveUnisaCourseMatch,
} from "@/lib/courseMatch";

interface SubjectRow extends CourseMatchSubject {
  locked?: boolean;
}

const DEFAULT_SUBJECTS: SubjectRow[] = [
  { name: "Language of teaching and learning", mark: 0, locked: true },
  { name: "Second language", mark: 0 },
  { name: "Mathematics", mark: 0, locked: true },
  { name: "Mathematical Literacy", mark: 0, locked: true },
  { name: "Life Orientation", mark: 0, locked: true },
  { name: "Life Sciences", mark: 0 },
  { name: "Physical Science", mark: 0 },
  { name: "Elective Subject", mark: 0 },
];

const STATUS_LABELS: Record<CourseMatchResult["match_status"], string> = {
  eligible: "Academic minimum met",
  academic_minimum_selection_required: "Academic minimum met — selection applies",
  eligible_with_conditional_curriculum_check: "Potential match — curriculum check required",
  not_eligible_aps: "APS minimum not met",
  not_eligible_subject: "Subject minimum not met",
};

const statusClass = (status: CourseMatchResult["match_status"]) => {
  if (status === "eligible") return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  if (status === "academic_minimum_selection_required") return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  if (status === "eligible_with_conditional_curriculum_check") return "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300";
  return "border-border bg-muted/30 text-muted-foreground";
};

export const ApplicationsChecker: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectRow[]>(DEFAULT_SUBJECTS);
  const [apsOverride, setApsOverride] = useState<number | null>(null);
  const [results, setResults] = useState<CourseMatchResult[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [savedToProfile, setSavedToProfile] = useState(false);

  const estimatedAPS = useMemo(() => estimateAcademicAps(subjects), [subjects]);
  const effectiveAPS = apsOverride ?? estimatedAPS;

  const completedAcademicSubjects = useMemo(
    () => subjects.filter((subject) => subject.mark > 0 && !subject.name.toLowerCase().includes("life orientation")).length,
    [subjects],
  );

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return results;
    return results.filter((result) =>
      [result.programme_name, result.qualification_code, result.qualification_type, result.faculty_or_school]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [results, searchTerm]);

  const resultCounts = useMemo(() => {
    const current = results ?? [];
    return {
      eligible: current.filter((result) => result.match_status === "eligible").length,
      selection: current.filter((result) => result.match_status === "academic_minimum_selection_required").length,
      conditional: current.filter((result) => result.match_status === "eligible_with_conditional_curriculum_check").length,
    };
  }, [results]);

  const markResultsStale = () => {
    setResults(null);
    setSavedToProfile(false);
    setSearchTerm("");
  };

  const handleMarkChange = (index: number, val: string) => {
    const markNum = Math.min(100, Math.max(0, Number.parseInt(val, 10) || 0));
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], mark: markNum };
      return next;
    });
    markResultsStale();
  };

  const handleSubjectNameChange = (index: number, val: string) => {
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: val };
      return next;
    });
    markResultsStale();
  };

  const addSubject = () => {
    setSubjects((prev) => [...prev, { name: "", mark: 0 }]);
    markResultsStale();
  };

  const removeSubject = (index: number) => {
    setSubjects((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    markResultsStale();
  };

  const handleReset = () => {
    setSubjects(DEFAULT_SUBJECTS.map((subject) => ({ ...subject })));
    setApsOverride(null);
    setResults(null);
    setSearchTerm("");
    setSavedToProfile(false);
  };

  const handleMatch = async (event: React.FormEvent) => {
    event.preventDefault();

    if (effectiveAPS <= 0) {
      toast.error("Enter your marks or an APS before running Course Match.");
      return;
    }

    const submittedSubjects = subjects
      .filter((subject) => subject.name.trim().length > 0)
      .map((subject) => ({ name: subject.name.trim(), mark: subject.mark }));

    setIsMatching(true);
    setSavedToProfile(false);

    try {
      const matched = await runUnisaCourseMatch(effectiveAPS, submittedSubjects, false);
      setResults(matched);

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        try {
          const profileId = await saveUnisaCourseMatch(
            effectiveAPS,
            submittedSubjects,
            authData.user.user_metadata?.full_name ?? null,
          );
          setSavedToProfile(Boolean(profileId));
        } catch (saveError) {
          console.error("Course Match history save failed", saveError);
        }
      }

      if (matched.length > 0) {
        toast.success(`${matched.length} current UNISA programme matches found.`);
      } else {
        toast.info("No current UNISA academic matches were found for the marks entered.");
      }
    } catch (error) {
      console.error("Course Match failed", error);
      toast.error("Course Match could not run. Please try again.");
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <PublicLayout>
      <SEO
        title="UNISA Course Match | APS & Subject Requirements"
        description="Match your Grade 12 marks against current verified UNISA undergraduate APS and subject requirements."
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-12 md:py-20">
        <div className="container mx-auto space-y-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ResKonnect Course Match</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Match your marks to current UNISA programmes</h1>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Enter your Grade 12 subjects and marks. Course Match checks the live verified UNISA catalogue against APS, required subjects, alternatives, selection rules and conditional curriculum requirements.
            </p>
          </div>

          <div className="mx-auto max-w-5xl">
            <ComplianceDisclaimer />
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <form onSubmit={handleMatch} className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
              <div className="flex items-start justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold">Grade 12 marks</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Leave a subject at 0 if you did not take it. Rename elective rows to the exact subject on your results statement.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="shrink-0 gap-2">
                  <RefreshCw className="h-4 w-4" /> Reset
                </Button>
              </div>

              <div className="space-y-3">
                {subjects.map((subject, index) => (
                  <div key={`${index}-${subject.locked ? subject.name : "editable"}`} className="grid grid-cols-[1fr_92px_auto] items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`subject-${index}`} className="text-xs text-muted-foreground">Subject {index + 1}</Label>
                      {subject.locked ? (
                        <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">{subject.name}</div>
                      ) : (
                        <Input
                          id={`subject-${index}`}
                          value={subject.name}
                          onChange={(event) => handleSubjectNameChange(index, event.target.value)}
                          placeholder="e.g. Agricultural Sciences"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`mark-${index}`} className="text-xs text-muted-foreground">Mark %</Label>
                      <Input
                        id={`mark-${index}`}
                        type="number"
                        min="0"
                        max="100"
                        value={subject.mark || ""}
                        onChange={(event) => handleMarkChange(index, event.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={Boolean(subject.locked) || subjects.length <= DEFAULT_SUBJECTS.length}
                      onClick={() => removeSubject(index)}
                      aria-label={`Remove subject ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addSubject} className="gap-2">
                <Plus className="h-4 w-4" /> Add another subject
              </Button>

              <div className="grid gap-4 rounded-xl border bg-muted/25 p-4 md:grid-cols-[1fr_160px] md:items-end">
                <div>
                  <Label htmlFor="aps" className="font-semibold">Estimated academic APS</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Prefilled from the six strongest non-Life-Orientation subjects. You can edit it if your official/known APS differs.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Input
                    id="aps"
                    type="number"
                    min="0"
                    max="60"
                    value={effectiveAPS || ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setApsOverride(value === "" ? null : Math.max(0, Math.min(60, Number.parseInt(value, 10) || 0)));
                      markResultsStale();
                    }}
                    className="text-center text-lg font-bold"
                  />
                  {apsOverride !== null && (
                    <button type="button" onClick={() => { setApsOverride(null); markResultsStale(); }} className="w-full text-center text-[11px] font-medium text-primary hover:underline">
                      Use mark estimate ({estimatedAPS})
                    </button>
                  )}
                </div>
              </div>

              {completedAcademicSubjects > 0 && completedAcademicSubjects < 6 && apsOverride === null && (
                <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Add all your academic subjects for a stronger APS estimate. Course Match will still use the APS shown above.
                </div>
              )}

              <Button type="submit" size="lg" disabled={isMatching} className="w-full gap-2 font-bold">
                {isMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isMatching ? "Checking live UNISA rules…" : "Run UNISA Course Match"}
              </Button>
            </form>

            <div className="space-y-5">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-bold">What the production matcher checks</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Current active UNISA matric-entry programmes only. Advanced Certificates and Advanced Diplomas are excluded from matric-only results because they require prior qualifications.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {["APS/AS minimum", "Required subjects", "Maths / Math Lit alternatives", "Science alternatives", "Selection requirements", "Conditional curriculum rules"].map((label) => (
                      <div key={label} className="flex items-center gap-2 rounded-lg border bg-background/70 p-2.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> {label}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {results === null ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="space-y-3 p-8 text-center">
                    <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                    <h3 className="font-bold">No Course Match run yet</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Enter your marks and run the matcher. Results come from the live verified UNISA Course Match rule set, not from a generic APS threshold.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Potential current matches</p>
                        <p className="mt-1 text-4xl font-black text-primary">{results.length}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>APS used: <strong className="text-foreground">{effectiveAPS}</strong></p>
                        {savedToProfile && <p className="mt-1 text-emerald-600">Saved to your profile</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border p-2"><strong className="block text-lg text-emerald-600">{resultCounts.eligible}</strong>Academic</div>
                      <div className="rounded-lg border p-2"><strong className="block text-lg text-amber-600">{resultCounts.selection}</strong>Selection</div>
                      <div className="rounded-lg border p-2"><strong className="block text-lg text-blue-600">{resultCounts.conditional}</strong>Conditional</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {results !== null && (
            <section className="mx-auto max-w-6xl space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold">Your UNISA Course Match results</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These are academic matches, not admission offers. UNISA still applies official verification, selection and space availability.
                  </p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search programme, code or college" className="pl-9" />
                </div>
              </div>

              {filteredResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-semibold">No matching results for this search.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredResults.slice(0, 60).map((result) => (
                    <article key={result.programme_id} className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-primary">{result.qualification_code}</p>
                          <h3 className="mt-1 font-bold leading-snug">{result.programme_name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{result.qualification_type}{result.faculty_or_school ? ` · ${result.faculty_or_school}` : ""}</p>
                        </div>
                        <div className="shrink-0 rounded-lg border bg-muted/25 px-3 py-2 text-center">
                          <span className="block text-[10px] uppercase text-muted-foreground">APS/AS</span>
                          <strong className="text-lg">{result.aps_required}</strong>
                        </div>
                      </div>

                      <div className={`mt-4 rounded-lg border px-3 py-2 text-xs font-semibold ${statusClass(result.match_status)}`}>
                        {STATUS_LABELS[result.match_status]}
                      </div>

                      {result.match_status === "academic_minimum_selection_required" && result.selection_rules.length > 0 && (
                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {result.selection_rules.slice(0, 2).map((rule, index) => (
                            <p key={`${result.programme_id}-selection-${index}`}><strong className="text-foreground">{rule.label || "Selection requirement"}:</strong> {rule.detail}</p>
                          ))}
                        </div>
                      )}

                      {result.match_status === "eligible_with_conditional_curriculum_check" && (
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          Your core academic minimum is compatible, but the selected curriculum or module route has an additional condition that must be confirmed before application.
                        </p>
                      )}

                      {result.official_url && (
                        <a href={result.official_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                          Verify on official UNISA page <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {filteredResults.length > 60 && (
                <p className="text-center text-xs text-muted-foreground">
                  Showing the first 60 of {filteredResults.length} results. Use search to narrow the list.
                </p>
              )}
            </section>
          )}

          <div className="mx-auto flex max-w-6xl gap-3 rounded-xl border border-primary/20 bg-muted/35 p-4 text-xs leading-relaxed text-muted-foreground">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <strong className="text-foreground">Important:</strong> Course Match checks published academic minimums. Final UNISA admission depends on official verification, the application period, available space and any programme-specific selection process. The APS shown here is an academic estimate and can be edited before matching.
              <div className="mt-2">
                <Button asChild variant="link" className="h-auto p-0 text-xs font-bold">
                  <Link to="/get-started?persona=applicant&need=application_support">Get guided application support</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default ApplicationsChecker;
