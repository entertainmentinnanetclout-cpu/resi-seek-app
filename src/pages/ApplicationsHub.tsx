import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ExternalLink, FileCheck2, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DocumentUploader from "@/components/DocumentUploader";

type InstitutionKey = "TUT" | "NSFAS_UNI" | "NSFAS_TVET" | "PRIVATE";

const CHECKLISTS: Record<InstitutionKey, { key: string; label: string; hint?: string }[]> = {
  TUT: [
    { key: "id_document", label: "Certified copy of ID / birth certificate" },
    { key: "matric_results", label: "Grade 12 final / latest results" },
    { key: "grade_11", label: "Grade 11 final results" },
    { key: "proof_residence", label: "Proof of residence (not older than 3 months)" },
    { key: "guardian_id", label: "Parent / guardian ID copy" },
    { key: "application_fee", label: "TUT application fee proof of payment" },
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
  ],
};

const TAB_LABELS: Record<InstitutionKey, string> = {
  TUT: "TUT",
  NSFAS_UNI: "NSFAS (University)",
  NSFAS_TVET: "NSFAS (TVET)",
  PRIVATE: "Private College",
};

const TAB_TO_KEY: Record<string, InstitutionKey> = {
  tut: "TUT",
  "nsfas-uni": "NSFAS_UNI",
  "nsfas-tvet": "NSFAS_TVET",
  private: "PRIVATE",
};

const APPLY_URLS: Record<InstitutionKey, string> = {
  TUT: "https://www.tut.ac.za/",
  NSFAS_UNI: "https://www.nsfas.org.za/content/how-to-apply.html",
  NSFAS_TVET: "https://www.nsfas.org.za/content/how-to-apply.html",
  PRIVATE: "https://www.google.com/search?q=private+college+south+africa+application",
};

const ApplicationsHub = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialTab = TAB_TO_KEY[params.get("tab") ?? ""] ?? "TUT";
  const [tab, setTab] = useState<InstitutionKey>(initialTab);
  const [checklists, setChecklists] = useState<Record<InstitutionKey, Record<string, boolean>>>({
    TUT: {},
    NSFAS_UNI: {},
    NSFAS_TVET: {},
    PRIVATE: {},
  });
  const [deadlines, setDeadlines] = useState<Record<string, any>>({});

  // Load deadlines
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "application_deadlines")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setDeadlines(data.value as any);
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
        const next: any = { TUT: {}, NSFAS_UNI: {}, NSFAS_TVET: {}, PRIVATE: {} };
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

  const currentItems = CHECKLISTS[tab];
  const currentChecked = checklists[tab] ?? {};
  const completed = useMemo(
    () => currentItems.filter((i) => currentChecked[i.key]).length,
    [currentItems, currentChecked],
  );
  const progressPct = Math.round((completed / currentItems.length) * 100);

  const deadlineKey =
    tab === "TUT" ? "tut_2026" : tab === "NSFAS_UNI" ? "nsfas_uni_2026" : tab === "NSFAS_TVET" ? "nsfas_tvet_2026" : null;
  const deadline = deadlineKey ? deadlines[deadlineKey] : null;

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
          <h1 className="text-3xl sm:text-4xl font-bold">Apply to your dream institution</h1>
          <p className="text-muted-foreground max-w-2xl">
            Prepare once, apply anywhere. Track exactly which documents you need for TUT, NSFAS (university and TVET) and private colleges — and keep your pack ready with ResKonnect.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTabAndUrl}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            {(Object.keys(TAB_LABELS) as InstitutionKey[]).map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs sm:text-sm">
                {TAB_LABELS[k]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TAB_LABELS) as InstitutionKey[]).map((k) => (
            <TabsContent key={k} value={k} className="space-y-4 mt-6">
              {/* Deadline banner */}
              {deadline && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{deadline.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {deadline.closes ? `Closes ${deadline.closes}` : "Rolling intake — check the official site"}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <a href={deadline.url || APPLY_URLS[k]} target="_blank" rel="noreferrer">
                        Apply <ExternalLink className="h-3 w-3" />
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
                          {completed} of {CHECKLISTS[k].length} ready ({progressPct}%)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {CHECKLISTS[k].map((item) => (
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
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ApplicationsHub;