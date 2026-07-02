import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarClock, ExternalLink, FileCheck2, GraduationCap, Landmark, School, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DocumentUploader from "@/components/DocumentUploader";

type InstitutionKey = "TUT" | "UNIVERSITY" | "TVET" | "NSFAS_UNI" | "NSFAS_TVET" | "PRIVATE";

type PathwayConfig = {
  label: string;
  title: string;
  description: string;
  deadlineKey?: string;
  applyUrl: string;
  cta: string;
  icon: typeof GraduationCap;
  checklist: { key: string; label: string; hint?: string }[];
};

const CHECKLISTS: Record<InstitutionKey, { key: string; label: string; hint?: string }[]> = {
  TUT: [
    { key: "id_document", label: "Certified copy of ID / birth certificate" },
    { key: "matric_results", label: "Grade 12 final / latest results" },
    { key: "grade_11", label: "Grade 11 final results" },
    { key: "proof_residence", label: "Proof of residence (not older than 3 months)" },
    { key: "guardian_id", label: "Parent / guardian ID copy" },
    { key: "application_fee", label: "TUT application fee proof of payment" },
  ],
  UNIVERSITY: [
    { key: "id_document", label: "Certified ID copy / birth certificate" },
    { key: "matric_results", label: "Grade 12 final results or latest academic transcript" },
    { key: "proof_residence", label: "Proof of residence" },
    { key: "guardian_id", label: "Parent / guardian ID copy where required" },
    { key: "application_fee", label: "Application fee proof where required" },
  ],
  TVET: [
    { key: "id_document", label: "Certified ID copy" },
    { key: "latest_results", label: "Latest school results / highest grade passed" },
    { key: "proof_residence", label: "Proof of residence" },
    { key: "guardian_id", label: "Parent / guardian ID copy if under 18" },
    { key: "course_choice", label: "Preferred programme and campus choice" },
  ],
  NSFAS_UNI: [
    { key: "id_document", label: "Copy of your ID (both sides)" },
    { key: "parents_id", label: "Parents / guardians ID copies" },
    { key: "proof_income", label: "Proof of household income (payslips / SASSA / affidavit)" },
    { key: "matric_results", label: "Latest school / university results" },
    { key: "consent_form", label: "Signed NSFAS consent form" },
    { key: "disability_form", label: "Disability annexure (if applicable)" },
  ],
  NSFAS_TVET: [
    { key: "id_document", label: "Copy of your ID" },
    { key: "college_proof", label: "TVET college acceptance / registration letter" },
    { key: "parents_id", label: "Parents / guardians ID copies" },
    { key: "proof_income", label: "Household income proof" },
    { key: "consent_form", label: "Signed NSFAS consent form" },
  ],
  PRIVATE: [
    { key: "id_document", label: "ID copy" },
    { key: "matric_results", label: "Highest qualification / results" },
    { key: "application_fee", label: "College application fee proof" },
    { key: "personal_statement", label: "Personal statement / motivation" },
    { key: "proof_funding", label: "Proof of funding / sponsor details where required" },
  ],
};

