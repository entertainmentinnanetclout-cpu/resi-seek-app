import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Home, HeartHandshake, ArrowRight, GraduationCap, School, Wallet, ShieldCheck } from "lucide-react";
import { useUserIntent } from "@/contexts/UserIntentContext";
import type { UserIntent } from "@/lib/intent/userIntentTypes";
import heroAccommodation from "@/assets/hero-accommodation.jpg";
import inclusivePathways from "@/assets/hero-inclusive-pathways.jpg";
import studentsCelebration from "@/assets/students-celebration.jpg";

/**
 * Category cards are functional: each one writes real intent and routes to the
 * page that can actually serve it. None of them are decorative.
 */
interface LivingOption {
  title: string;
  description: string;
  to: string;
  cta: string;
  image: string;
  icon: typeof Building2;
  intent: Partial<UserIntent>;
}

const livingOptions: LivingOption[] = [
  {
    title: "Student Accommodation",
    description:
      "Verified university and TVET college residences close to campus. Browse real rooms, prices and availability before you commit.",
    to: "/find",
    cta: "Explore Residences",
    image: heroAccommodation,
    icon: Building2,
    intent: { persona: "student", primary_need: "accommodation", looking_for_student_accommodation: true },
  },
  {
    title: "University Accommodation",
    description:
      "Residences flagged by our team as accepting university students, matched to your campus.",
    to: "/find?audience=university",
    cta: "View University Options",
    image: heroAccommodation,
    icon: GraduationCap,
    intent: { persona: "student", primary_need: "accommodation", institution_type: "university" },
  },
  {
    title: "TVET Accommodation",
    description:
      "Only residences an admin has confirmed accept TVET college students. No guesswork, no mislabelling.",
    to: "/find?audience=tvet",
    cta: "View TVET Options",
    image: inclusivePathways,
    icon: School,
    intent: { persona: "student", primary_need: "accommodation", institution_type: "tvet" },
  },
  {
    title: "NSFAS Residences",
    description:
      "Accommodation carrying NSFAS accreditation context. ResKonnect does not process NSFAS applications.",
    to: "/find",
    cta: "View NSFAS Accommodation",
    image: heroAccommodation,
    icon: ShieldCheck,
    intent: {
      persona: "student",
      primary_need: "accommodation",
      funding_type: "nsfas",
      nsfas_funded: true,
    },
  },
  {
    title: "Private-Paying Student",
    description:
      "Student accommodation that accepts private-paying students. Still student housing — not a private rental.",
    to: "/find",
    cta: "View Private-Paying Options",
    image: inclusivePathways,
    icon: Wallet,
    intent: {
      persona: "student",
      primary_need: "accommodation",
      funding_type: "private",
      student_status: "current_student",
    },
  },
  {
    title: "Private Rentals",
    description:
      "Non-student rentals for working professionals and private tenants. Handled separately from student residences.",
    to: "/living/private-rentals",
    cta: "Browse Rentals",
    image: inclusivePathways,
    icon: Home,
    intent: {
      persona: "private_tenant",
      primary_need: "private_rental",
      looking_for_private_rental: true,
      looking_for_student_accommodation: false,
    },
  },
  {
    title: "Parent & Guardian Support",
    description:
      "Guidance, off-campus lodging tips and support services for safety, security and peace of mind.",
    to: "/get-started?persona=parent_guardian",
    cta: "Parent Portal",
    image: studentsCelebration,
    icon: HeartHandshake,
    intent: { persona: "parent_guardian", parent_mode: true },
  },
];

export const Living: React.FC = () => {
  const navigate = useNavigate();
  const { setIntent } = useUserIntent();

  const choose = (opt: LivingOption) => {
    setIntent({ ...opt.intent, completed_guide: true, skipped_guide: false });
    navigate(opt.to);
  };

  return (
    <PublicLayout>
      <SEO
        title="Living Solutions | Student Accommodation & Private Rentals"
        description="Premium connected living with ResKonnect. Explore university residences, TVET-friendly housing, single bachelor apartments, parent support resources, and property listings."
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Connected Living Solutions
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Find safe, verified, and community-centric student accommodation and private rentals. ResKonnect is South Africa’s ultimate gateway to high-quality spaces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {livingOptions.map((opt) => (
              <Card
                key={opt.title}
                className="group overflow-hidden border-border/80 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <button type="button" onClick={() => choose(opt)} className="block w-full text-left">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    <img
                      src={opt.image}
                      alt={opt.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-white backdrop-blur-sm">
                        <opt.icon className="h-5 w-5" />
                      </span>
                      <h2 className="text-lg font-bold text-white">{opt.title}</h2>
                    </div>
                  </div>
                </button>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{opt.description}</p>
                  <Button variant="outline" className="w-full" onClick={() => choose(opt)}>
                    {opt.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Are you a property owner?</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Advertise your rooms, connect directly with verified students and tenants, and manage bookings effortlessly with ResKonnect’s landlord dashboard.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link to="/get-started?persona=landlord&need=property_listing">List Your Property</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Living;