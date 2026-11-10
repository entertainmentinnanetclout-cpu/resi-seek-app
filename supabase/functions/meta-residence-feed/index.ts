import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE_URL = "https://www.reskonnect.org";
const COLUMNS = [
  "Residence ID","Residence Name","Slug","Served Campuses","Province","Area / City","Address","Student Segment",
  "Accreditation / Verification","SOSHA Exception","NSFAS Accepted","Private Accepted","TVET Accepted","University Accepted",
  "Room Type","Single Rooms Available","Sharing Rooms Available","Monthly Price (R)","NSFAS Price (R)","Private Price (R)",
  "Available Spots","2027 Reservations Open","Application URL","Residence Page URL","Image URL","Virtual Tour URL",
  "Current Status","Published to Meta","Last Updated","Source of Truth","Data Freshness","Meta Summary",
  "Physical Location","Location Intent","Campus Service Intent","Location vs Campus Guidance","Google Maps Search URL",
  "Latitude","Longitude","Distance to Requested Campus (km)","20 km Accreditation Distance Check","Amenities",
  "Gallery / Additional Image URLs","Funding / Eligibility Summary","Room Availability Summary","Agent Search Keywords",
  "Agent CTA","Agent Match Guidance"
];

const asText=(value:unknown)=>value==null?"":String(value).trim();
const yesNo=(value:unknown)=>value===true?"Yes":value===false?"No":"";
const norm=(value:unknown)=>String(value??"").toLowerCase().replace(/[()]/g," ").replace(/\s+/g," ").trim();
const unique=(values:unknown[])=>[...new Set(values.map(asText).filter(Boolean))];
const isSosha=(row:any)=>Array.isArray(row.institution_tags)&&row.institution_tags.some((tag:any)=>{const v=norm(tag);return v.includes("sosha")||v.includes("tosha");});
const isEkhaya=(row:any)=>norm(row.name).includes("ekhaya junction");

function campusProvince(value:unknown){
  const v=norm(value);
  if(/polokwane|giyani/.test(v))return"Limpopo";
  if(/mbombela|nelspruit|emalahleni|witbank/.test(v))return"Mpumalanga";
  if(/pretoria|arcadia|arts campus|soshanguve|ga-rankuwa|garankuwa/.test(v))return"Gauteng";
  return null;
}
function splitCampuses(value:unknown){
  const text=String(value||"").trim();
  if(!text)return[];
  return [...new Set(text.replace(/\s+and\s+/gi,",").split(/[,;&|/]+/).map((x)=>x.trim()).filter(Boolean))];
}
const residenceProvince=(row:any)=>asText(row.canonical_province||row.province);
const canonicalAddress=(row:any)=>asText(row.canonical_address||row.address||row.raw_address);
function physicalLocation(row:any){
  const address=norm(canonicalAddress(row));
  if(address.includes("pretoria west"))return"Pretoria West";
  if(address.includes("soshanguve"))return"Soshanguve";
  if(address.includes("arcadia"))return"Arcadia";
  if(address.includes("sunnyside"))return"Sunnyside";
  if(address.includes("ga-rankuwa")||address.includes("garankuwa"))return"Ga-Rankuwa";
  if(address.includes("polokwane"))return"Polokwane";
  if(address.includes("giyani"))return"Giyani";
  if(address.includes("mbombela")||address.includes("nelspruit"))return"Mbombela";
  if(address.includes("emalahleni")||address.includes("witbank"))return"Emalahleni";
  return asText(row.place_label||row.canonical_city||row.city);
}
function campusPolicy(row:any){
  const province=residenceProvince(row);
  const served=splitCampuses(row.campus).filter((campus)=>{
    const cp=campusProvince(campus);
    return !province||!cp||norm(cp)===norm(province);
  });
  const pretoriaWest=served.some((x)=>norm(x).includes("pretoria west"))||norm([canonicalAddress(row),physicalLocation(row)].filter(Boolean).join(" ")).includes("pretoria west");
  const exception=isEkhaya(row)||isSosha(row);
  const finalCampuses=served.filter((campus)=>!(pretoriaWest&&norm(campus).includes("soshanguve")&&!exception));
  return{province,served:finalCampuses,exception,publishable:Boolean(province&&finalCampuses.length)};
}
function audience(row:any){
  const student=row.accepts_tvet===true||row.accepts_university===true||row.accepts_nsfas===true;
  const privateTenant=row.accepts_private===true;
  if(student&&privateTenant)return"Both";
  if(privateTenant)return"Private Tenant";
  return"Student";
}
function accreditation(row:any){
  if(row.is_tut_accredited===true)return"TUT Accredited";
  const level=asText(row.verification_level).toLowerCase();
  if(/verified|trusted|premium|partner/.test(level))return"Verified Partner";
  return"";
}
function roomType(row:any){
  if(Array.isArray(row.room_types)&&row.room_types.length)return unique(row.room_types).join(", ");
  return asText(row.room_type);
}
function singleAvailability(row:any){
  if(typeof row.singles_available==="boolean")return yesNo(row.singles_available);
  if(typeof row.singles_available==="number")return row.singles_available>0?"Yes":"No";
  return"";
}
function sharingAvailability(row:any){
  const values=Array.isArray(row.room_types)?row.room_types:[row.room_type];
  return values.some((value)=>/sharing|shared/i.test(String(value||"")))?"Yes":"";
}
function status(row:any){
  if(row.available_spots!==null&&row.available_spots!==undefined&&row.available_spots!==""){
    const spots=Number(row.available_spots);
    if(Number.isFinite(spots)&&spots<=0)return"Full";
  }
  return"Active";
}
function publicUrl(row:any){
  const slug=asText(row.slug);
  return slug?SITE_URL+"/find-my-res/"+encodeURIComponent(slug):"";
}
function imageList(row:any){
  const source:any[]=[];
  if(row.cover_image_url)source.push(row.cover_image_url);
  if(row.image_url)source.push(row.image_url);
  if(Array.isArray(row.images))source.push(...row.images);
  return unique(source);
}
const imageUrl=(row:any)=>imageList(row)[0]||"";
function galleryUrls(row:any){
  const main=imageUrl(row);
  return imageList(row).filter((url)=>url!==main).join(" | ");
}
function amenities(row:any){
  const value=row.amenities;
  if(Array.isArray(value))return unique(value).join(", ");
  if(value&&typeof value==="object")return Object.entries(value).filter(([,enabled])=>Boolean(enabled)).map(([key])=>key.replaceAll("_"," ")).join(", ");
  return asText(value);
}
function mapsUrl(row:any){
  const direct=asText(row.google_maps_url);
  if(direct)return direct;
  if(row.latitude!=null&&row.longitude!=null)return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(String(row.latitude)+","+String(row.longitude));
  const address=canonicalAddress(row);
  return address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address):"";
}
function distanceKm(row:any){
  const raw=asText(row.distance_from_campus);
  if(!raw)return"";
  const match=raw.replace(",",".").match(/\d+(?:\.\d+)?/);
  return match?Number(match[0]):raw;
}
function distanceCheck(row:any){
  const value=distanceKm(row);
  if(value==="")return"Distance not supplied";
  const n=Number(value);
  if(!Number.isFinite(n))return"Distance supplied but not machine-readable";
  return n<=20?"Within 20 km accreditation-distance ceiling":"Outside 20 km accreditation-distance ceiling";
}
function dataFreshness(row:any){
  const updated=new Date(row.updated_at||0).getTime();
  if(!updated)return"Unknown";
  const days=Math.floor((Date.now()-updated)/86400000);
  if(days<=7)return"Fresh";
  if(days<=30)return"Review";
  return"Stale";
}
function fundingSummary(row:any){
  return [
    "NSFAS: "+(yesNo(row.accepts_nsfas)||"Unknown"),
    "Private: "+(yesNo(row.accepts_private)||"Unknown"),
    "TVET: "+(yesNo(row.accepts_tvet)||"Unknown"),
    "University: "+(yesNo(row.accepts_university)||"Unknown")
  ].join(" | ");
}
function roomSummary(row:any){
  return [
    "Room type: "+(roomType(row)||"Unknown"),
    "Single available: "+(singleAvailability(row)||"Unknown"),
    "Sharing available: "+(sharingAvailability(row)||"Unknown"),
    "Available spots: "+(row.available_spots??"Unknown")
  ].join(" | ");
}
function metaSummary(row:any,policy:any){
  return [
    asText(row.name),
    "Located in "+(physicalLocation(row)||asText(row.canonical_city||row.city)||"location not supplied"),
    "Serves: "+(policy.served.join(", ")||"campuses not supplied"),
    fundingSummary(row),
    roomSummary(row)
  ].filter(Boolean).join(" | ");
}
function agentGuidance(row:any,policy:any){
  const location=physicalLocation(row)||asText(row.canonical_city||row.city)||"the stated area";
  return "Match by LOCATION when the student says in/at/near/around "+location+
    ". Match by SERVED CAMPUSES when the student says for/taking/serving/accredited for a campus. "+
    "Do not assume physical proximity from campus eligibility. Province remains a hard boundary. "+
    "Pretoria West to Soshanguve requires Ekhaya Junction or explicit SOSHA exception.";
}
function toFeedRow(row:any){
  const page=publicUrl(row),policy=campusPolicy(row),location=physicalLocation(row),address=canonicalAddress(row);
  const mainImage=imageUrl(row),tour=asText(row.virtual_tour_url),map=mapsUrl(row),distance=distanceKm(row);
  const locationIntent="Located in "+(location||asText(row.canonical_city||row.city)||"location not supplied")+(address?" — "+address:"");
  const campusIntent=policy.served.length?"Serves / eligible for: "+policy.served.join(", "):"Served campuses not supplied";
  const locationCampusGuidance="LOCATION and CAMPUS are separate. Physical location: "+(location||"not supplied")+
    ". Eligible campuses: "+(policy.served.join(", ")||"not supplied")+
    ". A request for accommodation IN an area filters location; a request for accommodation FOR a campus filters Served Campuses.";
  const agentSearch=unique([
    row.name,location,row.canonical_city,row.city,policy.province,...policy.served,roomType(row),accreditation(row),
    row.accepts_nsfas===true?"nsfas":"",row.accepts_private===true?"private":""
  ]).join(" | ").toLowerCase();
  const cta=[
    page?"Apply: "+page:"",
    page?"Residence page: "+page:"",
    map?"Location: "+map:"",
    mainImage?"Main image: "+mainImage:"",
    tour?"Virtual tour: "+tour:""
  ].filter(Boolean).join(" | ");
  return[
    asText(row.id),asText(row.name),asText(row.slug),policy.served.join(", "),policy.province,asText(row.canonical_city||row.city),address,
    audience(row),accreditation(row),yesNo(isSosha(row)),yesNo(row.accepts_nsfas),yesNo(row.accepts_private),yesNo(row.accepts_tvet),
    yesNo(row.accepts_university),roomType(row),singleAvailability(row),sharingAvailability(row),row.price??"",row.nsfas_price??"",
    row.private_price??"",row.available_spots??"",yesNo(row.reservations_2027_open),page,page,mainImage,tour,status(row),
    policy.publishable?"Yes":"No",asText(row.updated_at),"Supabase residences table",dataFreshness(row),metaSummary(row,policy),
    location,locationIntent,campusIntent,locationCampusGuidance,map,row.latitude??"",row.longitude??"",distance,distanceCheck(row),
    amenities(row),galleryUrls(row),fundingSummary(row),roomSummary(row),agentSearch,cta,agentGuidance(row,policy)
  ];
}
function recordFromRow(values:any[]){return Object.fromEntries(COLUMNS.map((column,index)=>[column,values[index]??""]));}
function csvCell(value:unknown){
  const text=value==null?"":String(value);
  return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
}
function toCsv(rows:any[][]){return rows.map((row)=>row.map(csvCell).join(",")).join("\n");}

