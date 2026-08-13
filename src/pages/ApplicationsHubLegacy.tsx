import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Landmark,
  Loader2,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CourseMatchInstitution,
  CourseMatchStatus,
  CourseMatchSubject,
  InstitutionCourseMatchResult,
  estimateAcademicAps,
  runCourseMatchAcross,
} from "@/lib/courseMatch";

type HubCategory = "university" | "tvet" | "private_college";
type MatcherChoice = CourseMatchInstitution | "all";
type MatchFilter = "all" | "matches" | "selection" | "conditional" | "not_eligible";

type HubInstitution = {
  id: string;
  institution_id: string | null;
  slug: string;
  category: HubCategory;
  short_name: string;
  display_name: string;
  city: string;
  province: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  application_url: string | null;
  official_url: string | null;
  matcher_key: CourseMatchInstitution | null;
  matcher_enabled: boolean;
  featured: boolean;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
};

const CATEGORY_TABS: Array<{
  key: HubCategory;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}> = [
  {
    key: "university",
    label: "Universities",
    description: "TUT, UP and UNISA Course Match",
    icon: Landmark,
  },
  {
    key: "tvet",
    label: "TVET Colleges",
    description: "Verified Pretoria-region TVET routes",
    icon: GraduationCap,
  },
  {
    key: "private_college",
    label: "Private Colleges",
    description: "Verified private providers as they are added",
    icon: Building2,
  },
];

const DEFAULT_SUBJECTS: CourseMatchSubject[] = [
  { name: "English Home Language", mark: 0 },
  { name: "Mathematics", mark: 0 },
  { name: "Mathematical Literacy", mark: 0 },
  { name: "Physical Sciences", mark: 0 },
  { name: "Life Sciences", mark: 0 },
  { name: "Accounting", mark: 0 },
  { name: "Business Studies", mark: 0 },
];

const STATUS_COPY: Record<CourseMatchStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  eligible: {
    label: "Published minimums met",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  academic_minimum_selection_required: {
    label: "Minimums met • selection applies",
    tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    icon: ShieldCheck,
  },
  eligible_with_conditional_curriculum_check: {
    label: "Potential match • condition check",
    tone: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    icon: AlertCircle,
  },
  not_eligible_aps: {
    label: "APS below minimum",
    tone: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    icon: XCircle,
  },
  not_eligible_subject: {
    label: "Subject requirement missing",
    tone: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    icon: XCircle,
  },
};

const categoryFromQuery = (value: string | null): HubCategory => {
  if (value === "tvet") return "tvet";
  if (value === "private" || value === "private_college") return "private_college";
  return "university";
};

const safeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const requirementLabel = (requirement: Record<string, unknown>): string => {
  const type = String(requirement.type ?? "");
  if (type === "aps") {
    const actual = safeNumber(requirement.actual);
    const required = safeNumber(requirement.required);
    return actual === null || required === null ? "APS requirement" : `APS ${actual} / ${required} required`;
  }
  if (type === "subject" || type === "conditional") {
    const subject = String(requirement.subject ?? "Subject");
    const minimum = safeNumber(requirement.minimum_percentage);
    return minimum === null ? subject : `${subject} ${minimum}%+`;
  }
  if (type === "alternative_group") {
    const key = String(requirement.group_key ?? "alternative subject").replace(/_/g, " ");
    return `One option required: ${key}`;
  }
  const raw = requirement.raw_requirement;
  return typeof raw === "string" && raw.trim() ? raw : "Additional requirement";
};

const matcherSort = (status: CourseMatchStatus): number => {
  if (status === "eligible") return 1;
  if (status === "academic_minimum_selection_required") return 2;
  if (status === "eligible_with_conditional_curriculum_check") return 3;
  if (status === "not_eligible_subject") return 4;
  return 5;
};

