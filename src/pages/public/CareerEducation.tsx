import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, GraduationCap, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TUMELO_PORTRAIT } from "@/features/tumelo/portrait";
import { loadCareerEducationProviders, type CareerEducationProvider } from "@/features/careerEducation/data";

const CareerEducation = () => {
  const [providers, setProviders] = useState<CareerEducationProvider[]>([]);

  useEffect(() => {
    let active = true;
    loadCareerEducationProviders().then((data) => {
      if (active) setProviders(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Career & Education | ResKonnect",
    url: "https://www.reskonnect.org/career-education",
    description: "Career and education guidance from trusted collaborators and service providers connected to the ResKonnect student journey.",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="Career & Education | ResKonnect"
        description="Explore trusted career and education guidance, qualification advice, application support and student opportunity pathways on ResKonnect."
        keywords="career guidance South Africa, education advice, qualification guidance, university applications, TVET guidance, student careers, ResKonnect"
        canonicalPath="/career-education"
      />
      <SEOJsonLd schema={pageSchema} />
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.065] via-background to-background py-14 md:py-20">
          <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
                <GraduationCap className="h-4 w-4" /> Career & Education
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
                Guidance that helps students make better decisions.
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Learn from trusted career, education and student-support collaborators, then move directly into ResKonnect tools for applications, accommodation, WIL and opportunities.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
              {[
                { icon: GraduationCap, title: "Qualifications", copy: "Understand programmes, entry requirements and study pathways." },
                { icon: BriefcaseBusiness, title: "Career direction", copy: "Connect study choices to realistic career and workplace pathways." },
                { icon: Users, title: "Trusted contributors", copy: "A scalable home for specialists, educators and aligned service providers." },
              ].map((item) => (
                <Card key={item.title} className="bg-card/80 shadow-sm">
                  <CardContent className="p-5">
                    <item.icon className="h-5 w-5 text-primary" />
                    <h2 className="mt-3 font-bold">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Featured guidance</p>
                  <h2 className="mt-2 text-3xl font-bold">Career & Education contributors</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Tumelo leads ResKonnect's featured Career & Education collaboration, bringing practical student-facing guidance on qualifications, applications and career choices into the same journey where students can act on that advice. Her collaboration demonstrates how trusted experts and aligned organizations can contribute meaningful guidance while retaining their own identity and audience.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/partners">Partner with ResKonnect <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {(providers.length ? providers : [{
                  id: "tumelo-fallback",
                  slug: "tumelo",
                  name: "Tumelo",
                  role_label: "Career & Education",
                  bio: "Trusted guidance on qualifications, applications, career choices and student opportunities.",
                  profile_image_url: null,
                  profile_page_path: "/career-education/tumelo",
                  social_handle: "@tumelosithole10",
                  social_url: "https://www.tiktok.com/@tumelosithole10",
                  is_featured: true,
                  is_published: true,
                  sort_order: 0,
                }]).map((provider) => {
                  const portrait = provider.slug === "tumelo" ? TUMELO_PORTRAIT : provider.profile_image_url;
                  return (
                    <Link
                      key={provider.id}
                      to={provider.profile_page_path}
                      className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-muted">
                        {portrait ? (
                          <img src={portrait} alt={provider.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-primary/5">
                            <Sparkles className="h-12 w-12 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{provider.role_label}</p>
                            <h3 className="mt-1 text-xl font-bold">{provider.name}</h3>
                          </div>
                          <ArrowRight className="h-5 w-5 text-primary transition group-hover:translate-x-1" />
                        </div>
                        {provider.bio && <p className="mt-3 text-sm leading-6 text-muted-foreground">{provider.bio}</p>}
                        {provider.social_handle && <p className="mt-3 text-xs font-semibold text-foreground/70">{provider.social_handle}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CareerEducation;
