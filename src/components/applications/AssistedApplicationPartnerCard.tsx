import { useEffect, useState } from "react";
import { ArrowRight, FileCheck2, GraduationCap, Handshake, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  slug: string;
  name: string;
  description: string;
  service_scope: string[];
  website_url: string | null;
  cta_label: string;
  integration_status: string;
}

const fallback: Partner = {
  slug: "setup",
  name: "SETUP",
  description: "ResKonnect helps you prepare, understand requirements and get your documents ready. SETUP is the assisted-application partner for students who want hands-on support with the actual application submission process.",
  service_scope: ["University applications", "TVET applications", "Application submission assistance", "Document readiness handover"],
  website_url: null,
  cta_label: "Application assistance",
  integration_status: "planned",
};

export default function AssistedApplicationPartnerCard() {
  const [partner, setPartner] = useState<Partner>(fallback);

  useEffect(() => {
    const load = async () => {
      const db = supabase as any;
      const { data } = await db
        .from("application_support_partners")
        .select("slug,name,description,service_scope,website_url,cta_label,integration_status")
        .eq("slug", "setup")
        .eq("is_active", true)
        .maybeSingle();
      if (data) setPartner({ ...fallback, ...data, service_scope: data.service_scope || fallback.service_scope });
    };
    load().catch(() => undefined);
  }, []);

  return (
    <section className="mx-auto my-6 max-w-6xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-violet/10 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-56 overflow-hidden border-b border-primary/10 p-6 lg:border-b-0 lg:border-r">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet/15 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Handshake className="h-7 w-7" /></div>
                <div>
                  <Badge variant="outline" className="mb-1 bg-background/70">Assisted applications</Badge>
                  <h3 className="text-2xl font-black tracking-tight">ResKonnect × {partner.name}</h3>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-2">
                {[{ icon: GraduationCap, label: "Choose" }, { icon: FileCheck2, label: "Prepare" }, { icon: ShieldCheck, label: "Submit with support" }].map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-2xl border bg-background/75 p-3 text-center backdrop-blur">
                    <Icon className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-1 text-[11px] font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Know who does what</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">We prepare you. SETUP can assist with the actual application.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{partner.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {partner.service_scope.map((item) => <Badge key={item} variant="secondary" className="rounded-full px-3 py-1">{item}</Badge>)}
            </div>
            <div className="mt-6 rounded-2xl border bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
              ResKonnect's core role is application readiness, APS/course guidance and document preparation. Assisted submission is a separate partner service so students can clearly see what support they are choosing.
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {partner.website_url ? (
                <Button asChild><a href={partner.website_url} target="_blank" rel="noreferrer">{partner.cta_label}<ArrowRight className="ml-2 h-4 w-4" /></a></Button>
              ) : (
                <Button disabled>{partner.cta_label} · Integration coming soon</Button>
              )}
              <Button variant="outline" asChild><a href="/applications/application-readiness">Prepare on ResKonnect</a></Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}