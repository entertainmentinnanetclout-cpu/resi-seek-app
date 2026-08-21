import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/seo/seoConfig";

export default function PropertyOpportunityDetail(){
  const {slug}=useParams(); const [p,setP]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const {data}=await supabase.from("property_opportunities" as any).select("*").eq("slug",slug).eq("is_published",true).maybeSingle();setP(data);setLoading(false)})()},[slug]);
  if(loading)return <main className="min-h-screen bg-background"/>;
  if(!p)return <main className="mx-auto max-w-4xl px-4 py-20"><SEO title="Property opportunity not found | ResKonnect" description="This property opportunity is not currently published." noIndex/><h1 className="text-3xl font-bold">Property opportunity not available</h1><Link to="/properties" className="mt-6 inline-block text-primary">Browse property opportunities</Link></main>;
  const place=[p.suburb,p.city,p.province].filter(Boolean).join(", ");
  const title=`${p.name}${place?` – ${place}`:""} | ResKonnect Property Intelligence`;
  const description=p.summary||`View price, location, advertised capacity, source and due-diligence information for ${p.name}${place?` in ${place}`:""}.`;
  const schema={"@context":"https://schema.org","@type":"WebPage",name:p.name,description,url:`${SITE_URL}/properties/${p.slug}`,dateModified:p.updated_at,mainEntity:{"@type":"Place",name:p.name,address:p.address?{"@type":"PostalAddress",streetAddress:p.address,addressLocality:p.city,addressRegion:p.province,addressCountry:"ZA"}:undefined,geo:p.latitude&&p.longitude?{"@type":"GeoCoordinates",latitude:p.latitude,longitude:p.longitude}:undefined}};
  return <main className="min-h-screen bg-background text-foreground"><SEO title={title} description={description} canonicalPath={`/properties/${p.slug}`} jsonLd={schema}/>
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      <Link to="/properties" className="text-sm font-semibold text-primary">← Property intelligence</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-primary">{p.opportunity_type}</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{p.name}</h1>
      {place&&<p className="mt-4 text-lg text-muted-foreground">{place}</p>}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Price",p.asking_price!=null?`R ${Number(p.asking_price).toLocaleString("en-ZA")}`:"POA"],["Price basis",p.price_basis||"Verify with source"],["Advertised capacity",p.advertised_bed_capacity?`${p.advertised_bed_capacity} beds`:"Not stated"],["Nearest institution",p.nearest_institution||"Not verified"]].map(([k,v])=><div key={k} className="rounded-2xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p><p className="mt-2 font-bold">{v}</p></div>)}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <article className="space-y-8"><section><h2 className="text-2xl font-bold">ResKonnect property summary</h2><p className="mt-3 leading-7 text-muted-foreground">{description}</p></section>
          <section><h2 className="text-2xl font-bold">Due diligence</h2><p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">{p.due_diligence_notes||"Verify title deed, zoning, approved building plans, occupancy/fire compliance, current leases, municipal accounts and any accreditation claim independently before relying on the property as student accommodation."}</p></section>
          {p.accreditation_claim&&<section><h2 className="text-2xl font-bold">Accreditation claim</h2><p className="mt-3 leading-7 text-muted-foreground">{p.accreditation_claim}</p><p className="mt-2 text-sm font-semibold">ResKonnect does not treat third-party accreditation wording as verified unless independently confirmed.</p></section>}
        </article>
        <aside className="rounded-2xl border border-border bg-card p-6"><h2 className="font-bold">Source & verification</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-muted-foreground">Source</dt><dd className="font-semibold">{p.source_name||"Third-party listing"}</dd></div><div><dt className="text-muted-foreground">Last verified</dt><dd className="font-semibold">{p.last_verified_at?new Date(p.last_verified_at).toLocaleDateString("en-ZA"):"Verification required"}</dd></div>{p.auction_date&&<div><dt className="text-muted-foreground">Auction date</dt><dd className="font-semibold">{new Date(p.auction_date).toLocaleString("en-ZA")}</dd></div>}</dl>{p.source_url&&<a className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground" href={p.source_url} rel="nofollow noopener noreferrer" target="_blank">View official source</a>}</aside>
      </div>
    </div></main>;
}
