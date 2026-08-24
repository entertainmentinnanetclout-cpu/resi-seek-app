import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Info,
  Search,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  fallbackTumeloCareerContent,
  loadTumeloCareerContent,
  type TumeloCareerContent,
} from "@/features/tumelo/content";
import { TUMELO_PORTRAIT } from "@/features/tumelo/portrait";

const topicIcons = [GraduationCap, BookOpen, CalendarDays, Search, FileCheck2];

const exploreLinks = [
  {
    title: "Application readiness",
    description: "Get your documents, choices and application plan in order.",
    to: "/applications/application-readiness",
  },
  {
    title: "APS checker",
    description: "Understand your admission point score before choosing programmes.",
    to: "/applications/aps-checker",
  },
  {
    title: "WIL placement support",
    description: "Prepare for workplace-integrated learning and opportunity pathways.",
    to: "/opportunities/wil-placement-support",
  },
  {
    title: "Student accommodation",
    description: "Continue your journey with verified accommodation options.",
    to: "/find",
  },
];

const TumeloCareerEducation = () => {
  const [content, setContent] = useState<TumeloCareerContent>(fallbackTumeloCareerContent);

  useEffect(() => {
    let active = true;
    loadTumeloCareerContent().then((next) => {
      if (active) setContent(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(content.social_url);
      toast.success("Tumelo's TikTok link copied.");
    } catch {
      toast.error("Could not copy the link. Please use Watch on TikTok instead.");
    }
  };

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Career & Education with Tumelo",
    url: "https://www.reskonnect.org/career-education/tumelo",
    description:
      "Career and education guidance with Tumelo on qualifications, applications, research, documents and student opportunity pathways through ResKonnect.",
    isPartOf: {
      "@type": "WebSite",
      name: "ResKonnect",
      url: "https://www.reskonnect.org",
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SEO
        title="Career & Education with Tumelo | ResKonnect"
        description="Explore Career & Education with Tumelo on ResKonnect: qualification research, TVET and university application guidance, application dates, required documents and practical student pathways."
        keywords="Tumelo career education, qualification advice South Africa, TVET guidance, university applications, application dates, career research, student opportunities, ResKonnect"
        canonicalPath="/career-education/tumelo"
      />
      <SEOJsonLd schema={pageSchema} />
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-b from-primary/[0.055] via-background to-background py-10 md:py-14">
          <div className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary sm:text-sm">
                <Sparkles className="h-4 w-4" />
                Strategic collaboration with Tumelo | Career & Education
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                {content.section_title}
              </h1>
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base md:text-lg">
                {content.subtitle}
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-6xl gap-5 lg:grid-cols-[0.82fr_1.18fr]">
              <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-950">
                  <img
                    src={TUMELO_PORTRAIT}
                    alt="Tumelo, Career and Education collaborator"
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/5" />
                  <div className="absolute left-4 right-4 top-4 rounded-xl bg-white/95 px-4 py-2.5 text-center text-base font-bold leading-snug text-slate-950 shadow-sm sm:text-lg">
                    {content.preview_text}
                  </div>
                  <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/15 bg-black/60 p-3.5 text-white backdrop-blur-md">
                    <p className="text-sm font-bold">Tumelo | Career & Education</p>
                    <p className="mt-0.5 text-xs text-white/75">{content.social_handle}</p>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button asChild className="gap-2">
                      <a href={content.social_url} target="_blank" rel="noreferrer noopener">
                        Watch on TikTok <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" onClick={copyProfileLink} className="gap-2">
                      <Clipboard className="h-4 w-4" /> Copy link
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Preview opens on TikTok — content stays on Tumelo's page and is not re-uploaded as independent ResKonnect content.</span>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold sm:text-xl">Video summary / transcript</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{content.summary}</p>

                <ul className="mt-5 space-y-3">
                  {content.bullet_points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm leading-6">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t pt-4">
                  <div className="flex flex-wrap gap-2">
                    {content.tags.map((tag, index) => {
                      const Icon = topicIcons[index % topicIcons.length];
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary" /> {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </article>
            </div>

            <div className="mx-auto mt-5 flex max-w-6xl flex-col gap-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="font-semibold">Learn from Tumelo, then continue your ResKonnect journey.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Move from guidance to applications, accommodation, WIL and other student opportunities in one connected platform.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0 gap-2">
                <Link to={content.cta_url || "/get-started"}>
                  {content.cta_label || "Continue on ResKonnect"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Explore more</p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Everything you need, all in one place.</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {exploreLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <h3 className="font-bold group-hover:text-primary">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Explore <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Career and education guidance is educational support, not a guarantee of admission, funding, accommodation, WIL, internship, learnership or employment. Institution-specific dates, entry requirements and programme information should be confirmed with the relevant official institution or provider.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default TumeloCareerEducation;
