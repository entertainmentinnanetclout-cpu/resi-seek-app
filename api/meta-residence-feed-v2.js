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

const FALLBACK_SUPABASE_URL = "https://mefjzkhobkltlbmhusdh.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZmp6a2hvYmtsdGxibWh1c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE5ODYsImV4cCI6MjA3NTg4Nzk4Nn0.h9VlKqtA4QMidLh_FbIiNviZRzeLe4OsBs1omh3Jy6U";

function getSupabaseConfig(){
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
  };
}
const asText=(value)=>value==null?"":String(value).trim();
const yesNo=(value)=>value===true?"Yes":value===false?"No":"";
const norm=(value)=>String(value??"").toLowerCase().replace(/[()]/g," ").replace(/\s+/g," ").trim();
const isSosha=(row)=>Array.isArray(row.institution_tags)&&row.institution_tags.some((tag)=>{const v=norm(tag);return v.includes("sosha")||v.includes("tosha");});
const isEkhaya=(row)=>norm(row.name).includes("ekhaya junction");
const unique=(values)=>[...new Set(values.map(asText).filter(Boolean))];

function campusProvince(value){
  const v=norm(value);
  if(/polokwane|giyani/.test(v))return"Limpopo";
  if(/mbombela|nelspruit|emalahleni|witbank/.test(v))return"Mpumalanga";
  if(/pretoria|arcadia|arts campus|soshanguve|ga-rankuwa|garankuwa/.test(v))return"Gauteng";
  return null;
}
function splitCampuses(value){
  const text=String(value||"").trim();
  if(!text)return[];
  return [...new Set(text.replace(/\s+and\s+/gi,",").split(/[,;&|/]+/).map((x)=>x.trim()).filter(Boolean))];
}
function residenceProvince(row){
  return asText(row.canonical_province||row.province);
}
function canonicalAddress(row){
  return asText(row.canonical_address||row.address||row.raw_address);
}
function physicalLocation(row){
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
function campusPolicy(row){
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
function audience(row){
  const student=row.accepts_tvet===true||row.accepts_university===true||row.accepts_nsfas===true;
  const privateTenant=row.accepts_private===true;
  if(student&&privateTenant)return"Both";
  if(privateTenant)return"Private Tenant";
  return"Student";
}
function accreditation(row){
  if(row.is_tut_accredited===true)return"TUT Accredited";
  const level=asText(row.verification_level).toLowerCase();
  if(/verified|trusted|premium|partner/.test(level))return"Verified Partner";
  return"";
}
function roomType(row){
  if(Array.isArray(row.room_types)&&row.room_types.length)return unique(row.room_types).join(", ");
  return asText(row.room_type);
}
function singleAvailability(row){
  if(typeof row.singles_available==="boolean")return yesNo(row.singles_available);
  if(typeof row.singles_available==="number")return row.singles_available>0?"Yes":"No";
  return"";
}
function sharingAvailability(row){
  const values=Array.isArray(row.room_types)?row.room_types:[row.room_type];
  return values.some((value)=>/sharing|shared/i.test(String(value||"")))?"Yes":"";
}
function status(row){
  if(row.available_spots!==null&&row.available_spots!==undefined&&row.available_spots!==""){
    const spots=Number(row.available_spots);
    if(Number.isFinite(spots)&&spots<=0)return"Full";
  }
  return"Active";
}
function publicUrl(row){
  const slug=asText(row.slug);
  return slug?SITE_URL+"/find-my-res/"+encodeURIComponent(slug):"";
}
function imageList(row){
  const source=[];
  if(row.cover_image_url)source.push(row.cover_image_url);
  if(row.image_url)source.push(row.image_url);
  if(Array.isArray(row.images))source.push(...row.images);
  return unique(source);
}
function imageUrl(row){return imageList(row)[0]||"";}
function galleryUrls(row){
  const main=imageUrl(row);
  return imageList(row).filter((url)=>url!==main).join(" | ");
}
function amenities(row){
  const value=row.amenities;
  if(Array.isArray(value))return unique(value).join(", ");
  if(value&&typeof value==="object")return Object.entries(value).filter(([,enabled])=>Boolean(enabled)).map(([key])=>key.replaceAll("_"," ")).join(", ");
  return asText(value);
}
function mapsUrl(row){
  const direct=asText(row.google_maps_url);
  if(direct)return direct;
  if(row.latitude!=null&&row.longitude!=null)return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(String(row.latitude)+","+String(row.longitude));
  const address=canonicalAddress(row);
  return address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address):"";
}
function distanceKm(row){
  const raw=asText(row.distance_from_campus);
  if(!raw)return"";
  const match=raw.replace(",",".").match(/\d+(?:\.\d+)?/);
  return match?Number(match[0]):raw;
}
function distanceCheck(row){
  const value=distanceKm(row);
  if(value==="")return"Distance not supplied";
  const n=Number(value);
  if(!Number.isFinite(n))return"Distance supplied but not machine-readable";
  return n<=20?"Within 20 km accreditation-distance ceiling":"Outside 20 km accreditation-distance ceiling";
}
function dataFreshness(row){
  const updated=new Date(row.updated_at||0).getTime();
  if(!updated)return"Unknown";
  const days=Math.floor((Date.now()-updated)/86400000);
  if(days<=7)return"Fresh";
  if(days<=30)return"Review";
  return"Stale";
}
function fundingSummary(row){
  return [
    "NSFAS: "+(yesNo(row.accepts_nsfas)||"Unknown"),
    "Private: "+(yesNo(row.accepts_private)||"Unknown"),
    "TVET: "+(yesNo(row.accepts_tvet)||"Unknown"),
    "University: "+(yesNo(row.accepts_university)||"Unknown")
  ].join(" | ");
}
function roomSummary(row){
  return [
    "Room type: "+(roomType(row)||"Unknown"),
    "Single available: "+(singleAvailability(row)||"Unknown"),
    "Sharing available: "+(sharingAvailability(row)||"Unknown"),
    "Available spots: "+(row.available_spots??"Unknown")
  ].join(" | ");
}
function metaSummary(row,policy){
  return [
    asText(row.name),
    "Located in "+(physicalLocation(row)||asText(row.canonical_city||row.city)||"location not supplied"),
    "Serves: "+(policy.served.join(", ")||"campuses not supplied"),
    fundingSummary(row),
    roomSummary(row)
  ].filter(Boolean).join(" | ");
}
function agentGuidance(row,policy){
  const location=physicalLocation(row)||asText(row.canonical_city||row.city)||"the stated area";
  return "Match by LOCATION when the student says in/at/near/around "+location+
    ". Match by SERVED CAMPUSES when the student says for/taking/serving/accredited for a campus. "+
    "Do not assume physical proximity from campus eligibility. Province remains a hard boundary. "+
    "Pretoria West to Soshanguve requires Ekhaya Junction or explicit SOSHA exception.";
}
function toFeedRow(row){
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
function recordFromRow(values){
  return Object.fromEntries(COLUMNS.map((column,index)=>[column,values[index]??""]));
}
function csvCell(value){
  const text=value==null?"":String(value);
  return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
}
function toCsv(rows){return rows.map((row)=>row.map(csvCell).join(",")).join("\n");}

async function fetchResidences(){
  const {url,key}=getSupabaseConfig();
  const select=[
    "id","name","slug","campus","province","canonical_province","city","canonical_city","place_label","address","canonical_address","raw_address",
    "price","private_price","nsfas_price","available_spots","accepts_tvet","accepts_university","accepts_private","accepts_nsfas",
    "is_tut_accredited","verification_level","institution_tags","reservations_2027_open","cover_image_url","image_url","images",
    "virtual_tour_url","amenities","room_type","room_types","singles_available","distance_from_campus","latitude","longitude",
    "google_maps_url","updated_at"
  ].join(",");
  const endpoint=new URL(url+"/rest/v1/residences");
  endpoint.searchParams.set("select",select);
  endpoint.searchParams.set("is_visible","eq.true");
  endpoint.searchParams.set("order","province.asc.nullslast,campus.asc.nullslast,name.asc");
  endpoint.searchParams.set("limit","5000");
  const response=await fetch(endpoint,{headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"}});
  if(!response.ok)throw new Error("Supabase residence feed query failed: "+response.status+" "+(await response.text()).slice(0,240));
  return response.json();
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","public, max-age=60, s-maxage=300, stale-while-revalidate=900");
  res.setHeader("X-Robots-Tag","noindex, nofollow");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("X-ResKonnect-Feed-Source","Supabase residences / rich-campus-policy-v3");
  if(req.method!=="GET"&&req.method!=="HEAD"){res.setHeader("Allow","GET, HEAD");return res.status(405).json({error:"Method not allowed"});}
  try{
    const residences=await fetchResidences();
    const rows=residences.map(toFeedRow);
    const format=typeof req.query?.format==="string"?req.query.format.toLowerCase():"csv";
    if(format==="json"){
      res.setHeader("Content-Type","application/json; charset=utf-8");
      return res.status(200).json({
        source:"Supabase residences",
        policy_version:3,
        generated_at:new Date().toISOString(),
        row_count:rows.length,
        columns:COLUMNS,
        rows,
        records:rows.map(recordFromRow)
      });
    }
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    return res.status(200).send(toCsv(rows));
  }catch(error){
    console.error("meta residence feed v3 failed",error);
    if(String(req.query?.format||"").toLowerCase()==="json")return res.status(503).json({error:"Residence feed unavailable"});
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    return res.status(503).send("");
  }
}
