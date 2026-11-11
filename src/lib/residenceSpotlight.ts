import {hasPropertyPhotoReference,hasVerifiedPrivateRent,publicPrivateMonthlyRent} from "@/lib/residenceListingEvidence";

/**
 * Editorial placements only. This is not a verification, accreditation, payment
 * or search-relevance score. A residence must be explicitly visible and selected
 * by an admin before either premium surface can feature it.
 */
export function spotlightPriority(residence:any):number {
 const raw=Number(residence?.spotlight_rank);
 return Number.isInteger(raw)&&raw>=1&&raw<=999?raw:1000;
}

export function rankSpotlightResidences(residences:any[],limit=5):any[] {
 return (Array.isArray(residences)?residences:[])
  .filter(r=>r?.id&&r.is_visible!==false&&r.is_spotlight===true&&hasPropertyPhotoReference(r))
  .sort((a,b)=>
   spotlightPriority(a)-spotlightPriority(b)
   ||String(a.name||"").localeCompare(String(b.name||""))
   ||String(a.id).localeCompare(String(b.id)))
  .slice(0,limit);
}

export function spotlightPhoto(residence:any):string|null {
 const candidates=[residence?.cover_image_url,
  ...(Array.isArray(residence?.images)?residence.images:[]),
  residence?.image_url];
 for(const raw of candidates){
  const value=typeof raw==="string"?raw.trim():typeof raw?.url==="string"?raw.url.trim():"";
  if(value&&(value.startsWith("/")||/^https:\/\//i.test(value)))return value;
 }
 return null;
}

export function spotlightPrice(residence:any):{price:string;label:string} {
 const amount=publicPrivateMonthlyRent(residence);
 if(amount===null)return {price:"Ask for pricing",label:"No confirmed monthly rent supplied"};
 return {price:"R"+amount.toLocaleString("en-ZA")+"/mo",
  label:hasVerifiedPrivateRent(residence)?"Verified private monthly price":"Landlord-reported private rent"};
}

export function spotlightLocation(residence:any):string {
 return [residence?.city||residence?.province,residence?.campus]
  .filter(v=>typeof v==="string"&&v.trim()).join(" · ")||residence?.address||"South Africa";
}
