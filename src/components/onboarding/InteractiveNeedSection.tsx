import React from "react";
import { GraduationCap, HeartHandshake, Home, FileCheck, Briefcase, Building2, Landmark, HelpCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { Persona, Need } from "@/lib/onboarding/onboardingTypes";
import TumeloCareerPreview from "@/components/landing/TumeloCareerPreview";

interface NeedCard {
  title: string;
  desc: string;
  icon: typeof GraduationCap;
  persona: Persona;
  need: Need;
  colorClass: string;
}

const NEED_CARDS: NeedCard[] = [
  {
    title: "Find a place to stay",
    desc: "Browse verified student accommodation near campus.",
    icon: GraduationCap,
    persona: "student",
    need: "accommodation",
    colorClass: "text-brand-blue bg-brand-blue/10",
  },
  {
    title: "Help my child",
    desc: "Get secure, verified lodging and guidance for your student.",
    icon: HeartHandshake,
    persona: "parent_guardian",
    need: "accommodation",
    colorClass: "text-brand-navy dark:text-brand-blue-accent bg-brand-navy/10 dark:bg-brand-blue/10",
  },
  {
    title: "Find a private rental",
    desc: "Find single, shared, bachelor rooms or apartments.",
    icon: Home,
    persona: "private_tenant",
    need: "private_rental",
    colorClass: "text-brand-blue-accent bg-brand-blue-accent/10",
  },
  {
    title: "Apply for study support",
    desc: "Prepare documents and apply to tertiary institutions.",
    icon: FileCheck,
    persona: "applicant",
    need: "application_support",
    colorClass: "text-brand-green bg-brand-green/10",
  },
  {
    title: "Get WIL support",
    desc: "Access workplace learning readiness and placement matching.",
    icon: Briefcase,
    persona: "wil_applicant",
    need: "wil_support",
    colorClass: "text-brand-gold bg-brand-gold/15",
  },
  {
    title: "List my property",
    desc: "Advertise rooms, manage leads, and get verified bookings.",
    icon: Building2,
    persona: "landlord",
    need: "property_listing",
    colorClass: "text-brand-green bg-brand-green/10",
  },
  {
    title: "Partner with ResKonnect",
    desc: "Tailored business, institution, and portal solutions.",
    icon: Landmark,
    persona: "institution_business",
    need: "partner_solution",
    colorClass: "text-brand-navy dark:text-brand-gold bg-brand-gold/15",
  },
  {
    title: "I am not sure",
    desc: "Let our smart advisor guide you in the right direction.",
    icon: HelpCircle,
    persona: "unsure",
    need: "general_guidance",
    colorClass: "text-muted-foreground bg-muted",
  },
];

export const InteractiveNeedSection: React.FC = () => {
  return (
    <>
      <TumeloCareerPreview />
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Start with one question: what do you need?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Whether you are a student, parent, private tenant, applicant, landlord, or institution, ResKonnect guides you to the right support path.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {NEED_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <Card
                  key={idx}
                  className="rk-card-interactive group relative overflow-hidden p-0"
                >
                  <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-3">
                      <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 ${card.colorClass}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-normal">
                        {card.desc}
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-primary font-semibold hover:bg-primary/5 p-0 group-hover:px-2 transition-all flex items-center gap-1.5"
                      >
                        <Link to={`/get-started?persona=${card.persona}&need=${card.need}`}>
                          <span>Get Started</span>
                          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

export default InteractiveNeedSection;
