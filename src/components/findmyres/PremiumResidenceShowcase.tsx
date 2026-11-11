import {Link} from "react-router-dom";
import {ArrowRight,Building2,CalendarDays,MapPin,ShieldCheck,Sparkles} from "lucide-react";
import {rankSpotlightResidences,spotlightLocation,spotlightPhoto,spotlightPrice} from "@/lib/residenceSpotlight";

type Props={residences:any[];loading?:boolean;surface:"landing"|"find"};

function FeatureBadges({residence}:{residence:any}){
 return <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
  {residence.accepts_nsfas===true&&<span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-white backdrop-blur">NSFAS accepted</span>}
  {residence.is_tut_accredited===true&&<span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-white backdrop-blur">TUT accredited</span>}
  {residence.reservations_2027_open===true&&<span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-white backdrop-blur">2027 reservations open</span>}
 </div>;
}

function ImageBackdrop({residence,priority}:{residence:any;priority?:boolean}){
 const image=spotlightPhoto(residence);
 return <>
  {image?<img src={image} alt={`${residence.name} accommodation photograph`}
    loading={priority?"eager":"lazy"} decoding="async"
    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.05]"
    onError={e=>{e.currentTarget.style.display="none";}}/>:
   <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(140deg,#112d58,#0c1832)]">
    <Building2 className="h-16 w-16 text-white/35"/>
   </div>}
  <div className="absolute inset-0 bg-gradient-to-t from-[#06152e]/95 via-[#06152e]/35 to-[#06152e]/15"/>
 </>;
}

function LeadResidence({residence}:{residence:any}){
 const price=spotlightPrice(residence);
 const slug=residence.slug||residence.id;
 const spots=Number(residence.available_spots);
 return <Link to={`/find-my-res/${encodeURIComponent(slug)}`}
  className="group relative flex min-h-[380px] overflow-hidden rounded-[25px] border border-white/20 bg-[#0b2143] text-white shadow-[0_22px_50px_rgba(3,16,39,.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_65px_rgba(3,16,39,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 lg:min-h-[505px]"
  aria-label={`View featured residence ${residence.name}`}>
  <ImageBackdrop residence={residence} priority/>
  <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 sm:left-6 sm:top-6">
   <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#0b1933]/75 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
    <Sparkles className="h-3.5 w-3.5 text-[#f6c874]"/> Priority spotlight
   </span>
   {Number.isFinite(spots)&&spots>0&&<span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-[#0b1933]">{spots} reported spaces</span>}
  </div>
  <div className="relative z-10 mt-auto w-full space-y-3 p-5 sm:p-7 lg:p-8">
   <FeatureBadges residence={residence}/>
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0 max-w-[450px]">
     <h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{residence.name}</h3>
     <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-white/85"><MapPin className="mt-0.5 h-4 w-4 shrink-0"/>{spotlightLocation(residence)}</p>
    </div>
    <div className="rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-left backdrop-blur-sm">
     <p className="text-xl font-extrabold tracking-tight">{price.price}</p>
     <p className="mt-0.5 max-w-40 text-[10px] text-white/80">{price.label}</p>
    </div>
   </div>
   <div className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#061b3c] transition group-hover:bg-[#f9ce82]">
    Explore this residence <ArrowRight className="h-4 w-4"/>
   </div>
  </div>
 </Link>;
}

function SupportingResidence({residence,index}:{residence:any;index:number}){
 const slug=residence.slug||residence.id;
 const price=spotlightPrice(residence);
 return <Link to={`/find-my-res/${encodeURIComponent(slug)}`}
  className="group relative isolate flex min-h-[206px] overflow-hidden rounded-[21px] border border-white/20 bg-[#0b2143] text-white shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
  aria-label={`View featured residence ${residence.name}`}>
  <ImageBackdrop residence={residence}/>
  <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/25 bg-[#091b38]/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur">
   <Sparkles className="h-3 w-3 text-[#f6c874]"/> Spotlight {index+2}
  </span>
  <div className="relative z-10 mt-auto min-w-0 space-y-1 p-3.5 sm:p-4">
   <h3 className="line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{residence.name}</h3>
   <p className="line-clamp-1 text-[11px] text-white/80">{spotlightLocation(residence)}</p>
   <div className="flex flex-wrap items-end justify-between gap-1 pt-1">
    <div><p className="text-sm font-black text-white sm:text-base">{price.price}</p><p className="text-[10px] text-white/75">{price.label}</p></div>
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ffe0a6]">View <ArrowRight className="h-3.5 w-3.5"/></span>
   </div>
  </div>
 </Link>;
}

/**
 * The same editorial placements appear immediately beneath the landing hero
 * and at the top of Find My Res, but disappear when students use search filters.
 * Paid sponsored listings are a separate, disclosed placement system.
 */
export default function PremiumResidenceShowcase({residences,loading=false,surface}:Props){
 const items=rankSpotlightResidences(residences,5);
 if(loading&&!items.length)return <section aria-label="Featured residences loading" className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
  <div className="h-24 animate-pulse rounded-2xl bg-muted"/><div className="mt-4 h-80 animate-pulse rounded-3xl bg-muted"/>
 </section>;
 if(!items.length)return null;
 const [lead,...support]=items;
 return <section aria-labelledby={`premium-living-${surface}`} className="relative overflow-hidden border-y border-[#f1e9df] bg-[linear-gradient(130deg,#fff6ef_0%,#fdfaf7_45%,#f3f2f5_100%)] py-9 text-[#152744] md:py-14">
  <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-64 h-[520px] w-[520px] rounded-full bg-[#f4bdaa]/30 blur-[95px]"/>
  <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
   <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
    <div className="max-w-3xl">
     <span className="inline-flex items-center gap-2 rounded-full border border-[#eac9b5] bg-[#fff1e8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-[#b85a46]">
      <Sparkles className="h-3.5 w-3.5"/> ResKonnect Spotlight
     </span>
     <h2 id={`premium-living-${surface}`} className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#152744] sm:text-4xl lg:text-[42px]">
      Discover a place that feels like <span className="text-[#e6786a]">your next chapter.</span>
     </h2>
     <p className="mt-3 max-w-2xl text-sm leading-6 text-[#697689] sm:text-base">
      High-visibility residence selections, brought forward so you can explore the photos, pricing and location in one look.
     </p>
    </div>
    <Link to="/findmyres#results" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#ead6c5] bg-white px-5 text-sm font-bold text-[#192e49] transition hover:border-[#ea8574] hover:bg-[#fff0e8]">
     Browse every residence <ArrowRight className="h-4 w-4"/>
    </Link>
   </div>
   <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-4">
    <LeadResidence residence={lead}/>
    {support.length>0&&<div className="grid grid-cols-2 gap-3 lg:grid-rows-2 lg:gap-4">
     {support.map((residence,index)=><SupportingResidence key={residence.id} residence={residence} index={index}/>)}
    </div>}
   </div>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e4d9cf] pt-4 text-[11px] text-[#747f8c]">
    <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5"/> Spotlight is a ResKonnect editorial placement, not independent accreditation or a live room guarantee.</p>
    <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5"/> Check reported availability and funding terms on each listing.</p>
   </div>
  </div>
 </section>;
}
