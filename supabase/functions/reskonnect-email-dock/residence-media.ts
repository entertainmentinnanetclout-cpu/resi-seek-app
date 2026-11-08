/**
 * Only render real, publicly published ResKonnect residence photos.
 * Never fetch arbitrary listing URLs (SSRF, credential leakage, private asset URLs).
 */
const APPROVED_BUCKETS = new Set(["admin-images", "residence-assets"]);
const PROJECT_ORIGIN = "https://mefjzkhobkltlbmhusdh.supabase.co";
export type ResidencePhoto = {url:string;label:string}|null;

export function approvedResidencePhoto(value:unknown):string|null{
  if(typeof value!=="string"||value.length>1800)return null;
  let target:URL;
  try{target=new URL(value);}catch{return null;}
  if(target.origin!==PROJECT_ORIGIN||target.protocol!=="https:"||target.username||target.password)return null;
  if(target.search||target.hash)return null;
  const parts=target.pathname.split("/").filter(Boolean);
  if(parts[0]!=="storage"||parts[1]!=="v1"||parts[2]!=="object"||parts[3]!=="public"||!APPROVED_BUCKETS.has(parts[4])||parts.length<6)return null;
  if(parts.some(part=>part==="."||part===".."||/%2f|%5c|%00/i.test(part)))return null;
  return target.toString();
}
export async function residencePhoto(db:any,residenceId:string|null,fallback:unknown[]):Promise<ResidencePhoto>{
 if(!residenceId)return null;
 try{
  const media=await db.from("resmap_residence_media").select("url,thumbnail_url,title")
    .eq("residence_id",residenceId).eq("media_type","photo").eq("is_published",true)
    .order("is_primary",{ascending:false}).order("sort_order",{ascending:true}).limit(12);
  if(!media.error){
   for(const row of media.data||[]){
    const url=approvedResidencePhoto(row.url)||approvedResidencePhoto(row.thumbnail_url);
    if(url)return {url,label:String(row.title||"Residence exterior or interior photo").slice(0,80)};
   }
  }
 }catch{/* Residence media is optional, never block a service notice. */}
 for(const candidate of fallback){
  if(Array.isArray(candidate)){
   for(const item of candidate){const url=approvedResidencePhoto(item);if(url)return {url,label:"Residence listing photo"};}
  }else{
   const url=approvedResidencePhoto(candidate);
   if(url)return {url,label:"Residence listing photo"};
  }
 }
 return null;
}
export async function readPublishedPhotoBytes(url:string|null|undefined):Promise<{bytes:Uint8Array;mime:"image/jpeg"|"image/png"}|null>{
 const approved=approvedResidencePhoto(url);
 if(!approved)return null;
 try{
  const response=await fetch(approved,{redirect:"error",signal:AbortSignal.timeout(4500)});
  if(!response.ok)return null;
  const ct=(response.headers.get("content-type")||"").toLowerCase().split(";")[0];
  if(ct!=="image/png" && ct!=="image/jpeg" && ct!=="image/jpg")return null;
  const size=Number(response.headers.get("content-length")||0);
  if(size>3_000_000)return null;
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>3_000_000||bytes.length<100)return null;
  const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  if(!jpeg&&!png)return null;
  return {bytes,mime:png?"image/png":"image/jpeg"};
 }catch{return null;}
}
