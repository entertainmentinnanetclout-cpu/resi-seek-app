/**
 * One promotion policy for Find My Res, the homepage and admin preview.
 * This controls how often a listing is recommended, NOT its publication,
 * search availability, map presence, SEO indexing or application rights.
 */
export type ListingRelationship = "unclassified"|"free"|"partner"|"paying";
export type DiscoveryPlacement = "automatic"|"promote"|"directory_only";

export const LISTING_RELATIONSHIPS:readonly ListingRelationship[]=[
 "unclassified","free","partner","paying"
];
export const DISCOVERY_PLACEMENTS:readonly DiscoveryPlacement[]=[
 "automatic","promote","directory_only"
];

const validPhoto=(candidate:unknown):boolean=>{
 const raw=typeof candidate==="string"?candidate.trim():"";
 if(!raw||/placeholder|default-image|no-image|no_photo|coming-soon|example\.com|dummyimage/i.test(raw))return false;
 return /^https:\/\//i.test(raw)||/^\/storage\/v1\/object\/public\//i.test(raw);
};

/** URL/image storage reference, not proof an uploaded photo renders successfully. */
export function hasMarketableResidencePhoto(residence:any):boolean{
 return [residence?.cover_image_url,residence?.image_url,
  ...(Array.isArray(residence?.images)?residence.images:[])]
  .some(validPhoto);
}

export function isDirectoryOnlyResidence(residence:any):boolean{
 if(!residence||residence.is_visible===false)return false;
 if(residence.discovery_placement==="directory_only")return true;
 if(residence.discovery_placement==="promote")return false;
 return !hasMarketableResidencePhoto(residence);
}

export function isPromotedResidence(residence:any):boolean{
 return !!residence&&residence.is_visible!==false&&
  !isDirectoryOnlyResidence(residence);
}

/** Relationship is admin-declared; never infer 'paying' from a badge or photo. */
export function residenceDiscoveryPriority(residence:any):number{
 if(!isPromotedResidence(residence))return -1;
 const tier=String(residence.listing_relationship||"unclassified");
 const relationship=tier==="paying"?40:tier==="partner"?30:tier==="free"?5:10;
 return (residence.discovery_placement==="promote"?100:0)
  +(residence.is_spotlight===true?55:0)
  +(residence.is_trusted===true?25:0)
  +relationship
  +(hasMarketableResidencePhoto(residence)?10:0);
}

export function sortResidencesForDiscovery<T extends {id?:string;name?:string}>(rows:T[]):T[]{
 return [...rows].sort((a,b)=>
  residenceDiscoveryPriority(b)-residenceDiscoveryPriority(a)
  ||String(a.name||"").localeCompare(String(b.name||""))
  ||String(a.id||"").localeCompare(String(b.id||"")));
}

export const listingRelationshipLabel=(tier:unknown):string=>({
 unclassified:"Not classified",free:"Free directory",partner:"Active partner",paying:"Paying client"
}[String(tier)]||"Not classified");
export const discoveryPlacementLabel=(tier:unknown):string=>({
 automatic:"Automatic (photos first)",promote:"Promote in browse",directory_only:"Search & map only"
}[String(tier)]||"Automatic (photos first)");
