import { Link } from "react-router-dom";
import { CheckCircle2, Info, ArrowRight } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";
import SeoFaqSection from "@/components/seo/SeoFaqSection";
import SeoInternalLinks from "@/components/seo/SeoInternalLinks";
import SeoListingResults from "@/components/seo/SeoListingResults";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/lib/seo/jsonLd";
import { SEO_LANDING_BY_PATH } from "@/lib/seo/landingContent";

interface Props {
  /** Path key into SEO_LANDING_BY_PATH. */
  pageKey: string;
}

const SeoLandingPage = ({ pageKey }: Props) => {
  const page = SEO_LANDING_BY_PATH[pageKey];

  if (!page) return null;

  const schemas: object[] = [breadcrumbSchema(page.crumbs)];
  if (page.faqs.length) schemas.push(faqSchema(page.faqs));
  if (page.kind === "guide") {
    schemas.push(
      articleSchema({ headline: page.h1, description: page.description, path: page.path }),
    );
  }

  return (
    <PublicLayout>
      <SEO
        title={page.title}
        description={page.description}
        keywords={page.keywords}
        canonicalPath={page.path}
        type={page.kind === "guide" ? "article" : "website"}
        jsonLd={schemas}
      />

      <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SeoBreadcrumbs crumbs={page.crumbs} />

        <header className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{page.h1}</h1>
          {page.intro.map((p, i) => (
            <p key={i} className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{p}</p>
          ))}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={page.cta.to}>{page.cta.label}</Link>
            </Button>
            {page.cta.secondaryTo && (
              <Button asChild size="lg" variant="outline">
                <Link to={page.cta.secondaryTo}>{page.cta.secondaryLabel}</Link>
              </Button>
            )}
          </div>
        </header>

        <section aria-labelledby="who-heading" className="mt-12 rounded-2xl border border-border bg-muted/40 p-6">
          <h2 id="who-heading" className="text-lg font-semibold">Who this page is for</h2>
          <p className="mt-2 text-muted-foreground">{page.audience}</p>
        </section>

        <section aria-labelledby="benefits-heading" className="mt-14">
          <h2 id="benefits-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
            What you get here
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.benefits.map((b) => (
              <Card key={b.title} className="h-full">
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold">{b.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {page.body?.map((section) => (
          <section key={section.heading} className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mt-3 leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </section>
        ))}

        {page.listings && (
          <SeoListingResults
            heading={page.listings.heading}
            query={page.listings.query}
            emptyText={page.listings.emptyText}
          />
        )}

        <section aria-labelledby="scope-heading" className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 id="scope-heading" className="text-xl font-bold">How ResKonnect helps</h2>
            <ul className="mt-4 space-y-2.5">
              {page.helps.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-6">
            <h2 className="text-xl font-bold">What ResKonnect does not do</h2>
            <ul className="mt-4 space-y-2.5">
              {page.notDoing.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <SeoFaqSection items={page.faqs} />

        <SeoInternalLinks links={page.links} />

        <section aria-labelledby="next-heading" className="mt-14 rounded-2xl border border-border bg-primary/5 p-8 text-center">
          <h2 id="next-heading" className="text-2xl font-bold tracking-tight">Your next step</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Ready to move forward? Start here and we will take you through the rest.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to={page.cta.to} className="inline-flex items-center gap-2">
              {page.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>
    </PublicLayout>
  );
};

export default SeoLandingPage;
