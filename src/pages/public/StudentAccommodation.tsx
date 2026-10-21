import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Building, ShieldCheck, WalletCards, FileCheck2 } from "lucide-react";
import { GOVERNANCE_NOTICES } from "@/lib/compliance/nsfasStandards";

export const StudentAccommodation: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Student Accommodation | Verified Listings & Funding Status"
        description="Find student accommodation across South Africa with clear ResKonnect verification, funding acceptance and official accreditation status shown as separate facts."
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
        <div className="container mx-auto space-y-14 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Student Accommodation Hub</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Search student accommodation with the status made clear: what a property offers, what funding it accepts, what ResKonnect has verified and whether current official accreditation evidence is actually on record.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <Button asChild size="lg"><Link to="/find">Browse Residences</Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/student-accommodation/nsfas-accredited">Check NSFAS status</Link></Button>
            </div>
          </div>

          <Alert className="mx-auto max-w-5xl border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
            <WalletCards className="h-4 w-4" />
            <AlertTitle>“Accepts NSFAS” is not the same as “officially accredited”</AlertTitle>
            <AlertDescription>{GOVERNANCE_NOTICES.funding} ResKonnect only uses an official accreditation claim when current authority evidence and validity have been verified in the platform.</AlertDescription>
          </Alert>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">What we check before a listing earns trust</h2>
              <p className="leading-relaxed text-muted-foreground">
                ResKonnect quality is based on the lived student experience, not a marketing label. We look at current property facts, safety and security, living conditions, treatment and dignity, study access, clear terms and how the provider responds when something goes wrong.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Safety, access control and emergency readiness",
                  "Cleanliness, water, sanitation and maintenance",
                  "Room occupancy, ventilation and advertised facilities",
                  "Study space, connectivity and practical campus access",
                  "Clear costs, lease terms and reachable management",
                  "Student feedback, complaints and corrective action",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span className="text-sm font-semibold leading-5">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border/80">
                <CardContent className="space-y-2 p-6 text-center">
                  <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="font-bold">ResKonnect verification</h3>
                  <p className="text-xs leading-5 text-muted-foreground">Property and service information is checked against the evidence available to us and can be reviewed again when conditions change.</p>
                </CardContent>
              </Card>
              <Card className="border-border/80">
                <CardContent className="space-y-2 p-6 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="font-bold">Campus access</h3>
                  <p className="text-xs leading-5 text-muted-foreground">Distance, transport and practical accessibility are shown as property facts rather than assumed from a marketing category.</p>
                </CardContent>
              </Card>
              <Card className="col-span-2 border-border/80">
                <CardContent className="flex items-start gap-4 p-6">
                  <FileCheck2 className="h-10 w-10 shrink-0 text-emerald-600" />
                  <div>
                    <h3 className="font-bold">Evidence-controlled official status</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Accreditation authority, official reference, validity and grade are stored separately from ResKonnect quality labels and from whether a provider accepts NSFAS funding.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <section className="mx-auto max-w-6xl rounded-3xl border bg-card p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-3">
              <div><Building className="h-6 w-6 text-primary" /><h3 className="mt-3 font-black">1. Find a property</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Compare room type, price, availability, amenities, location and the property information relevant to your needs.</p></div>
              <div><WalletCards className="h-6 w-6 text-primary" /><h3 className="mt-3 font-black">2. Check your funding route</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Confirm whether the residence accepts your funding type and whether your institution/funder requirements apply to that property.</p></div>
              <div><ShieldCheck className="h-6 w-6 text-primary" /><h3 className="mt-3 font-black">3. Verify before committing</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the status shown on the listing and ask for clarification if official accreditation evidence, validity or conditions are material to your placement.</p></div>
            </div>
          </section>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/find">Find My Res</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/get-started?persona=student&need=accommodation">Get Guided Onboarding</Link></Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default StudentAccommodation;