const PATHWAY_FALLBACKS: Record<InstitutionKey, PathwayConfig> = {
  TUT: {
    label: "TUT",
    title: "TUT applications",
    description: "Prepare for Tshwane University of Technology intake with the right documents ready before the closing date.",
    deadlineKey: "tut_2026",
    applyUrl: "https://www.tut.ac.za/",
    cta: "Open TUT",
    icon: GraduationCap,
    checklist: CHECKLISTS.TUT,
  },
  UNIVERSITY: {
    label: "All Universities",
    title: "University applications",
    description: "Use one document pack for UP, UNISA, UJ, Wits and other South African university applications.",
    deadlineKey: "universities_2026",
    applyUrl: "https://www.cao.ac.za/",
    cta: "View Options",
    icon: Landmark,
    checklist: CHECKLISTS.UNIVERSITY,
  },
  TVET: {
    label: "TVET / Colleges",
    title: "TVET and college applications",
    description: "Prepare for Tshwane North, Tshwane South, Ekurhuleni and private college intake windows.",
    deadlineKey: "tvet_2026",
    applyUrl: "https://www.tnc.edu.za/",
    cta: "Explore TVET",
    icon: School,
    checklist: CHECKLISTS.TVET,
  },
  NSFAS_UNI: {
    label: "NSFAS University",
    title: "NSFAS university funding",
    description: "Get your funding documents ready for university NSFAS applications and accommodation checks.",
    deadlineKey: "nsfas_uni_2026",
    applyUrl: "https://www.nsfas.org.za/content/how-to-apply.html",
    cta: "Open NSFAS",
    icon: FileCheck2,
    checklist: CHECKLISTS.NSFAS_UNI,
  },
  NSFAS_TVET: {
    label: "NSFAS TVET",
    title: "NSFAS TVET funding",
    description: "TVET funding windows differ by cycle. Keep your college proof and consent documents ready.",
    deadlineKey: "nsfas_tvet_2026",
    applyUrl: "https://www.nsfas.org.za/content/how-to-apply.html",
    cta: "Open NSFAS",
    icon: FileCheck2,
    checklist: CHECKLISTS.NSFAS_TVET,
  },
  PRIVATE: {
    label: "Private / General",
    title: "Private study and accommodation readiness",
    description: "Prepare documents for private colleges, general rentals and sponsor-funded accommodation applications.",
    applyUrl: "https://www.google.com/search?q=private+college+south+africa+application",
    cta: "Search Colleges",
    icon: Building2,
    checklist: CHECKLISTS.PRIVATE,
  },
};

const TAB_TO_KEY: Record<string, InstitutionKey> = {
  tut: "TUT",
  university: "UNIVERSITY",
  universities: "UNIVERSITY",
  tvet: "TVET",
  college: "TVET",
  "nsfas-uni": "NSFAS_UNI",
  nsfas_university: "NSFAS_UNI",
  "nsfas-tvet": "NSFAS_TVET",
  nsfas_tvet: "NSFAS_TVET",
  private: "PRIVATE",
};

const PATHWAY_KEYS = Object.keys(PATHWAY_FALLBACKS) as InstitutionKey[];

