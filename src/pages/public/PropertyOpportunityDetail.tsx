import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, ShieldAlert } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const SITE_URL = "https://www.reskonnect.org";

const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
};

async function loadProperty(slug: string) {
  const { data, error } = await db
    .from("property_opportunities")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const PropertyOpportunityDetail = () => {
  const { slug = "" } = useParams();
  const { data: property, isLoading, error } = useQuery({
    queryKey: ["property-opportunity", slug],
    queryFn: () => loadProperty(slug),
    enabled: Boolean(slug),
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return <PublicLayout><main className="container mx-auto max-w-5xl px-4 py-16"><div className="h-10 w-2/3 animate-pulse rounded bg-muted" /></main></PublicLayout>;
  }

  if (error || !property) {
    return (
      <PublicLayout>
        <SEO noIndex title="Property not available | ResKonnect" canonicalPath={`/properties/${slug}`} />
        <main className="container mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Property opportunity not available</h1>
          <p className="mt-3 text-muted-foreground">This record may be unpublished, expired or still under verification.</p>
          <Button asChild className="mt-6"><Link to="/properties"><ArrowLeft className="mr-2 h-4 w-4" />Property Intelligence</Link></Button>
        </main>
      </PublicLayout>
    );
  }

  const canonicalPath = `/properties/${property.slug}`;
  const location = [property.address, property.suburb, property.city, property.province].filter(Boolean).join(", ");
  const price = money(property.asking_price);
  const title = `${property.name}${property.city ? `, ${property.city}` : ""} | ResKonnect Property Intelligence`;
  const description = property.summary || `${property.name} is a ${property.opportunity_type || "student-housing property opportunity"}${location ? ` in ${location}` : ""}. View source, price, capacity and due-diligence context on ResKonnect.`;
  const modified = property.updated_at || property.last_verified_at;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: property.name,
    description,
    url: `${SITE_URL}${canonicalPath}`,
    dateModified: modified || undefined,
    about: {
      "@type": "Place",
      name: property.name,
      address: location || undefined,
    },
    isPartOf: { "@type": "WebSite", name: "ResKonnect", url: SITE_URL },
  };

  const facts = [
    ["Opportunity type", property.opportunity_type],
    ["Status", property.status],
    ["Price", price ? `${price}${property.price_basis ? ` · ${property.price_basis}` : ""}` : property.price_basis],
    ["Advertised capacity", property.advertised_bed_capacity ? `${property.advertised_bed_capacity} beds` : null],
    ["Units", property.units_count],
    ["Nearest institution", property.nearest_institution],
    ["Accreditation claim", property.accreditation_claim],
    ["Source", property.source_name],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <PublicLayout>
      <SEO title={title} description={description} canonicalPath={canonicalPath} jsonLd={schema} />
      <main className="container mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3"><Link to="/properties"><ArrowLeft className="mr-2 h-4 w-4" />Property Intelligence</Link></Button>

        <header className="mt-5 max-w-4xl">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{property.opportunity_type || "Property opportunity"}</Badge>
            {property.status && <Badge variant="outline">{property.status}</Badge>}
            {property.reskonnect_score != null && <Badge variant="outline">ResKonnect score {property.reskonnect_score}/100</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">{property.name}</h1>
          {location && <p className="mt-4 flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-5 w-5 shrink-0" />{location}</p>}
          {price && <p className="mt-5 text-3xl font-extrabold">{price}</p>}
          {property.summary && <p data-ai-answer="true" className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{property.summary}</p>}
        </header>

        {property.auction_date && (
          <section className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
            <div className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5" />Auction / sale date</div>
            <p className="mt-2 text-lg">{new Intl.DateTimeFormat("en-ZA", { dateStyle: "full", timeStyle: "short" }).format(new Date(property.auction_date))}</p>
            <p className="mt-2 text-sm text-muted-foreground">Confirm the date, bidder registration, deposit, commission and conditions directly with the appointed auctioneer or sheriff before participating.</p>
          </section>
        )}

        <section aria-labelledby="facts-heading" className="mt-10">
          <h2 id="facts-heading" className="text-2xl font-bold">Property facts</h2>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{String(label)}</dt>
                <dd className="mt-1 font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {(property.due_diligence_notes || property.risk_score != null || property.investment_score != null) && (
          <section aria-labelledby="analysis-heading" className="mt-10">
            <h2 id="analysis-heading" className="text-2xl font-bold">ResKonnect analysis</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {property.investment_score != null && <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Investment score</p><p className="mt-2 text-3xl font-bold">{property.investment_score}/100</p></CardContent></Card>}
              {property.risk_score != null && <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Risk score</p><p className="mt-2 text-3xl font-bold">{property.risk_score}/100</p></CardContent></Card>}
              {property.advertised_bed_capacity && Number(property.asking_price) > 0 && <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Asking cost / advertised bed</p><p className="mt-2 text-2xl font-bold">{money(Number(property.asking_price) / Number(property.advertised_bed_capacity))}</p></CardContent></Card>}
            </div>
            {property.due_diligence_notes && <p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{property.due_diligence_notes}</p>}
          </section>
        )}

        <section aria-labelledby="verification-heading" className="mt-10 rounded-2xl border border-border bg-muted/30 p-6">
          <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /><h2 id="verification-heading" className="text-xl font-bold">Verification and transaction notice</h2></div>
          <p className="mt-3 leading-relaxed text-muted-foreground">Property information can originate from third-party sellers, property practitioners, auctioneers or public sale notices. ResKonnect separates those source claims from its own analysis. Accreditation, zoning, building plans, occupancy, title, income and auction conditions must be independently verified before a transaction.</p>
          {property.last_verified_at && <p className="mt-3 text-sm text-muted-foreground">ResKonnect record last verified: {new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(property.last_verified_at))}</p>}
        </section>

        {property.source_url && (
          <div className="mt-8">
            <Button asChild size="lg"><a href={property.source_url} target="_blank" rel="noopener noreferrer">View official / original source<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
          </div>
        )}
      </main>
    </PublicLayout>
  );
};

export default PropertyOpportunityDetail;
