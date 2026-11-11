import {publicPrivateMonthlyRent} from "@/lib/residenceListingEvidence";

/** Strictly local, explainable interpretation of a housing query; no speculative AI output. */
const STOP=new Set(["a","an","the","find","show","me","i","need","looking","for","to","in","at","on","by","with","near","around","close","my","of","and","or","student","students","accommodation","housing","residence","residences","room","rooms","place","places","please","best","good","available","under","below","less","than","maximum","max","budget","up","from","per","month","monthly","rent","rental","between","price","not","more","single","singles","sharing","shared","studio","bachelor","nsfas","funding","private","wifi","wi","fi","parking","furnished","internet","rands"]);
const normal=(v:unknown)=>String(v??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();

export type HousingSearchIntent={
 terms:string[];
 budgetMax:number|null;
 funding:"nsfas"|"private"|null;
 roomTypes:string[];
 amenities:string[];
};

export function interpretHousingSearch(input:string):HousingSearchIntent{
 const raw=String(input||"").trim().slice(0,150);
 const lower=raw.toLowerCase();
 const amount=lower.match(/\b(?:under|below|less than|up to|max(?:imum)?|budget(?: of)?|r)\s*(?:r\s*)?(\d[\d, ]{2,8})\b/i);
 const budgetMax=amount?Number(amount[1].replace(/[^0-9]/g,"")):null;
 const funding=/\bnsfas\b/i.test(lower)?"nsfas":/\bprivate(?:[- ]paying| funding| funded)?\b/i.test(lower)?"private":null;
 const roomTypes=["single","sharing","studio","bachelor"].filter(type=>
  type==="single"?/\bsingles?\b/i.test(lower):type==="sharing"?/\bsharing\b|\bshared\b/i.test(lower):new RegExp(`\\b${type}\\b`,"i").test(lower));
 const amenities=[
  ...(/\bwi[ -]?fi\b|\binternet\b/i.test(lower)?["WiFi"]:[]),
  ...(/\bparking\b/i.test(lower)?["Parking"]:[]),
  ...(/\bfurnished\b/i.test(lower)?["Furnished"]:[])
 ];
 const terms=normal(raw.replace(/(?:under|below|less than|up to|max(?:imum)?|budget(?: of)?|r)\s*(?:r\s*)?\d[\d, ]{2,8}/gi," "))
  .split(/\s+/).filter(word=>word.length>1&&!STOP.has(word)&&!/^\d+$/.test(word));
 return {terms,budgetMax:Number.isFinite(budgetMax)&&budgetMax!==null&&budgetMax>=500&&budgetMax<=100000?budgetMax:null,funding,roomTypes,amenities};
}

export function residenceMatchesHousingSearch(residence:any,search:string|HousingSearchIntent):boolean{
 const intent=typeof search==="string"?interpretHousingSearch(search):search;
 if(intent.funding==="nsfas"&&residence.accepts_nsfas!==true)return false;
 if(intent.funding==="private"&&residence.accepts_private===false)return false;
 if(intent.budgetMax!==null){
  const rent=publicPrivateMonthlyRent(residence);
  if(rent===null||rent>intent.budgetMax)return false;
 }
 const hay=normal([
  residence.name,residence.address,residence.city,residence.canonical_city,
  residence.place_label,residence.campus,residence.description,residence.room_type,
  ...(Array.isArray(residence.room_types)?residence.room_types:[]),
  ...(Array.isArray(residence.institution_tags)?residence.institution_tags:[]),
  ...(Array.isArray(residence.amenities)?residence.amenities:[])
 ].filter(Boolean).join(" "));
 if(!intent.terms.every(term=>hay.includes(term)))return false;
 if(intent.roomTypes.length&&!intent.roomTypes.some(type=>hay.includes(type)||type==="sharing"&&hay.includes("shared")))return false;
 return intent.amenities.every(a=>a==="WiFi"?(residence.has_wifi===true||hay.includes("wifi")||hay.includes("wi fi")):
  a==="Parking"?(residence.has_parking===true||hay.includes("parking")):
  residence.is_furnished===true||hay.includes("furnished"));
}
