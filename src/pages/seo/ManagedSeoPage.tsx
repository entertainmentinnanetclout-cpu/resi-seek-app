import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarDays, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getManagedSeoLinks,
  getManagedSeoPage,
  getPublishedPropertyOpportunities,
  normalizeSeoPath,
} from "@/lib/seo/managedSeo";

interface Props {
  pagePath: string;
}

const PROPERTY_PATHS = new Set([
  "/properties",
  "/property-auctions",
  "/student-accommodation-for-sale",
  "/development-opportunities",
]);

const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const filterProperties = (path: string, items: any[]) => {
  if (path === "/properties") return items;
  return items.filter((item) => {
    const type = `${item.opportunity_type || ""} ${item.status || ""}`.toLowerCase();
    if (path === "/property-auctions") return /auction|execution|distress|sheriff/.test(type);
    if (path === "/development-opportunities") return /development|conversion|land|redevelop/.test(type);
    if (path === "/student-accommodation-for-sale") return !/auction|execution/.test(type);
    return true;
  });
};

const ManagedSeoPage = ({ pagePath }: Props) => {
  const normalizedPath = normalizeSeoPath(pagePath);
  const { data: page, isLoading, error } = useQuery({
    queryKey: ["managed-seo-page", normalizedPath],
    queryFn: () => getManagedSeoPage(normalizedPath),
    staleTime: 5 * 60_000,
  });
  const { data: links = [] } = useQuery({
    queryKey: ["managed-seo-links", normalizedPath],
    queryFn: () => getManagedSeoLinks(normalizedPath),
    staleTime: 5 * 60_000,
  });
  const { data: allProperties = [] } = useQuery({
    queryKey: ["published-property-opportunities"],
    queryFn: getPublishedPropertyOpportunities,
    enabled: PROPERTY_PATHS.has(normalizedPath),
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <main className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-5 h-24 max-w-3xl animate-pulse rounded bg-muted" />
        </main>
      </PublicLayout>
    );
  }

  if (error || !page) {
    return (
      <PublicLayout>
        <SEO noIndex canonicalPath={normalizedPath} title="Page unavailable | ResKonnect" />
        <main className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">This search page is not published yet</h1>
          <p className="mt-3 text-muted-foreground">ResKonnect only indexes managed search pages after they pass the publishing and quality checks.</p>
          <Button asChild className="mt-6"><Link to="/">Return to ResKonnect</Link></Button>
        </main>
      </PublicLayout>
    );
  }

  const properties = filterProperties(normalizedPath, allProperties as any[]);
  const canonicalPath = page.canonical_path || page.path;
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.description,
    url: `https://www.reskonnect.org${canonicalPath === "/" ? "" : canonicalPath}`,
    inLanguage: page.locale || "en-ZA",
    dateModified: page.updated_at || undefined,
    isPartOf: {
      "@type": "WebSite",
      name: "ResKonnect",
      url: "https://www.reskonnect.org",
    },
    about: (page.search_territory || []).slice(0, 8).map((name) => ({ "@type": "Thing", name })),
  };
  const schemas: object[] = [webPageSchema];
  if (page.schema_data && Object.keys(page.schema_data).length > 0) schemas.push(page.schema_data);

  const verified = page.last_verified_at
    ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(page.last_verified_at))
    : null;

  return (
    <PublicLayout>
      <SEO
        title={page.title}
        description={page.description}
        keywords={[page.primary_keyword, ...(page.search_territory || [])].filter(Boolean).join(", ")}
        canonicalPath={canonicalPath}
        imageUrl={page.og_image || undefined}
        jsonLd={schemas}
      />

      <main className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">ResKonnect</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page">{page.h1}</span>
        </nav>

        <header className="mt-7 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            {page.ai_citation_ready && <Badge variant="secondary">Source-aware page</Badge>}
            {verified && <span className="text-xs text-muted-foreground">Last verified {verified}</span>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">{page.h1}</h1>
          {page.answer_summary && (
            <p data-ai-answer="true" className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{page.answer_summary}</p>
          )}
          {page.cta?.to && page.cta?.label && (
            <Button asChild size="lg" className="mt-7"><Link to={page.cta.to}>{page.cta.label}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          )}
        </header>

        {page.entity_facts?.length > 0 && (
          <section aria-labelledby="facts-heading" className="mt-12">
            <h2 id="facts-heading" className="text-xl font-bold">Key facts</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {page.entity_facts.map((fact) => (
                <div key={`${fact.label}-${fact.value}`} className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-1 font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {page.content_blocks?.map((section) => (
          <section key={section.heading} className="mt-12 max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{section.heading}</h2>
            {section.paragraphs?.map((paragraph, index) => (
              <p key={index} className="mt-3 leading-relaxed text-muted-foreground">{paragraph}</p>
            ))}
          </section>
        ))}

        {PROPERTY_PATHS.has(normalizedPath) && (
          <section aria-labelledby="property-results" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="property-results" className="text-2xl font-bold tracking-tight md:text-3xl">Published property opportunities</h2>
                <p className="mt-2 text-muted-foreground">Only records currently published in ResKonnect Property Intelligence appear here.</p>
              </div>
              <Badge variant="outline">{properties.length} published</Badge>
            </div>

            {properties.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border p-8">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">No verified opportunities are published in this category yet</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">ResKonnect keeps unpublished research and due-diligence work out of public search until the source, status and publishing fields are ready.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {properties.map((property: any) => (
                  <Card key={property.id} className="h-full">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant="secondary">{property.opportunity_type || "Property opportunity"}</Badge>
                        {property.reskonnect_score != null && <span className="text-sm font-semibold">{property.reskonnect_score}/100</span>}
                      </div>
                      <h3 className="mt-4 text-lg font-bold leading-snug"><Link className="hover:text-primary" to={`/properties/${property.slug}`}>{property.name}</Link></h3>
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{[property.suburb, property.city, property.province].filter(Boolean).join(", ") || property.address || "Location available on listing"}</p>
                      {money(property.asking_price) && <p className="mt-4 text-xl font-extrabold">{money(property.asking_price)} <span className="text-xs font-normal text-muted-foreground">{property.price_basis || ""}</span></p>}
                      {property.auction_date && <p className="mt-2 flex items-center gap-1.5 text-sm"><CalendarDays className="h-4 w-4" />{new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(property.auction_date))}</p>}
                      {property.advertised_bed_capacity && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />Advertised capacity: {property.advertised_bed_capacity} beds</p>}
                      <div className="mt-auto pt-5"><Button asChild variant="outline" className="w-full"><Link to={`/properties/${property.slug}`}>View ResKonnect analysis<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {links.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-14 border-t border-border pt-10">
            <h2 id="related-heading" className="text-xl font-bold">Related ResKonnect searches</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {links.map((link) => (
                <Button key={`${link.to_path}-${link.anchor_text}`} asChild variant="outline"><Link to={link.to_path}>{link.anchor_text}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 rounded-2xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-bold">Search and source quality</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">ResKonnect separates public source facts, ResKonnect analysis and items that still require independent verification. Search visibility never replaces legal, institutional, accreditation or investment due diligence.</p>
          {normalizedPath.startsWith("/propert") || normalizedPath.includes("accommodation-for-sale") || normalizedPath.includes("development") ? (
            <p className="mt-3 text-sm text-muted-foreground">For third-party property listings, use the official source or appointed practitioner for transaction, auction and mandate information.</p>
          ) : null}
        </section>
      </main>
    </PublicLayout>
  );
};

export default ManagedSeoPage;
