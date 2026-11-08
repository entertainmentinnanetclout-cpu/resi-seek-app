/** Shared browser-level safety checks for the ResKonnect guided listing studio.
 * Database submission rules remain authoritative.
 */
export type StudioRoomInput={name:string;capacity:number;available_beds:number;private_price:number;deposit:number};
export type StudioListingInput={
 name:string;city:string;place_label:string;address:string;description:string;
 rooms:StudioRoomInput[];photos:{url:string}[];lease_period:string;move_in_date:string;
 verification_method:string;agree_terms:boolean;
};
export function listingStudioIssues(x:StudioListingInput):string[]{
 const problems:string[]=[];
 if(x.name.trim().length<3)problems.push("Enter a residence name");
 if(x.city.trim().length<2||x.place_label.trim().length<2)problems.push("Enter city and public suburb");
 if(x.address.trim().length<5)problems.push("Enter the actual address for internal verification");
 if(x.description.trim().length<80)problems.push("Write at least 80 characters of accurate property description");
 if(!x.rooms.length)problems.push("Add at least one room type");
 if(x.rooms.length>12)problems.push("Maximum twelve different room types");
 if(new Set(x.rooms.map(r=>r.name.trim().toLowerCase())).size!==x.rooms.length)problems.push("Use unique room type names");
 if(x.rooms.some(r=>r.name.trim().length<2||!Number.isInteger(r.capacity)||r.capacity<1||
   !Number.isInteger(r.available_beds)||r.available_beds<0||r.available_beds>r.capacity||
   !Number.isFinite(r.private_price)||r.private_price<=0||!Number.isFinite(r.deposit)||r.deposit<0))problems.push("Correct capacity, available beds, deposit and price on every room type");
 if(x.photos.length<3)problems.push("Upload at least three real property photos");
 if(!x.lease_period||!/^\d{4}-\d{2}-\d{2}$/.test(x.move_in_date))problems.push("Provide lease duration and a valid move-in date");
 if(!["staff_review","property_documents"].includes(x.verification_method))problems.push("Choose the property verification route");
 if(!x.agree_terms)problems.push("Confirm the listing terms");
 return problems;
}
export function listingMinimumPrivateRent(rooms:StudioRoomInput[]):number|null{
 const rate=rooms.filter(r=>r.private_price>0).reduce((a,b)=>Math.min(a,b.private_price),Infinity);
 return Number.isFinite(rate)?rate:null;
}
export function isUploadedResidencePhoto(url:string,residenceId:string):boolean{
 const prefix="https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/"+residenceId+"/";
 return typeof url==="string"&&url.startsWith(prefix)&&/\.(png|jpg|jpeg|webp)$/i.test(url)&&
   !/(\.\.|%2e|%2f|%5c|\?|#)/i.test(url);
}
