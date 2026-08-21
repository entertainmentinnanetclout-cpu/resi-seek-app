import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/seo/seoConfig";

type HubKey = "properties" | "auctions" | "for-sale" | "development" | "ai" | "internships" | "seta";

type Config = { title:string; description:string; h1:string; eyebrow:string; intro:string; keywords:string; kind:"property"|"opportunity"|"static" };
const CONFIG: Record<HubKey, Config> = {
  properties:{title:"Student Housing Property & Investment Opportunities | ResKonnect",description:"Discover student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence across South Africa.",h1:"Student Housing Property Opportunities",eyebrow:"RESKONNECT PROPERTY INTELLIGENCE",intro:"Discover, compare and investigate properties connected to the student-housing market. ResKonnect separates source facts from independent investment indicators so buyers can perform proper due diligence.",keywords:"student accommodation property, student housing investment South Africa, student property Pretoria",kind:"property"},
  auctions:{title:"Student Accommodation Property Auctions South Africa | ResKonnect",description:"Track third-party student housing auctions, sale-in-execution opportunities and properties suitable for student accommodation.",h1:"Student Accommodation Property Auctions",eyebrow:"AUCTIONS & DISTRESSED OPPORTUNITIES",intro:"Track upcoming third-party auctions and distressed student-housing opportunities. ResKonnect is a discovery and intelligence platform unless expressly identified as the appointed practitioner or auctioneer.",keywords:"student accommodation auctions, property auctions Pretoria, student housing auction South Africa",kind:"property"},
  "for-sale":{title:"Student Accommodation for Sale South Africa | ResKonnect",description:"Explore student residences, houses, flats and buildings for sale with student-housing investment potential.",h1:"Student Accommodation for Sale",eyebrow:"ACQUISITION OPPORTUNITIES",intro:"Explore existing student residences and properties with credible student-housing potential, with location, capacity, pricing and verification indicators in one place.",keywords:"student accommodation for sale, student residence for sale, student property South Africa",kind:"property"},
  development:{title:"Student Housing Development Opportunities | ResKonnect",description:"Find houses, buildings and land with student-accommodation conversion or development potential, with due-diligence indicators.",h1:"Student Housing Development Opportunities",eyebrow:"CONVERSION & DEVELOPMENT",intro:"Identify buildings and sites that may support student-housing development. Potential capacity never replaces municipal planning, zoning, building-plan or accreditation approval.",keywords:"student housing development, student accommodation conversion, student development sites",kind:"property"},
  ai:{title:"ResKonnect AI | Student, Course & Property Intelligence",description:"ResKonnect AI connects accommodation discovery, course matching, application readiness, opportunity discovery and property intelligence.",h1:"AI Built Around the Student Journey",eyebrow:"RESKONNECT AI",intro:"ResKonnect AI is being structured around verified platform data: helping students navigate accommodation, applications and opportunities while giving partners and investors stronger decision intelligence.",keywords:"student AI South Africa, AI course match, property intelligence AI, student accommodation AI",kind:"static"},
  internships:{title:"Student Internships South Africa | ResKonnect Opportunities",description:"Discover public internship, graduate and work-experience opportunities relevant to South African students and graduates.",h1:"Student Internships & Graduate Opportunities",eyebrow:"RESKONNECT OPPORTUNITIES",intro:"Find current internship, graduate and workplace-experience opportunities. Each listing should show its source, closing date and last verification date when available.",keywords:"student internships South Africa, graduate opportunities, work experience students",kind:"opportunity"},
  seta:{title:"SETA Opportunities for Students & Graduates | ResKonnect",description:"Find SETA-linked WIL, internship, workplace-experience and graduate opportunities through ResKonnect.",h1:"SETA & Workplace Experience Opportunities",eyebrow:"WIL • SETA • CAREERS",intro:"Explore SETA-linked workplace experience, WIL and graduate opportunities with clear requirements, closing dates and official application direction.",keywords:"SETA opportunities, WIL placements, workplace experience South Africa",kind:"opportunity"},
};