const ApplicationsHub = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<HubCategory>(() => categoryFromQuery(searchParams.get("category")));
  const [institutions, setInstitutions] = useState<HubInstitution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [selectedMatcher, setSelectedMatcher] = useState<MatcherChoice>(() => {
    const requested = searchParams.get("institution");
    return requested === "tut" || requested === "up" || requested === "unisa" ? requested : "all";
  });
  const [scoreMode, setScoreMode] = useState<"aps" | "marks">("aps");
  const [apsValue, setApsValue] = useState("24");
  const [subjects, setSubjects] = useState<CourseMatchSubject[]>(DEFAULT_SUBJECTS);
  const [results, setResults] = useState<InstitutionCourseMatchResult[]>([]);
  const [matching, setMatching] = useState(false);
  const [hasMatched, setHasMatched] = useState(false);
  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [institutionFilter, setInstitutionFilter] = useState<"all" | CourseMatchInstitution>("all");
  const [visibleCount, setVisibleCount] = useState(40);

  const [helpName, setHelpName] = useState("");
  const [helpPhone, setHelpPhone] = useState("");
  const [helpEmail, setHelpEmail] = useState("");
  const [helpDate, setHelpDate] = useState("");
  const [helpTime, setHelpTime] = useState("");
  const [helpConsent, setHelpConsent] = useState(false);
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpInstitutionOverride, setHelpInstitutionOverride] = useState<string | null>(null);

  useEffect(() => {
    const loadInstitutions = async () => {
      setInstitutionsLoading(true);
      const { data, error } = await (supabase as any)
        .from("application_hub_institutions")
        .select("*")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) {
        toast.error("Could not load the verified institution directory");
      } else {
        setInstitutions((data ?? []) as HubInstitution[]);
      }
      setInstitutionsLoading(false);
    };
    loadInstitutions();
  }, []);

  const estimatedAps = useMemo(() => estimateAcademicAps(subjects), [subjects]);
  const usableSubjects = useMemo(
    () => subjects.filter((subject) => subject.name.trim() && subject.mark > 0),
    [subjects],
  );

  useEffect(() => {
    if (scoreMode === "marks") setApsValue(String(estimatedAps));
  }, [estimatedAps, scoreMode]);

  const categoryInstitutions = useMemo(
    () => institutions.filter((institution) => institution.category === category && institution.is_active),
    [category, institutions],
  );

  const universityConfigs = useMemo(
    () => institutions.filter((institution) => institution.category === "university" && institution.matcher_key),
    [institutions],
  );

  const configByMatcher = useMemo(() => {
    const map = new Map<CourseMatchInstitution, HubInstitution>();
    universityConfigs.forEach((institution) => {
      if (institution.matcher_key) map.set(institution.matcher_key, institution);
    });
    return map;
  }, [universityConfigs]);

  const selectedUniversityLabel = useMemo(() => {
    if (helpInstitutionOverride) return helpInstitutionOverride;
    if (category !== "university") {
      return category === "tvet" ? "Pretoria TVET college application" : "Pretoria private college application";
    }
    if (selectedMatcher === "all") return "Compare all Pretoria universities";
    return configByMatcher.get(selectedMatcher)?.display_name ?? selectedMatcher.toUpperCase();
  }, [category, configByMatcher, helpInstitutionOverride, selectedMatcher]);

  const setCategoryAndQuery = (next: HubCategory) => {
    setCategory(next);
    setHelpInstitutionOverride(null);
    const queryCategory = next === "private_college" ? "private" : next;
    setSearchParams({ category: queryCategory }, { replace: true });
    if (next === "university") setSelectedMatcher("all");
  };

  const chooseMatcher = (matcher: MatcherChoice) => {
    setSelectedMatcher(matcher);
    setCategory("university");
    setHelpInstitutionOverride(null);
    setHasMatched(false);
    setResults([]);
    setSearchParams(
      matcher === "all" ? { category: "university" } : { category: "university", institution: matcher },
      { replace: true },
    );
    window.setTimeout(() => document.getElementById("course-match")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const updateSubject = (index: number, patch: Partial<CourseMatchSubject>) => {
    setSubjects((current) => current.map((subject, subjectIndex) => (subjectIndex === index ? { ...subject, ...patch } : subject)));
  };

  const addSubject = () => setSubjects((current) => [...current, { name: "", mark: 0 }]);
  const removeSubject = (index: number) => setSubjects((current) => current.filter((_, subjectIndex) => subjectIndex !== index));

  const runMatcher = async () => {
    const aps = Number(apsValue);
    if (!Number.isFinite(aps) || aps < 0 || aps > 100) {
      toast.error("Enter a valid APS / selection score between 0 and 100");
      return;
    }
    if (scoreMode === "marks" && usableSubjects.length === 0) {
      toast.error("Add your subject marks before calculating your matches");
      return;
    }

    const targetInstitutions: CourseMatchInstitution[] =
      selectedMatcher === "all" ? ["tut", "up", "unisa"] : [selectedMatcher];

    setMatching(true);
    try {
      const rows = await runCourseMatchAcross(targetInstitutions, aps, usableSubjects, true);
      setResults(
        [...rows].sort((a, b) => {
          const statusDelta = matcherSort(a.match_status) - matcherSort(b.match_status);
          if (statusDelta !== 0) return statusDelta;
          if (a.institution !== b.institution) return a.institution.localeCompare(b.institution);
          return a.aps_required - b.aps_required || a.programme_name.localeCompare(b.programme_name);
        }),
      );
      setHasMatched(true);
      setMatchFilter("all");
      setInstitutionFilter("all");
      setVisibleCount(40);
      toast.success(`Course Match checked ${rows.length} programme routes`);
      window.setTimeout(() => document.getElementById("match-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error: any) {
      console.error("Course Match failed", error);
      toast.error(error?.message ?? "Course Match could not be completed");
    } finally {
      setMatching(false);
    }
  };

  const summary = useMemo(() => {
    return results.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.match_status === "eligible") acc.eligible += 1;
        else if (row.match_status === "academic_minimum_selection_required") acc.selection += 1;
        else if (row.match_status === "eligible_with_conditional_curriculum_check") acc.conditional += 1;
        else acc.notEligible += 1;
        return acc;
      },
      { total: 0, eligible: 0, selection: 0, conditional: 0, notEligible: 0 },
    );
  }, [results]);

  const filteredResults = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return results.filter((row) => {
      if (institutionFilter !== "all" && row.institution !== institutionFilter) return false;
      if (normalizedSearch) {
        const haystack = `${row.programme_name} ${row.qualification_code} ${row.qualification_type} ${row.faculty_or_school ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      if (matchFilter === "matches") {
        return row.match_status === "eligible" || row.match_status === "academic_minimum_selection_required" || row.match_status === "eligible_with_conditional_curriculum_check";
      }
      if (matchFilter === "selection") return row.match_status === "academic_minimum_selection_required";
      if (matchFilter === "conditional") return row.match_status === "eligible_with_conditional_curriculum_check";
      if (matchFilter === "not_eligible") return row.match_status === "not_eligible_aps" || row.match_status === "not_eligible_subject";
      return true;
    });
  }, [institutionFilter, matchFilter, results, search]);

  useEffect(() => setVisibleCount(40), [institutionFilter, matchFilter, search]);

  const requestLiveHelp = async () => {
    if (!helpName.trim() || !helpPhone.trim()) {
      toast.error("Your name and phone / WhatsApp number are required");
      return;
    }
    if (!helpConsent) {
      toast.error("Please confirm that ResKonnect may contact you about this request");
      return;
    }

    setHelpSubmitting(true);
    const aps = Number(apsValue);
    const { error } = await (supabase as any).from("application_support_queries").insert({
      user_id: user?.id ?? null,
      full_name: helpName.trim(),
      phone: helpPhone.trim(),
      whatsapp_number: helpPhone.trim(),
      email: helpEmail.trim() || null,
      institution_type: category,
      preferred_institution: selectedUniversityLabel,
      highest_grade: "Grade 12 / NSC",
      grade_context: "ResKonnect Applications Hub — Pretoria",
      subject_marks: {
        aps: Number.isFinite(aps) ? aps : null,
        subjects: usableSubjects,
      },
      status: "new",
      source_page: "applications_hub",
      consent_to_be_contacted: true,
      popia_consent: true,
      metadata: {
        service_type: "live_application_call",
        service_fee_zar: 50,
        guidance_is_free: true,
        fee_scope: "live_application_guidance_call_only",
        preferred_call_date: helpDate || null,
        preferred_call_time: helpTime || null,
        selected_matcher: category === "university" ? selectedMatcher : null,
        submitted_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Live help request failed", error);
      toast.error("Your live-help request could not be submitted");
    } else {
      toast.success("Live application call request submitted");
      setHelpDate("");
      setHelpTime("");
      setHelpConsent(false);
    }
    setHelpSubmitting(false);
  };

  const renderInstitutionCard = (institution: HubInstitution) => {
    const isSelected = institution.matcher_key && selectedMatcher === institution.matcher_key;
    const primary = institution.brand_primary ?? "#4454A6";
    return (
      <Card
        key={institution.id}
        className={`group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? "ring-2 ring-primary" : ""}`}
      >
        <div className="h-24 relative overflow-hidden bg-muted">
          {institution.cover_image_url ? (
            <img src={institution.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-between px-5 text-white"
              style={{ background: `linear-gradient(120deg, ${primary}, ${institution.brand_secondary ?? primary})` }}
            >
              <span className="text-3xl font-black tracking-tight">{institution.short_name}</span>
              <GraduationCap className="h-10 w-10 opacity-30" />
            </div>
          )}
          {institution.logo_url && (
            <div className="absolute left-4 bottom-3 rounded-xl bg-white/95 p-2 shadow-sm">
              <img src={institution.logo_url} alt={`${institution.display_name} logo`} className="h-10 w-16 object-contain" />
            </div>
          )}
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold leading-tight">{institution.display_name}</h3>
              {institution.matcher_enabled ? (
                <Badge variant="outline" className="shrink-0 text-[10px]">Course Match</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 text-[10px]">Direct apply</Badge>
              )}
            </div>
            <p className="text-xs leading-5 text-muted-foreground line-clamp-3">{institution.description}</p>
          </div>

          {institution.matcher_enabled && institution.matcher_key ? (
            <Button className="w-full" onClick={() => chooseMatcher(institution.matcher_key as CourseMatchInstitution)}>
              Check {institution.short_name} courses <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : institution.application_url ? (
            <Button className="w-full" variant="outline" asChild>
              <a href={institution.application_url} target="_blank" rel="noreferrer">
                Official application route <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>Application route pending</Button>
          )}
          <button
            type="button"
            className="w-full text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setHelpInstitutionOverride(institution.display_name);
              document.getElementById("live-help")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Need someone to apply with you? Request a live call
          </button>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <SEO
        title="Pretoria University, TVET & College Applications | ResKonnect Course Match"
        description="Check your APS and subject marks against TUT, University of Pretoria and UNISA programme requirements, compare Pretoria options and continue to official application portals."
        keywords="TUT APS calculator, UP APS checker, UNISA Course Match, Pretoria university applications, TVET applications Pretoria"
      />

      <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))]">
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          <section className="rounded-3xl border bg-card/90 p-5 shadow-sm backdrop-blur sm:p-7 lg:p-9">
            <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full px-3 py-1">Applications • Pretoria</Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">2027 planning</Badge>
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    Know where you qualify before you apply.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Enter your APS or Grade 12 marks once. ResKonnect checks the published programme minimums, shows what you meet, what is missing and sends you to the institution&apos;s official application route.
                  </p>
                </div>
              </div>
              <Button size="lg" variant="outline" className="rounded-full" onClick={() => chooseMatcher("all")}>
                <Sparkles className="mr-2 h-4 w-4" /> Compare all 3 universities
              </Button>
            </div>
          </section>

          <section className="mt-5 grid gap-3 md:grid-cols-3">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = category === tab.key;
              const count = institutions.filter((institution) => institution.category === tab.key && institution.is_active).length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategoryAndQuery(tab.key)}
                  className={`rounded-2xl border p-4 text-left transition-all ${active ? "border-primary bg-primary/10 shadow-sm" : "bg-card hover:border-primary/50 hover:shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold">{tab.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{tab.description}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full">{count}</Badge>
                  </div>
                </button>
              );
            })}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pretoria first</p>
                    <h2 className="mt-1 text-2xl font-black">
                      {category === "university" ? "Choose a university" : category === "tvet" ? "TVET colleges" : "Private colleges"}
                    </h2>
                  </div>
                  {category === "university" && (
                    <button
                      type="button"
                      onClick={() => chooseMatcher("all")}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedMatcher === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
                    >
                      Compare TUT + UP + UNISA
                    </button>
                  )}
                </div>

                {institutionsLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border bg-card" />)}
                  </div>
                ) : categoryInstitutions.length > 0 ? (
                  <div className={`grid gap-4 ${category === "university" ? "md:grid-cols-2 2xl:grid-cols-3" : "md:grid-cols-2"}`}>
                    {categoryInstitutions.map(renderInstitutionCard)}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center">
                      <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                      <h3 className="mt-4 text-lg font-bold">Verified providers are being added</h3>
                      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                        ResKonnect will not fill this directory with unverified providers just to make the list look complete. Pretoria private colleges will appear here as each provider and application route is verified.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {category === "university" && (
                <section id="course-match" className="scroll-mt-6 space-y-5">
                  <Card className="overflow-hidden">
                    <div className="border-b bg-muted/40 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Course Match</p>
                          <h2 className="mt-1 text-xl font-black">
                            {selectedMatcher === "all" ? "Compare all Pretoria universities" : `Check ${configByMatcher.get(selectedMatcher)?.short_name ?? selectedMatcher.toUpperCase()}`}
                          </h2>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">Guidance is free</Badge>
                      </div>
                    </div>
                    <CardContent className="p-5 sm:p-6">
                      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                            <button
                              type="button"
                              onClick={() => setScoreMode("aps")}
                              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${scoreMode === "aps" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                            >
                              I know my APS
                            </button>
                            <button
                              type="button"
                              onClick={() => setScoreMode("marks")}
                              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${scoreMode === "marks" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                            >
                              Calculate from marks
                            </button>
                          </div>

                          <div className="rounded-2xl border bg-card p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Calculator className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">APS / selection score used</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={apsValue}
                                    onChange={(event) => setApsValue(event.target.value)}
                                    className="h-10 w-24 text-lg font-black"
                                  />
                                  {scoreMode === "marks" && <Badge variant="secondary">Calculated</Badge>}
                                </div>
                              </div>
                            </div>
                            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                              The marks calculator is guidance only. Institution-specific APS, ranking and selection rules still control final admission.
                            </p>
                          </div>

                          <Button size="lg" className="w-full" onClick={runMatcher} disabled={matching}>
                            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            {matching ? "Checking programmes…" : "Check what I qualify for"}
                          </Button>
                        </div>

                        <div>
                          {scoreMode === "marks" ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-bold">Your Grade 12 subjects</p>
                                  <p className="text-xs text-muted-foreground">Only fill subjects you actually take. Add another subject if needed.</p>
                                </div>
                                <Badge variant="outline">Estimated APS {estimatedAps}</Badge>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {subjects.map((subject, index) => (
                                  <div key={`${subject.name}-${index}`} className="flex items-center gap-2 rounded-xl border bg-muted/20 p-2">
                                    <Input
                                      value={subject.name}
                                      onChange={(event) => updateSubject(index, { name: event.target.value })}
                                      placeholder="Subject"
                                      className="h-9 min-w-0 flex-1 bg-background"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={subject.mark || ""}
                                      onChange={(event) => updateSubject(index, { mark: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                                      placeholder="%"
                                      className="h-9 w-20 bg-background"
                                    />
                                    {index >= DEFAULT_SUBJECTS.length && (
                                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSubject(index)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <Button variant="outline" size="sm" onClick={addSubject}>
                                <Plus className="mr-2 h-4 w-4" /> Add another subject
                              </Button>
                            </div>
                          ) : (
                            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
                              <div className="max-w-md">
                                <Calculator className="mx-auto h-10 w-10 text-primary" />
                                <h3 className="mt-4 font-bold">Already know your APS?</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Enter it on the left and run Course Match. Add your subject marks when you want subject-level checks to be more precise.
                                </p>
                                <button type="button" className="mt-3 text-sm font-semibold text-primary hover:underline" onClick={() => setScoreMode("marks")}>
                                  I want to enter my marks instead
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {(selectedMatcher === "tut" || selectedMatcher === "all") && (
                        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          <strong>TUT verification guard:</strong> TUT matches are intentionally labelled as minimums met / selection applies. ResKonnect does not present the current captured TUT route as a guaranteed final eligibility decision; TUT&apos;s official verification, programme capacity and selection still apply.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>
              )}

              {category === "university" && hasMatched && (
                <section id="match-results" className="scroll-mt-6 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      ["Programmes checked", summary.total, ""],
                      ["Minimums met", summary.eligible, "matches"],
                      ["Selection applies", summary.selection, "selection"],
                      ["Condition check", summary.conditional, "conditional"],
                      ["Not currently met", summary.notEligible, "not_eligible"],
                    ].map(([label, value, filter]) => (
                      <button
                        type="button"
                        key={String(label)}
                        onClick={() => setMatchFilter((filter || "all") as MatchFilter)}
                        className={`rounded-2xl border bg-card p-4 text-left transition hover:border-primary/60 ${matchFilter === (filter || "all") ? "ring-2 ring-primary/30" : ""}`}
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-2xl font-black">{value}</p>
                      </button>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="relative min-w-0 flex-1 xl:max-w-xl">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programme, code or faculty…" className="pl-9" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedMatcher === "all" && (
                            <select
                              value={institutionFilter}
                              onChange={(event) => setInstitutionFilter(event.target.value as "all" | CourseMatchInstitution)}
                              className="h-10 rounded-md border bg-background px-3 text-sm"
                            >
                              <option value="all">All universities</option>
                              <option value="tut">TUT</option>
                              <option value="up">UP</option>
                              <option value="unisa">UNISA</option>
                            </select>
                          )}
                          <select
                            value={matchFilter}
                            onChange={(event) => setMatchFilter(event.target.value as MatchFilter)}
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="all">All statuses</option>
                            <option value="matches">All potential matches</option>
                            <option value="selection">Selection required</option>
                            <option value="conditional">Condition check</option>
                            <option value="not_eligible">Not currently met</option>
                          </select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-collapse text-sm">
                        <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Institution</th>
                            <th className="px-4 py-3 font-semibold">Programme</th>
                            <th className="px-4 py-3 font-semibold">APS</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Requirements</th>
                            <th className="px-4 py-3 text-right font-semibold">Next step</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResults.slice(0, visibleCount).map((row) => {
                            const institution = configByMatcher.get(row.institution);
                            const status = STATUS_COPY[row.match_status];
                            const StatusIcon = status.icon;
                            const missing = row.missing_requirements ?? [];
                            return (
                              <tr key={`${row.institution}-${row.programme_id}`} className="border-t align-top hover:bg-muted/25">
                                <td className="px-4 py-4">
                                  <Badge variant="outline" className="font-bold">{institution?.short_name ?? row.institution.toUpperCase()}</Badge>
                                </td>
                                <td className="max-w-sm px-4 py-4">
                                  <p className="font-bold leading-5">{row.programme_name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{row.qualification_code} • {row.qualification_type}</p>
                                  {row.faculty_or_school && <p className="mt-1 text-xs text-muted-foreground">{row.faculty_or_school}</p>}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-lg font-black">{row.aps_required ?? "—"}</span>
                                  <p className="text-[10px] text-muted-foreground">minimum</p>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>
                                    <StatusIcon className="h-3.5 w-3.5 shrink-0" /> {status.label}
                                  </span>
                                </td>
                                <td className="max-w-sm px-4 py-4">
                                  {missing.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {missing.slice(0, 3).map((requirement, index) => (
                                        <p key={index} className="text-xs leading-4 text-rose-700 dark:text-rose-300">• {requirementLabel(requirement)}</p>
                                      ))}
                                      {missing.length > 3 && <p className="text-[11px] text-muted-foreground">+{missing.length - 3} more requirement checks</p>}
                                    </div>
                                  ) : row.selection_rules?.length ? (
                                    <p className="text-xs leading-4 text-muted-foreground">{row.selection_rules[0]?.label ?? "Institution selection / verification applies."}</p>
                                  ) : (
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300">No captured minimum requirement is missing.</p>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex justify-end gap-2">
                                    {row.official_url && (
                                      <Button size="sm" variant="ghost" asChild>
                                        <a href={row.official_url} target="_blank" rel="noreferrer" title="Official programme source">
                                          Source <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}
                                    {institution?.application_url && (
                                      <Button size="sm" asChild>
                                        <a href={institution.application_url} target="_blank" rel="noreferrer">
                                          Apply now <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filteredResults.slice(0, visibleCount).map((row) => {
                      const institution = configByMatcher.get(row.institution);
                      const status = STATUS_COPY[row.match_status];
                      const StatusIcon = status.icon;
                      const missing = row.missing_requirements ?? [];
                      return (
                        <Card key={`${row.institution}-${row.programme_id}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <Badge variant="outline">{institution?.short_name ?? row.institution.toUpperCase()}</Badge>
                                <h3 className="mt-2 font-bold leading-5">{row.programme_name}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">{row.qualification_code} • APS {row.aps_required}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>
                              <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                            </span>
                            {missing.length > 0 && (
                              <div className="rounded-xl bg-muted/50 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Missing / check</p>
                                {missing.slice(0, 3).map((requirement, index) => <p key={index} className="mt-1 text-xs">• {requirementLabel(requirement)}</p>)}
                              </div>
                            )}
                            <div className="flex gap-2">
                              {row.official_url && <Button variant="outline" size="sm" asChild><a href={row.official_url} target="_blank" rel="noreferrer">Source</a></Button>}
                              {institution?.application_url && <Button size="sm" className="flex-1" asChild><a href={institution.application_url} target="_blank" rel="noreferrer">Apply on {institution.short_name} <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {filteredResults.length === 0 && (
                    <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">No programmes match the current filters.</CardContent></Card>
                  )}
                  {filteredResults.length > visibleCount && (
                    <div className="text-center">
                      <Button variant="outline" onClick={() => setVisibleCount((count) => count + 40)}>
                        Show 40 more ({filteredResults.length - visibleCount} remaining)
                      </Button>
                    </div>
                  )}

                  <div className="rounded-2xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
                    <strong className="text-foreground">Important:</strong> Course Match compares the marks you entered with captured published minimum requirements. A match is not an admission offer. Final admission depends on official results, application timing, documents, ranking or selection, available space and the institution&apos;s own decision.
                  </div>
                </section>
              )}
            </div>

            <aside id="live-help" className="scroll-mt-6 xl:sticky xl:top-5 xl:self-start">
              <Card className="overflow-hidden border-primary/30 shadow-lg shadow-primary/5">
                <div className="bg-primary px-5 py-5 text-primary-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                      <PhoneCall className="h-5 w-5" />
                    </div>
                    <Badge className="bg-white text-primary hover:bg-white">R50 live call</Badge>
                  </div>
                  <h2 className="mt-4 text-xl font-black">Apply with a real person</h2>
                  <p className="mt-2 text-xs leading-5 text-primary-foreground/80">
                    Course Match and self-service guidance are free. The R50 service applies only when a ResKonnect guide calls you and stays with you while you complete the application live.
                  </p>
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Help requested for</p>
                    <p className="mt-1 text-sm font-semibold">{selectedUniversityLabel}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Full name *</label>
                    <Input value={helpName} onChange={(event) => setHelpName(event.target.value)} placeholder="Your full name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Phone / WhatsApp *</label>
                    <Input value={helpPhone} onChange={(event) => setHelpPhone(event.target.value)} placeholder="e.g. 071 234 5678" inputMode="tel" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Email</label>
                    <Input type="email" value={helpEmail} onChange={(event) => setHelpEmail(event.target.value)} placeholder="Optional" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Preferred date</label>
                      <Input type="date" value={helpDate} onChange={(event) => setHelpDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Time</label>
                      <Input type="time" value={helpTime} onChange={(event) => setHelpTime(event.target.value)} />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
                    <Checkbox checked={helpConsent} onCheckedChange={(checked) => setHelpConsent(checked === true)} className="mt-0.5" />
                    <span className="text-[11px] leading-4 text-muted-foreground">
                      I agree that ResKonnect may contact me about this application-support request. I understand the live assisted call costs R50 and the normal Course Match guidance remains free.
                    </span>
                  </label>

                  <Button className="w-full" size="lg" onClick={requestLiveHelp} disabled={helpSubmitting}>
                    {helpSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                    Request R50 live call
                  </Button>
                  <p className="text-center text-[10px] leading-4 text-muted-foreground">
                    This request does not itself submit an application to a university or college.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ApplicationsHub;