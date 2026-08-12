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
  CourseMatchInstitution,
  CourseMatchResult,
  CourseMatchSubject,
  estimateAcademicAps,
  runCourseMatch,
  saveCourseMatch,
} from "@/lib/courseMatch";

interface SubjectRow extends CourseMatchSubject {
  locked?: boolean;
}

const DEFAULT_SUBJECTS: SubjectRow[] = [
  { name: "English Home Language / First Additional Language", mark: 0, locked: true },
  { name: "Second language", mark: 0 },
  { name: "Mathematics", mark: 0, locked: true },
  { name: "Mathematical Literacy", mark: 0, locked: true },
  { name: "Life Orientation", mark: 0, locked: true },
  { name: "Life Sciences", mark: 0 },
  { name: "Physical Sciences", mark: 0 },
  { name: "Accounting", mark: 0 },
  { name: "Elective Subject", mark: 0 },
];

const INSTITUTIONS: Record<CourseMatchInstitution, {
  shortName: string;
  name: string;
  candidateCount: number;
  button: string;
  description: string;
  scope: string;
}> = {
  unisa: {
    shortName: "UNISA",
    name: "University of South Africa",
    candidateCount: 381,
    button: "UNISA",
    description: "Current verified UNISA undergraduate matric-entry rules.",
    scope: "Advanced Certificates and Advanced Diplomas are excluded from Grade 12 matching because they require prior qualifications.",
  },
  up: {
    shortName: "UP",
    name: "University of Pretoria",
    candidateCount: 127,
    button: "University of Pretoria",
    description: "Verified 2027 UP NSC/IEB undergraduate requirements.",
    scope: "The international non-Umalusi prospectus is a separate admissions route and is not mixed into this NSC/IEB matcher.",
  },
};

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
  const [institution, setInstitution] = useState<CourseMatchInstitution>("unisa");
  const [subjects, setSubjects] = useState<SubjectRow[]>(DEFAULT_SUBJECTS);
  const [apsOverride, setApsOverride] = useState<number | null>(null);
  const [results, setResults] = useState<CourseMatchResult[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [savedToProfile, setSavedToProfile] = useState(false);

  const config = INSTITUTIONS[institution];
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

  const changeInstitution = (next: CourseMatchInstitution) => {
    setInstitution(next);
    setApsOverride(null);
    markResultsStale();
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
    markResultsStale();
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
      const matched = await runCourseMatch(institution, effectiveAPS, submittedSubjects, false);
      setResults(matched);

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        try {
          const profileId = await saveCourseMatch(
            institution,
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
        toast.success(`${matched.length} current ${config.shortName} programme matches found.`);
      } else {
        toast.info(`No current ${config.shortName} academic matches were found for the marks entered.`);
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
        title="Course Match | UNISA & University of Pretoria"
        description="Match Grade 12 marks against verified undergraduate APS and subject requirements from UNISA and the University of Pretoria."
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-12 md:py-20">
        <div className="container mx-auto space-y-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ResKonnect Course Match</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Match your marks to verified university programmes</h1>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Choose an institution, enter your Grade 12 subjects and marks, then check APS, subject alternatives, selection rules and conditional curriculum requirements.
            </p>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(INSTITUTIONS) as CourseMatchInstitution[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={institution === key ? "default" : "ghost"}
                  className="h-auto min-h-12 whitespace-normal py-3"
                  onClick={() => changeInstitution(key)}
                >
                  {INSTITUTIONS[key].button}
                </Button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-5xl">
            <ComplianceDisclaimer />
          </div>

          {institution === "up" && (
            <div className="mx-auto flex max-w-5xl gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p>
                <strong className="text-foreground">UP route:</strong> this matcher uses the 2027 NSC/IEB requirements. Applicants with Cambridge, IB, SAT or another school-leaving certificate not issued by Umalusi follow UP&apos;s separate international admission route and conversion rules.
              </p>
            </div>
          )}

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <form onSubmit={handleMatch} className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
              <div className="flex items-start justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold">Grade 12 marks</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Leave subjects you did not take at 0. If you took Mathematics, normally leave Mathematical Literacy at 0, and vice versa.
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
                        <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">{subject.name}</div>
                      ) : (
                        <Input
                          id={`subject-${index}`}
                          value={subject.name}
                          onChange={(event) => handleSubjectNameChange(index, event.target.value)}
                          placeholder="e.g. Music"
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

              {institution === "up" && (
                <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                  Music applicants using an accepted external practical/theory qualification can add a subject named <strong>Music theory/practical equivalent</strong> and enter a positive value to flag that route. UP&apos;s audition and theory selection still applies.
                </p>
              )}

              <div className="grid gap-4 rounded-xl border bg-muted/25 p-4 md:grid-cols-[1fr_160px] md:items-end">
                <div>
                  <Label htmlFor="aps" className="font-semibold">Estimated academic APS</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Prefilled from the six strongest non-Life-Orientation subjects. Edit it if your verified or institution-calculated APS differs.
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
                {isMatching ? `Checking live ${config.shortName} rules…` : `Run ${config.shortName} Course Match`}
              </Button>
            </form>

            <div className="space-y-5">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-bold">{config.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{config.scope}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-3 text-center">
                    <strong className="block text-3xl text-primary">{config.candidateCount}</strong>
                    <span className="text-xs text-muted-foreground">current Grade 12 matcher routes</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {["APS minimum", "Required subjects", "Alternative subjects", "Selection requirements", "Conditional rules", "Official-source verification"].map((label) => (
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
                      Results come from the selected institution&apos;s verified rule graph, not a generic APS threshold.
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
                  <h2 className="text-2xl font-extrabold">Your {config.shortName} Course Match results</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These are academic matches, not admission offers. Official verification, ranking, space and programme selection can still apply.
                  </p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search programme, code or faculty" className="pl-9" />
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
                          <span className="block text-[10px] uppercase text-muted-foreground">APS</span>
                          <strong className="text-lg">{result.aps_required}</strong>
                        </div>
                      </div>

                      <div className={`mt-4 rounded-lg border px-3 py-2 text-xs font-semibold ${statusClass(result.match_status)}`}>
                        {STATUS_LABELS[result.match_status]}
                      </div>

                      {result.match_status === "academic_minimum_selection_required" && result.selection_rules.length > 0 && (
                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {result.selection_rules.slice(0, 3).map((rule, index) => (
                            <p key={`${result.programme_id}-selection-${index}`}><strong className="text-foreground">{rule.label || "Selection requirement"}:</strong> {rule.detail}</p>
                          ))}
                        </div>
                      )}

                      {result.match_status === "eligible_with_conditional_curriculum_check" && (
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          Your core academic minimum is compatible, but a curriculum, elective or module-specific condition still needs confirmation.
                        </p>
                      )}

                      {result.official_url && (
                        <a href={result.official_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                          Verify on official {config.shortName} source <ExternalLink className="h-3.5 w-3.5" />
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
              <strong className="text-foreground">Important:</strong> Course Match is guidance based on published academic minimums and modelled selection conditions. Final admission is controlled by the institution and can depend on official verification, ranking, space, application timing and additional selection.
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
