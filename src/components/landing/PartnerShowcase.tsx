import { useEffect, useState } from "react";
import { ExternalLink, Handshake, ShieldCheck } from "lucide-react";
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

  return (
    <section className="border-y border-border/70 bg-muted/25 py-10 md:py-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                <Handshake className="h-3.5 w-3.5" /> Our ecosystem
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Partners, clients & institutional ecosystem</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Organizations and institutional identities published by ResKonnect to reflect documented collaboration, client, service or ecosystem context.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Relationship labels are shown exactly as configured.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => {
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
