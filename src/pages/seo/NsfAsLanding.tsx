import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import PublicLayout from "@/components/PublicLayout";
import AccreditationStatusBadge, { type AccreditationStatus } from "@/components/accommodation/AccreditationStatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { GOVERNANCE_NOTICES } from "@/lib/compliance/nsfasStandards";
import { Bed, Building2, CheckCircle2, FileCheck2, MapPin, ShieldCheck, WalletCards } from "lucide-react";

interface PublicAccreditationResidence extends AccreditationStatus {
  residence_id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  campus: string | null;
  image_url: string | null;
}

const NsfAsLanding = () => {
  const [rows, setRows] = useState<PublicAccreditationResidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await (supabase as any).rpc("get_public_accreditation_residences", { p_residence_id: null });
      if (!active) return;
      if (!error) setRows((data || []) as PublicAccreditationResidence[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const verified = useMemo(() => rows.filter((row) => row.accreditation_verified === true), [rows]);
  const acceptsFunding = useMemo(() => rows.filter((row) => row.accepts_nsfas === true), [rows]);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Student accommodation with verified current accreditation evidence",
    numberOfItems: verified.length,
    itemListElement: verified.map((residence, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Accommodation",
        name: residence.name,
        address: residence.address || undefined,
        url: `https://www.reskonnect.org/res/${residence.residence_id}`,
      },
    })),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does accepting NSFAS mean a residence is accredited?",
        acceptedAnswer: { "@type": "Answer", text: "No. ResKonnect records funding acceptance separately from official accreditation status. An official accreditation badge is shown only when current authority evidence has been verified in the platform." },
      },
      {
        "@type": "Question",
        name: "Who accredits and grades student accommodation?",
        acceptedAnswer: { "@type": "Answer", text: "Official accreditation and grading are decisions of NSFAS or the relevant authorised institution or body. ResKonnect provides readiness, document organisation, pre-inspection and case-support services and does not issue official accreditation." },
      },
      {
        "@type": "Question",
        name: "How does ResKonnect verify an accommodation status?",
        acceptedAnswer: { "@type": "Answer", text: "The platform separates provider funding acceptance from official status and records authority evidence, validity dates and grading evidence before displaying a verified accreditation claim." },
      },
    ],
  };

  return (
    <PublicLayout>
      <SEO
        title="NSFAS Student Accommodation Status | ResKonnect"
        description="Browse student accommodation that accepts NSFAS-funded students and see verified official accreditation status separately where current authority evidence is available."
        keywords="NSFAS accommodation, NSFAS accredited accommodation, NSFAS student housing, student accommodation funding, NSFAS residence verification"
      />
      <SEOJsonLd schema={[itemListSchema, faqSchema]} />

      <section className="border-b bg-gradient-to-br from-[#071326] via-[#102844] to-[#0f5132] text-white">
        <div className="container mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 md:py-20 lg:px-8">
          <Badge className="mb-5 border-white/20 bg-white/10 text-white hover:bg-white/10"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Evidence-based status</Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-black tracking-tight md:text-5xl">NSFAS accommodation, without mixing up funding and accreditation.</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-white/75">ResKonnect now shows whether a property accepts NSFAS-funded students separately from whether current official accreditation evidence has been verified.</p>
          <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5"><p className="text-3xl font-black">{loading ? "—" : acceptsFunding.length}</p><p className="mt-1 text-sm text-white/70">visible listings accepting NSFAS-funded students</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5"><p className="text-3xl font-black">{loading ? "—" : verified.length}</p><p className="mt-1 text-sm text-white/70">with current official accreditation evidence verified in ResKonnect</p></div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <WalletCards className="h-4 w-4" />
          <AlertTitle>Two different statuses</AlertTitle>
          <AlertDescription>{GOVERNANCE_NOTICES.funding} Always check the current status and funding pathway for your institution before committing.</AlertDescription>
        </Alert>

        <section>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Current evidence</p>
              <h2 className="mt-2 text-3xl font-black">Official accreditation verified</h2>
              <p className="mt-2 max-w-3xl text-muted-foreground">These listings only appear here when ResKonnect has recorded an active official status, verified authority evidence and a current accreditation-validity date.</p>
            </div>
            <Button asChild variant="outline"><Link to="/find">Browse all accommodation</Link></Button>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border p-10 text-center text-muted-foreground">Checking current accommodation status…</div>
          ) : verified.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {verified.map((residence) => (
                <Card key={residence.residence_id} className="overflow-hidden border-emerald-200 dark:border-emerald-900">
                  {residence.image_url && <img src={residence.image_url} alt={residence.name} className="h-44 w-full object-cover" loading="lazy" />}
                  <CardContent className="p-5">
                    <AccreditationStatusBadge status={residence} />
                    <h3 className="mt-4 text-lg font-black">{residence.name}</h3>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {(residence.address || residence.city) && <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{residence.address || residence.city}</p>}
                      {residence.campus && <p className="flex gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0" />{residence.campus}</p>}
                      {residence.accreditation_valid_until && <p className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />Evidence valid to {residence.accreditation_valid_until}</p>}
                    </div>
                    <Button asChild className="mt-5 w-full"><Link to={`/res/${residence.residence_id}`}>View residence</Link></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-black">No listing is being labelled “officially accredited” without verified current evidence.</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Properties may still accept NSFAS-funded students. ResKonnect will only move them into this verified section after the authority status and validity evidence have been recorded and checked.</p>
            </div>
          )}
        </section>

        <section>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Funding acceptance</p>
            <h2 className="mt-2 text-3xl font-black">Listings that accept NSFAS-funded students</h2>
          </div>
          {acceptsFunding.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {acceptsFunding.map((residence) => (
                <Card key={residence.residence_id}>
                  <CardContent className="p-5">
                    <AccreditationStatusBadge status={residence} compact />
                    <h3 className="mt-4 font-black">{residence.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{residence.campus || residence.city || residence.address || "Location details available on listing"}</p>
                    <Button asChild variant="outline" className="mt-4 w-full"><Link to={`/res/${residence.residence_id}`}>Check listing & apply</Link></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border p-8 text-center text-sm text-muted-foreground">No visible listing is currently flagged as accepting NSFAS funding.</div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <Card><CardContent className="p-6"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><h3 className="mt-4 font-black">Official status is evidence-controlled</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Accreditation status, authority, reference, validity and grade are stored separately from marketing labels and funding acceptance.</p></CardContent></Card>
          <Card><CardContent className="p-6"><Bed className="h-6 w-6 text-primary" /><h3 className="mt-4 font-black">Property quality still matters</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A grade or accreditation record does not override serious safety, service, mistreatment or living-condition concerns in ResKonnect's quality process.</p></CardContent></Card>
          <Card><CardContent className="p-6"><FileCheck2 className="h-6 w-6 text-primary" /><h3 className="mt-4 font-black">Providers can prepare with us</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Landlords can use the ResKonnect compliance-readiness workflow to organise the required evidence and prepare for the external process.</p><Button asChild variant="link" className="mt-2 px-0"><Link to="/accreditation-readiness">View provider requirements</Link></Button></CardContent></Card>
        </section>

        <section>
          <h2 className="text-2xl font-black">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Does accepting NSFAS mean the property is officially accredited?", "No. ResKonnect records funding acceptance and official accreditation separately. Look for the evidence-controlled official accreditation badge and current validity date."],
              ["Who makes the accreditation and grading decision?", "NSFAS or the relevant authorised institution/body. ResKonnect supports preparation, document readiness, pre-inspection, remediation and case control but does not issue the official decision."],
              ["Can a status change?", "Yes. Official accreditation can have validity periods and may be suspended, revoked or expire. ResKonnect therefore stores status and validity separately and avoids treating a once-off claim as permanent."],
            ].map(([question, answer]) => <Card key={question}><CardContent className="p-6"><h3 className="font-black">{question}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p></CardContent></Card>)}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default NsfAsLanding;
