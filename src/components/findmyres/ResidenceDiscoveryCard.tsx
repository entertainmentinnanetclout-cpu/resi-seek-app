import {Link} from "react-router-dom";
import {ArrowUpRight,BadgeCheck,BedDouble,MapPin,ShieldCheck,Star,WalletCards} from "lucide-react";
import {publicPrivateMonthlyRent,hasVerifiedPrivateRent} from "@/lib/residenceListingEvidence";
import {spotlightPhoto} from "@/lib/residenceSpotlight";
import ResidenceInstitutionBadges from "./ResidenceInstitutionBadges";
import type {ResidenceRating} from "@/hooks/usePublicLivingSignals";

type Layout="editorial"|"horizontal"|"compact";
type Props={
 residence:any;layout?:Layout;rating?:ResidenceRating;
 accredited?:boolean;nsfasAccredited?:boolean;rank?:number;rankLabel?:string;className?:string;
};
const money=(n:number)=>"R"+n.toLocaleString("en-ZA");

export default function ResidenceDiscoveryCard({residence,layout="compact",rating,accredited=false,nsfasAccredited=false,rank,rankLabel,className=""}:Props){
 const slug=residence.slug||residence.id;
 const url=`/find-my-res/${encodeURIComponent(slug)}`;
 const photo=spotlightPhoto(residence);
 const amount=publicPrivateMonthlyRent(residence);
 const verifiedPrice=hasVerifiedPrivateRent(residence);
 const location=residence.place_label||residence.city||residence.campus||residence.address||"Location on listing";
 const roomTypes=Array.isArray(residence.room_types)?residence.room_types.filter(Boolean):residence.room_type?[residence.room_type]:[];
 const horizontal=layout==="horizontal";
 const editorial=layout==="editorial";
 return <Link to={url} data-rk-press aria-label={`View ${residence.name}`}
 className={`rk-physical-card rk-motion-card group relative isolate flex min-w-0 overflow-hidden rounded-[22px] border border-[#e9e6df] bg-white text-[#111e36] shadow-[0_10px_28px_rgba(14,29,54,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(14,29,54,.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eea630] ${horizontal?"flex-row":"flex-col"} ${className}`}>
  <div className={`relative shrink-0 overflow-hidden bg-[#e8e9e7] ${horizontal?"w-[39%] min-h-[165px] sm:w-[45%]":editorial?"aspect-[16/11] w-full":"aspect-[5/3] w-full"}`}>
   {photo?<img src={photo} alt={`Photo of ${residence.name}`} loading="lazy" decoding="async"
     className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.06]"
     onError={e=>{e.currentTarget.style.display="none";}}/>:
    <div className="absolute inset-0 flex items-center justify-center bg-[#e8e9e7]"><BedDouble className="h-10 w-10 text-[#acb1b5]"/></div>}
   {rank&&<span className="rk-mask-reveal absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 bg-[#ecb75d] text-sm font-black text-[#16263c] shadow">#{rank}</span>}
   {(accredited||nsfasAccredited)&&<div className="absolute right-3 top-3 flex flex-col gap-1.5">
    {nsfasAccredited&&<span title="Current officially verified NSFAS accreditation evidence" className="inline-flex items-center gap-1 rounded-full border border-[#f5b32f] bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#071326] shadow-sm"><ShieldCheck className="h-3 w-3"/>NSFAS accredited</span>}
    {accredited&&!nsfasAccredited&&<span title="Current official accreditation evidence" className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#13613d]"><BadgeCheck className="h-3 w-3"/>Accredited</span>}
   </div>}
   {residence.is_spotlight===true&&!rank&&<span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#9e6511]">Spotlight</span>}
  </div>
  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
   {rank&&<p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b1761b]">{rankLabel||`Top ${rank} this month`}</p>}
   <h3 className={`line-clamp-2 font-black leading-tight tracking-tight ${editorial?"text-xl":"text-[15px] sm:text-base"}`}>{residence.name}</h3>
   <p className="flex items-start gap-1.5 text-xs text-[#657184]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span className="line-clamp-2">{location}</span></p>
   {rating&&rating.count>0?<div className="flex items-center gap-2 text-xs">
    <span className="inline-flex items-center gap-1 font-black text-[#182b48]"><Star className="h-4 w-4 fill-[#f3b435] text-[#f3b435]"/>{rating.average.toFixed(1)}</span>
    <span className="text-[#7b8592]">({rating.count} student {rating.count===1?"review":"reviews"})</span>
   </div>:null}
   <ResidenceInstitutionBadges residence={residence} compact maxVisible={5}/>
   <div className="flex flex-wrap gap-1.5">
    {residence.accepts_nsfas===true&&<span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e4] px-2.5 py-1 text-[10px] font-semibold text-[#071326]"><WalletCards className="h-3 w-3"/>Accepts NSFAS funding</span>}
    {roomTypes.slice(0,2).map((type:string)=><span key={type} className="rounded-full bg-[#f0f2f6] px-2.5 py-1 text-[10px] font-semibold text-[#3b4b61]">{type}</span>)}
   </div>
   <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-[#edf0f2] pt-3">
    <div><p className="text-[10px] font-medium text-[#8c96a1]">{amount===null?"Monthly price not provided":verifiedPrice?"Verified private monthly rent":"Landlord-reported private rent"}</p>
     <p className="text-lg font-black tracking-tight text-[#102a4b]">{amount===null?"Ask for rent":money(amount)}{amount!==null&&<span className="ml-1 text-[11px] font-medium text-[#798390]">/mo</span>}</p>
    </div>
    <span className="rk-clay-action inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff0ce] text-[#925e12] transition group-hover:bg-[#eeb347] group-hover:text-white"><ArrowUpRight className="rk-arc-on-hover h-4 w-4"/></span>
   </div>
  </div>
 </Link>;
}
