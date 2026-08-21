import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const SITE_URL = "https://www.reskonnect.org";

async function loadOpportunity(slug: string) {
  const { data, error } = await db
    .from("public_opportunities")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const PublicOpportunityDetail = () => {
  const { slug = "" } = useParams();
  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: ["public-opportunity", slug],
    queryFn: () => loadOpportunity(slug),
    enabled: Boolean(slug),
    staleTime: 2 * 60_000,
  });

  if (isLoading) return <PublicLayout><main className="container mx-auto max-w-4xl px-4 py-16"><div className="h-10 w-2/3 animate-pulse rounded bg-muted" /></main></PublicLayout>;

  if (error || !opportunity) {
    return (
      <PublicLayout>
        <SEO noIndex title="Opportunity not available | ResKonnect" canonicalPath={`/opportunity/${slug}`} />
        <main className="container mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Opportunity not available</h1>
          <p className="mt-3 text-muted-foreground">This opportunity may be unpublished, closed or under verification.</p>
          <Button asChild className="mt-6"><Link to="/opportunities"><ArrowLeft className="mr-2 h-4 w-4" />Explore opportunities</Link></Button>
        </main>
      </PublicLayout>
    );
  }

  const canonicalPath = `/opportunity/${opportunity.slug}`;
  const title = `${opportunity.title}${opportunity.organisation ? ` | ${opportunity.organisation}` : ""} | ResKonnect`;
  const description = opportunity.description || `View ${opportunity.title} requirements, location, closing date and official application information on ResKonnect.`;
  const location = [opportunity.location, opportunity.province].filter(Boolean).join(", ");
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opportunity.title,
    description,
    url: `${SITE_URL}${canonicalPath}`,
    dateModified: opportunity.updated_at || opportunity.last_verified_at || undefined,
    isPartOf: { "@type": "WebSite", name: "ResKonnect", url: SITE_URL },
  };

  return (
    <PublicLayout>
      <SEO title={title} description={description} canonicalPath={canonicalPath} jsonLd={schema} />
      <main className="container mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3"><Link to="/opportunities"><ArrowLeft className="mr-2 h-4 w-4" />Opportunities</Link></Button>
        <header className="mt-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{opportunity.opportunity_type || "Student opportunity"}</Badge>
            {opportunity.employment_type && <Badge variant="outline">{opportunity.employment_type}</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">{opportunity.title}</h1>
          {opportunity.organisation && <p className="mt-3 text-lg font-medium">{opportunity.organisation}</p>}
          {location && <p className="mt-3 flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-5 w-5 shrink-0" />{location}</p>}
          <p data-ai-answer="true" className="mt-6 text-lg leading-relaxed text-muted-foreground">{description}</p>
        </header>

        {(opportunity.date_posted || opportunity.closing_date) && (
          <section className="mt-8 grid gap-3 sm:grid-cols-2">
            {opportunity.date_posted && <div className="rounded-xl border border-border p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Posted</p><p className="mt-1 flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(opportunity.date_posted))}</p></div>}
            {opportunity.closing_date && <div className="rounded-xl border border-border p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Closing date</p><p className="mt-1 flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(opportunity.closing_date))}</p></div>}
          </section>
        )}

        {opportunity.requirements && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold">Requirements</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{opportunity.requirements}</p>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-6">
          <h2 className="text-xl font-bold">Verification</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">Opportunity dates and requirements can change. ResKonnect keeps public discovery separate from private applicant records and recommends confirming the current requirements with the official organisation before applying.</p>
          {opportunity.last_verified_at && <p className="mt-3 text-sm text-muted-foreground">Last verified: {new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(new Date(opportunity.last_verified_at))}</p>}
        </section>

        {opportunity.application_url && (
          <div className="mt-8"><Button asChild size="lg"><a href={opportunity.application_url} target="_blank" rel="noopener noreferrer">Open official application route<ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
        )}
      </main>
    </PublicLayout>
  );
};

export default PublicOpportunityDetail;