export default function SearchHub({ hub }: { hub: HubKey }) {
  const cfg = CONFIG[hub];
  const [items,setItems] = useState<any[]>([]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(cfg.kind==="property"){
        let q=supabase.from("property_opportunities" as any).select("id,slug,name,opportunity_type,status,suburb,city,province,asking_price,price_basis,auction_date,advertised_bed_capacity,nearest_institution,last_verified_at,summary").eq("is_published",true).limit(24);
        if(hub==="auctions") q=q.not("auction_date","is",null);
        if(hub==="development") q=q.in("opportunity_type",["development","conversion","development_site","conversion_opportunity"]);
        const {data}=await q.order(hub==="auctions"?"auction_date":"updated_at",{ascending:hub==="auctions"});
        if(!cancelled)setItems((data as any[])||[]);
      } else if(cfg.kind==="opportunity"){
        let q=supabase.from("public_opportunities" as any).select("id,slug,title,opportunity_type,organisation,location,province,closing_date,date_posted,last_verified_at").eq("is_published",true).limit(24);
        if(hub==="seta") q=q.ilike("opportunity_type","%seta%");
        const {data}=await q.order("date_posted",{ascending:false}); if(!cancelled)setItems((data as any[])||[]);
      }
    })(); return()=>{cancelled=true};
  },[hub,cfg.kind]);

  const schema=useMemo(()=>({"@context":"https://schema.org","@type":"CollectionPage",name:cfg.h1,description:cfg.description,url:`${SITE_URL}${location.pathname}`,isPartOf:{"@type":"WebSite",name:"ResKonnect",url:SITE_URL},about:["Student accommodation","Higher education","Student opportunities","South Africa"]}),[cfg]);

  return <main className="min-h-screen bg-background text-foreground">
    <SEO title={cfg.title} description={cfg.description} keywords={cfg.keywords} jsonLd={schema}/>
    <section className="border-b border-border/60 bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <p className="mb-3 text-xs font-bold tracking-[0.24em] text-primary">{cfg.eyebrow}</p>
        <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{cfg.h1}</h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">{cfg.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground" to="/student-accommodation">Find accommodation</Link>
          <Link className="rounded-full border border-border px-5 py-2.5 font-semibold" to="/applications">Applications</Link>
          <Link className="rounded-full border border-border px-5 py-2.5 font-semibold" to="/opportunities">Opportunities</Link>
          <Link className="rounded-full border border-border px-5 py-2.5 font-semibold" to="/properties">Property intelligence</Link>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-12">
      {cfg.kind==="static" ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[
        ["Living Intelligence","Search accommodation using structured residence, location and availability data.","/student-accommodation"],
        ["Application Intelligence","Connect Course Match, APS readiness and application guidance.","/applications"],
        ["Opportunity Intelligence","Surface WIL, internships, SETA and graduate opportunities.","/opportunities"],
        ["Property Intelligence","Compare student-housing acquisitions, auctions and conversion opportunities.","/properties"],
      ].map(([t,d,u])=><Link key={t} to={u} className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><h2 className="font-bold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p></Link>)}</div> : items.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{items.map((item)=>{
        const isProp=cfg.kind==="property"; const href=isProp?`/properties/${item.slug}`:`/opportunities/${item.slug}`;
        const heading=isProp?item.name:item.title;
        return <Link key={item.id} to={href} className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">{isProp?item.opportunity_type:item.opportunity_type}</p>
          <h2 className="mt-2 text-xl font-bold">{heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{isProp?[item.suburb,item.city,item.province].filter(Boolean).join(", "): [item.organisation,item.location].filter(Boolean).join(" • ")}</p>
          {isProp&&item.asking_price!=null&&<p className="mt-4 text-lg font-extrabold">R {Number(item.asking_price).toLocaleString("en-ZA")}</p>}
          {item.auction_date&&<p className="mt-2 text-sm">Auction: {new Date(item.auction_date).toLocaleDateString("en-ZA")}</p>}
          {item.closing_date&&<p className="mt-2 text-sm">Closes: {new Date(item.closing_date).toLocaleDateString("en-ZA")}</p>}
        </Link>})}</div> : <div className="rounded-2xl border border-dashed border-border p-10 text-center"><h2 className="text-xl font-bold">Verified listings are being prepared</h2><p className="mt-2 text-muted-foreground">This search hub is live and indexable. Published records will appear automatically after verification.</p></div>}
    </section>
  </main>;
}