Deno.serve(async(req:Request)=>{
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, HEAD, OPTIONS","Access-Control-Allow-Headers":"content-type"};
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="GET"&&req.method!=="HEAD")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
    if(!supabaseUrl||!anonKey)throw new Error("Supabase runtime is not configured");
    const select=[
      "id","name","slug","campus","province","canonical_province","city","canonical_city","place_label","address","canonical_address","raw_address",
      "price","private_price","nsfas_price","available_spots","accepts_tvet","accepts_university","accepts_private","accepts_nsfas",
      "is_tut_accredited","verification_level","institution_tags","reservations_2027_open","cover_image_url","image_url","images",
      "virtual_tour_url","amenities","room_type","room_types","singles_available","distance_from_campus","latitude","longitude",
      "google_maps_url","updated_at"
    ].join(",");
    const endpoint=new URL(supabaseUrl+"/rest/v1/residences");
    endpoint.searchParams.set("select",select);
    endpoint.searchParams.set("is_visible","eq.true");
    endpoint.searchParams.set("order","province.asc.nullslast,campus.asc.nullslast,name.asc");
    endpoint.searchParams.set("limit","5000");
    const response=await fetch(endpoint,{headers:{apikey:anonKey,Authorization:"Bearer "+anonKey,Accept:"application/json"}});
    if(!response.ok)throw new Error("Residence query failed: "+response.status+" "+(await response.text()).slice(0,240));
    const residences=await response.json();
    const rows=residences.map(toFeedRow);
    const url=new URL(req.url);
    const format=(url.searchParams.get("format")||"csv").toLowerCase();
    const headers={...cors,"Cache-Control":"public, max-age=60, s-maxage=300, stale-while-revalidate=900","X-Robots-Tag":"noindex, nofollow","X-ResKonnect-Feed-Source":"Supabase Edge / rich-campus-policy-v3"};
    if(req.method==="HEAD")return new Response(null,{status:200,headers});
    if(format==="json")return new Response(JSON.stringify({source:"Supabase residences",policy_version:3,generated_at:new Date().toISOString(),row_count:rows.length,columns:COLUMNS,rows,records:rows.map(recordFromRow)}),{status:200,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
    return new Response(toCsv(rows),{status:200,headers:{...headers,"Content-Type":"text/csv; charset=utf-8"}});
  }catch(error){
    console.error("meta-residence-feed failed",error);
    return new Response(JSON.stringify({error:"Residence feed unavailable"}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
  }
});