import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, GraduationCap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  fallbackTumeloCareerContent,
  loadTumeloCareerContent,
  type TumeloCareerContent,
} from "@/features/tumelo/content";
import { TUMELO_PORTRAIT } from "@/features/tumelo/portrait";
import PartnerShowcase from "@/components/landing/PartnerShowcase";

const TumeloCareerPreview = () => {
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

  return (
    <>
      <section className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.045] via-background to-amber-50/60 py-10 dark:to-amber-950/10 md:py-14">
        <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-[0_24px_70px_-35px_hsl(var(--primary)/0.45)] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-[300px] overflow-hidden bg-slate-950 lg:min-h-[390px]">
              <img
                src={TUMELO_PORTRAIT}
                alt="Tumelo, Career and Education collaborator"
                className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
              <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                Strategic collaboration
              </div>
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-slate-950/75 p-4 text-white backdrop-blur-md">
                <p className="text-xs font-medium text-blue-200">ResKonnect × Tumelo</p>
                <p className="mt-1 text-lg font-bold leading-snug">Career & Education, connected.</p>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Career & Education with Tumelo
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Make better education choices before you apply.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {content.subtitle}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-3.5">
                  <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Qualifications & pathways</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Research courses, entry requirements and career direction.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-3.5">
                  <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Application readiness</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Prepare dates, documents and next steps before applications open.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/career-education/tumelo">
                    Meet Tumelo <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">Original social content remains attributed to Tumelo.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <PartnerShowcase />
    </>
  );
};

export default TumeloCareerPreview;
