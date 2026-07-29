import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Briefcase, Milestone, Award, Compass, Sparkles } from "lucide-react";

export const Opportunities: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Opportunities Hub | WIL Placements & Careers"
        description="Connect with workplace integrated learning programs, technical internships, career workshops, and premium recruiter opportunities."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Opportunities & Placements Hub
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Step from study directly into industry. Access workplace integrated learning (WIL) support, internships, career guidance, and student recruiter programs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Milestone className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">WIL Placements</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Required practical semester assistance for N6 TVET engineering, hospitality, and business administration students.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/opportunities/wil">Learn More &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Briefcase className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Internship Readiness</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Workshops covering professional CV formats, technical interview expectations, and corporate workplace ethics.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/get-started?persona=wil_applicant&need=wil_support">Get Guided Help &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Award className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Student Referrals</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Earn commissions of R200 for each successfully placed student, with a R3,000 bonus on achieving 10 signups.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/recruit">Learn More &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Compass className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Career Guidance</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Unsure about what career pathway matches your qualification? Let our mentors align your talents.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/get-started?persona=unsure&need=general_guidance">Talk to Mentor &rarr;</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Are you an industry partner?
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Collaborate with ResKonnect to source verified talent, sponsor bursary programs, and host corporate-driven internships for TVETs and Universities.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/get-started?persona=institution_business&need=partner_solution">Partner With Us</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Opportunities;