const ApplicationsHub = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialTab = TAB_TO_KEY[params.get("tab") ?? params.get("target") ?? ""] ?? "TUT";
  const [tab, setTab] = useState<InstitutionKey>(initialTab);
  const [checklists, setChecklists] = useState<Record<InstitutionKey, Record<string, boolean>>>(
    PATHWAY_KEYS.reduce((acc, key) => ({ ...acc, [key]: {} }), {} as Record<InstitutionKey, Record<string, boolean>>),
  );
  const [deadlines, setDeadlines] = useState<Record<string, any>>({});
  const [pathways, setPathways] = useState<Record<InstitutionKey, PathwayConfig>>(PATHWAY_FALLBACKS);

  // Load deadlines
  useEffect(() => {
    Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "application_deadlines").maybeSingle(),
      supabase.from("platform_settings").select("value").eq("key", "application_pathways").maybeSingle(),
    ]).then(([deadlineRes, pathwayRes]) => {
      if (deadlineRes.data?.value) setDeadlines(deadlineRes.data.value as any);
      const remotePathways = pathwayRes.data?.value as Record<string, Partial<PathwayConfig>> | null;
      if (remotePathways) {
        setPathways((prev) =>
          PATHWAY_KEYS.reduce((acc, key) => {
            const remote = remotePathways[key] ?? remotePathways[key.toLowerCase()];
            acc[key] = {
              ...prev[key],
              ...remote,
              icon: prev[key].icon,
              checklist: Array.isArray(remote?.checklist) && remote.checklist.length > 0 ? remote.checklist : prev[key].checklist,
            };
            return acc;
          }, {} as Record<InstitutionKey, PathwayConfig>),
        );
      }
    });
  }, []);

  // Load user's prep state
  useEffect(() => {
    if (!user) return;
    supabase
      .from("application_prep" as any)
      .select("institution, checklist")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const next: any = PATHWAY_KEYS.reduce((acc, key) => ({ ...acc, [key]: {} }), {});
        for (const row of data as any[]) {
          if (next[row.institution]) next[row.institution] = row.checklist ?? {};
        }
        setChecklists(next);
      });
  }, [user]);

  const setTabAndUrl = (v: string) => {
    const key = v as InstitutionKey;
    setTab(key);
    const urlTab = Object.entries(TAB_TO_KEY).find(([, val]) => val === key)?.[0];
    if (urlTab) setParams({ tab: urlTab }, { replace: true });
  };

  const toggleItem = async (item: string, checked: boolean) => {
    if (!user) {
      toast.error("Please sign in to save your progress");
      return;
    }
    const nextChecklist = { ...(checklists[tab] ?? {}), [item]: checked };
    setChecklists((prev) => ({ ...prev, [tab]: nextChecklist }));
    const { error } = await supabase
      .from("application_prep" as any)
      .upsert(
        { user_id: user.id, institution: tab, checklist: nextChecklist },
        { onConflict: "user_id,institution" },
      );
    if (error) toast.error("Could not save progress");
  };

  const currentPathway = pathways[tab];
  const currentItems = currentPathway.checklist;
  const currentChecked = checklists[tab] ?? {};
  const completed = useMemo(
    () => currentItems.filter((i) => currentChecked[i.key]).length,
    [currentItems, currentChecked],
  );
  const progressPct = currentItems.length > 0 ? Math.round((completed / currentItems.length) * 100) : 0;

  const deadline = currentPathway.deadlineKey ? deadlines[currentPathway.deadlineKey] : null;

  return (
    <DashboardLayout>
      <SEO
        title="Apply to TUT, NSFAS & TVET Colleges | ResKonnect Applications Hub"
        description="Everything you need to apply — required documents, deadlines and a single place to hold your application pack for TUT, NSFAS (university and TVET) and private colleges."
        keywords="TUT application, NSFAS TVET application, NSFAS 2026, TVET college application, university application South Africa"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Applications Hub</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold">Applications for every pathway</h1>
          <p className="text-muted-foreground max-w-2xl">
            Prepare once, apply anywhere. Track exactly which documents you need for TUT, all universities, TVET colleges, NSFAS and private applications — and keep your pack ready with ResKonnect.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PATHWAY_KEYS.map((key) => {
            const pathway = pathways[key];
            const Icon = pathway.icon;
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTabAndUrl(key)}
                className={`rounded-xl border p-4 text-left transition-all ${isActive ? "border-primary bg-primary/10 shadow-md" : "bg-card hover:border-primary/60 hover:shadow-sm"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{pathway.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pathway.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Tabs value={tab} onValueChange={setTabAndUrl}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto">
            {PATHWAY_KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs sm:text-sm">
                {pathways[k].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PATHWAY_KEYS.map((k) => {
            const pathway = pathways[k];
            const pathwayDeadline = pathway.deadlineKey ? deadlines[pathway.deadlineKey] : null;
            return (
            <TabsContent key={k} value={k} className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{pathway.title}</CardTitle>
                  <CardDescription>{pathway.description}</CardDescription>
                </CardHeader>
              </Card>

              {/* Deadline banner */}
              {pathwayDeadline && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{pathwayDeadline.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {pathwayDeadline.closes ? `Closes ${pathwayDeadline.closes}` : "Rolling intake — check the official site"}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <a href={pathwayDeadline.url || pathway.applyUrl} target="_blank" rel="noreferrer">
                        {pathway.cta} <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Checklist */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileCheck2 className="h-5 w-5" /> Document checklist
                        </CardTitle>
                        <CardDescription>
                          {k === tab ? completed : Object.values(checklists[k] ?? {}).filter(Boolean).length} of {pathway.checklist.length} ready {k === tab ? `(${progressPct}%)` : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pathway.checklist.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={!!(checklists[k] ?? {})[item.key]}
                          onCheckedChange={(v) => toggleItem(item.key, !!v)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.hint && <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>}
                        </div>
                      </label>
                    ))}
                  </CardContent>
                </Card>

                {/* Uploader */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UploadCloud className="h-5 w-5" /> Store your pack with us
                    </CardTitle>
                    <CardDescription>
                      Upload documents once — we'll hold them securely for future applications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {user ? (
                      <DocumentUploader />
                    ) : (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        Sign in to upload and save your application pack.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ApplicationsHub;