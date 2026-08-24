import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, Handshake, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ShowcaseItem {
  id: string;
  slug: string;
  name: string;
  relationship_type: string;
  short_label: string | null;
  description: string | null;
  logo_url: string;
  website_url: string | null;
  compliance_note: string | null;
  is_featured: boolean;
  sort_order: number;
}

const relationshipLabel = (item: ShowcaseItem) => {
  if (item.short_label) return item.short_label;
  const labels: Record<string, string> = {
    founding_company: "Founding company & product developer",
    partner: "Partner",
    strategic_collaborator: "Strategic collaborator",
    client: "Client",
    institutional_ecosystem: "Institutional ecosystem",
    regulatory_reference: "Regulatory / compliance reference",
    technology_provider: "Technology provider",
  };
  return labels[item.relationship_type] || "Ecosystem";
};

const PartnerShowcase = () => {
  const [items, setItems] = useState<ShowcaseItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("partner_showcase")
        .select("id, slug, name, relationship_type, short_label, description, logo_url, website_url, compliance_note, is_featured, sort_order")
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("[PartnerShowcase] Unable to load published identities", error);
        return;
      }
      if (active) setItems((data || []) as ShowcaseItem[]);
    };

    load();
    const channel = supabase
      .channel("partner-showcase-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_showcase" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!items.length) return null;

  const foundingCompany = items.find((item) => item.relationship_type === "founding_company");
  const ecosystemItems = items.filter((item) => item.relationship_type !== "founding_company");

  return (
    <section className="border-y border-border/70 bg-muted/25 py-10 md:py-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                <Handshake className="h-3.5 w-3.5" /> Our ecosystem
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Founding company, partners & institutional ecosystem</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                The organizations behind, working with, serving, or connected to the ResKonnect ecosystem — with each relationship shown using its configured public label.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Relationship labels are shown exactly as configured.
            </div>
          </div>

          {foundingCompany && (
            <div className="mb-5 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-background to-cyan-500/[0.06] shadow-sm">
              <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[220px_1fr_auto] md:items-center">
                <div className="flex min-h-[110px] items-center justify-center rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <img
                    src={foundingCompany.logo_url}
                    alt={`${foundingCompany.name} logo`}
                    className="max-h-20 max-w-full object-contain"
                    loading="eager"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="gap-1"><Sparkles className="h-3 w-3" /> {relationshipLabel(foundingCompany)}</Badge>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">ResKonnect origin</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-tight">ResKonnect is a {foundingCompany.name} product.</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {foundingCompany.description || `${foundingCompany.name} is the founding company and product developer behind ResKonnect.`}
                  </p>
                </div>

                {foundingCompany.website_url && (
                  <a
                    href={foundingCompany.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                    aria-label={`Visit ${foundingCompany.name}`}
                  >
                    Visit {foundingCompany.name} <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {ecosystemItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {ecosystemItems.map((item) => {
                const body = (
                  <div className="group flex h-full min-h-[150px] flex-col items-center justify-center rounded-2xl border bg-background px-4 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                    <div className="flex h-16 w-full items-center justify-center rounded-xl bg-white p-2.5 ring-1 ring-black/5 dark:bg-white">
                      <img
                        src={item.logo_url}
                        alt={`${item.name} logo`}
                        className="max-h-11 max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-bold text-foreground">{item.name}</p>
                    <Badge variant="outline" className="mt-2 max-w-full truncate text-[10px] font-semibold">
                      {relationshipLabel(item)}
                    </Badge>
                    {item.website_url && <ExternalLink className="mt-2 h-3.5 w-3.5 text-muted-foreground transition group-hover:text-primary" />}
                  </div>
                );

                return item.website_url ? (
                  <a key={item.id} href={item.website_url} target="_blank" rel="noreferrer" aria-label={`Visit ${item.name}`}>
                    {body}
                  </a>
                ) : (
                  <div key={item.id}>{body}</div>
                );
              })}
            </div>
          )}

          {items.some((item) => item.compliance_note) && (
            <p className="mt-5 text-[11px] leading-5 text-muted-foreground/80">
              Logo inclusion does not automatically imply endorsement, accreditation or regulatory approval. Any compliance or relationship wording is limited to the published label and supporting context configured by ResKonnect.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default PartnerShowcase;
