import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Link,useOutletContext} from "react-router-dom";
import {ArrowLeft,ArrowRight,BedDouble,Camera,Check,CheckCircle2,ChevronDown,Clock,ExternalLink,FileText,ImagePlus,MapPin,Plus,Save,ShieldCheck,Trash2,UploadCloud} from "lucide-react";
import {toast} from "sonner";
import SEO from "@/components/SEO";
import {useAuth} from "@/contexts/AuthContext";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Checkbox} from "@/components/ui/checkbox";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Progress} from "@/components/ui/progress";
import type {ResidencePortalContext} from "./ResidenceLayout";
import {listingStudioIssues,listingMinimumPrivateRent} from "@/lib/listingStudioRules";

type Room={id:string;name:string;capacity:number;available_beds:number;private_price:number;deposit:number};
type Photo={id:string;url:string;room_tag:string};
type Listing={
 name:string;city:string;place_label:string;address:string;province:string;campus:string;
 description:string;letting_mode:"room_by_room"|"whole_property";academic_year:number;
 rooms:Room[];photos:Photo[];lease_period:string;move_in_date:string;
 is_furnished:boolean;has_wifi:boolean;has_parking:boolean;utilities_included:boolean;
 extras:string[];verification_method:""|"property_documents"|"staff_review";
 agree_terms:boolean;video_url:string;
};
type DraftState={status:"draft"|"submitted"|"approved"|"changes_requested";reviewer_note:string|null;revision:number};
const sections=[
 {title:"Your property",detail:"Address, nearby campus and letting model",icon:MapPin},
 {title:"Rooms & rates",detail:"Capacity, real availability and pricing",icon:BedDouble},
 {title:"Real photographs",detail:"Cover, gallery and room tags",icon:Camera},
 {title:"Lease & features",detail:"Move-in, lease terms and amenities",icon:FileText},
 {title:"Verification",detail:"Trust checks without self-accreditation",icon:ShieldCheck},
 {title:"Review & submit",detail:"Preview before admin publication",icon:CheckCircle2},
] as const;
const id=()=>crypto.randomUUID();
const startDraft=(r:any):Listing=>({
 name:r.name||"",city:r.city||"",place_label:r.place_label||"",address:r.address||"",
 province:r.province||"",campus:r.campus||"",description:r.description||"",
 letting_mode:"room_by_room",academic_year:2027,
 rooms:[],photos:[],lease_period:r.lease_period||"10 months (academic year)",
 move_in_date:"2027-01-15",is_furnished:!!r.is_furnished,has_wifi:!!r.has_wifi,
 has_parking:!!r.has_parking,utilities_included:!!r.utilities_included,extras:[],
 verification_method:"",agree_terms:false,video_url:r.virtual_tour_url||""
});
const cash=(x:number)=>"R"+Number(x||0).toLocaleString("en-ZA");
const textField=(label:string,value:string,onChange:(v:string)=>void,placeholder?:string)=><div className="space-y-1.5"><Label>{label}</Label><Input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="h-12 text-base"/></div>;

export default function ResidenceListingWizard(){
 const {residence}=useOutletContext<ResidencePortalContext>();
 const {user}=useAuth();
 const [listing,setListing]=useState<Listing|null>(null);
 const [draft,setDraft]=useState<DraftState|null>(null);
 const [step,setStep]=useState(0);
 const [loading,setLoading]=useState(true);
 const [dirty,setDirty]=useState(false);
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const savingRef=useRef(false);
 const editRevision=useRef(0);
 const roomTotal=useMemo(()=>listing?.rooms.reduce((sum,r)=>sum+Number(r.capacity||0),0)||0,[listing]);
 const minimumRent=listing?listingMinimumPrivateRent(listing.rooms):null;
 const errors=useMemo(()=>listing?listingStudioIssues(listing):[],[listing]);
 const readonly=draft?.status==="submitted";
 const change=useCallback((patch:Partial<Listing>)=>{
   editRevision.current+=1;
   setListing(old=>old?{...old,...patch}:old);setDirty(true);
 },[]);
 const load=useCallback(async()=>{
   if(!residence?.id)return;
   setLoading(true);
   try{
    const [stored,base,existingRooms]=await Promise.all([
      (supabase as any).from("reskonnect_listing_studio_drafts").select("*").eq("residence_id",residence.id).maybeSingle(),
      (supabase as any).from("residences").select("*").eq("id",residence.id).single(),
      (supabase as any).from("residence_room_types").select("id,name,capacity,available_beds,private_price,deposit,academic_year,is_active").eq("residence_id",residence.id).eq("is_active",true)
    ]);
    if(stored.error)throw stored.error;
    if(base.error)throw base.error;
    const initial=startDraft(base.data);
    if(existingRooms.data?.length)initial.rooms=existingRooms.data.filter((r:any)=>r.academic_year===2027).map((r:any)=>({
      id:r.id,name:r.name,capacity:r.capacity,available_beds:r.available_beds,private_price:Number(r.private_price||0),deposit:Number(r.deposit||0)
    }));
    const recovered=stored.data?.payload;
    setListing(recovered&&typeof recovered==="object"?{...initial,...recovered}:initial);
    setDraft(stored.data?{status:stored.data.status,reviewer_note:stored.data.reviewer_note,revision:stored.data.revision}:null);
    setStep(Math.max(0,Math.min(5,Number(stored.data?.step_index||0))));
    setDirty(false);
   }catch(e){toast.error(e instanceof Error?e.message:"Could not load listing draft");}
   finally{setLoading(false);}
 },[residence?.id]);
 useEffect(()=>{void load();},[load]);

 const save=useCallback(async(next:Listing,index:number,silent=false)=>{
  if(!residence?.id||!user?.id||savingRef.current)return false;
  if(readonly){if(!silent)toast.error("This listing is already awaiting staff review.");return false;}
  savingRef.current=true;setSaving(true);
  const savingVersion=editRevision.current;
  try{
   const record={payload:next,step_index:index,status:"draft"};
   const db=supabase as any;
   const res=draft
    ?await db.from("reskonnect_listing_studio_drafts").update(record).eq("residence_id",residence.id).select("revision").single()
    :await db.from("reskonnect_listing_studio_drafts").insert({residence_id:residence.id,owner_id:user.id,...record}).select("revision").single();
   if(res.error)throw res.error;
   setDraft({status:"draft",reviewer_note:draft?.reviewer_note||null,revision:res.data.revision});
   if(savingVersion===editRevision.current)setDirty(false);
   if(!silent)toast.success("Draft saved securely");
   return true;
  }catch(e){if(!silent)toast.error(e instanceof Error?e.message:"Could not save draft");return false;}
  finally{savingRef.current=false;setSaving(false);}
 },[residence?.id,user?.id,draft,readonly]);
 // Save a durable draft after edits; submit still waits for an explicit review.
 useEffect(()=>{
  if(!dirty||!listing||readonly||loading||saving)return;
  // Queue a retry after an in-flight save finishes, instead of dropping edits.
  const timer=window.setTimeout(()=>void save(listing,step,true),1500);
  return ()=>window.clearTimeout(timer);
 },[dirty,listing,step,save,readonly,loading,saving]);
 const advance=async(direction:number)=>{
  if(!listing)return;
  const nextStep=Math.max(0,Math.min(5,step+direction));setStep(nextStep);
  // Persist section progress even when another autosave is still in-flight.
  if(!readonly){editRevision.current+=1;setDirty(true);if(!savingRef.current)await save(listing,nextStep,true);}
 };
 const uploadPhotos=async(files:FileList|null)=>{
  if(!files||!listing||!residence?.id||readonly)return;
  if(files.length+listing.photos.length>30)return toast.error("Maximum 30 photos per listing.");
  setUploading(true);
  const next=[...listing.photos];
  for(const file of Array.from(files)){
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>6_000_000||file.size<3000){
    toast.error("Choose a JPEG, PNG or WebP image between 3 KB and 6 MB.");continue;
   }
   const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
   const path=residence.id+"/studio/"+id()+"."+ext;
   const {error}=await supabase.storage.from("residence-assets").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
   if(error){toast.error("Photo upload failed: "+error.message);continue;}
   const {data}=supabase.storage.from("residence-assets").getPublicUrl(path);
   next.push({id:id(),url:data.publicUrl,room_tag:"Residence"});
  }
  change({photos:next});setUploading(false);
 };
 const submit=async()=>{
  if(!listing||!residence?.id||errors.length||readonly)return;
  if(!window.confirm("Submit this property information and real photos for ResKonnect admin review? Nothing is published automatically."))return;
  setSubmitting(true);
  try{
   const saved=await save(listing,5,true);
   if(!saved)throw Error("Save the latest draft before submitting");
   const {data,error}=await (supabase as any).from("reskonnect_listing_studio_drafts")
     .update({status:"submitted",step_index:5}).eq("residence_id",residence.id).select("status,revision").single();
   if(error)throw error;
   setDraft({status:data.status,revision:data.revision,reviewer_note:null});setDirty(false);
   toast.success("Listing submitted to ResKonnect for verification and approval.");
  }catch(e){toast.error(e instanceof Error?e.message:"Could not submit listing");}
  finally{setSubmitting(false);}
 };
 const rooms=listing?.rooms||[];
 const setRoom=(roomId:string,patch:Partial<Room>)=>change({rooms:rooms.map(r=>r.id===roomId?{...r,...patch}:r)});
 const removePhoto=(photoId:string)=>change({photos:(listing?.photos||[]).filter(p=>p.id!==photoId)});
 const movePhoto=(index:number,offset:number)=>{
  const next=[...(listing?.photos||[])],target=index+offset;
  if(target<0||target>=next.length)return;
  [next[index],next[target]]=[next[target],next[index]];
  change({photos:next});
 };
 if(!residence||loading||!listing)return <div role="status" className="p-10 text-center text-sm text-muted-foreground">Loading secure listing workspace…</div>;
 const Icon=sections[step].icon;
 return <div className="mx-auto max-w-6xl space-y-5 pb-20">
  <SEO noIndex title={"Guided Listing Studio | "+residence.name+" | ResKonnect"} description="Create a real residence listing with automatic draft saving, verification and official review."/>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-widest text-primary">ResKonnect · Landlord Listing Studio</p>
    <h1 className="mt-1 text-2xl font-black sm:text-3xl">Your property, ready for students.</h1>
    <p className="mt-2 text-sm text-muted-foreground">Six guided stages · real inventory · safe draft recovery · publication after staff review.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <Badge variant={draft?.status==="approved"?"default":"secondary"}>{draft?.status?.replaceAll("_"," ")||"New draft"}</Badge>
    <Button variant="outline" size="sm" asChild><Link to="/residence/listing">Advanced listing editor</Link></Button>
   </div>
  </div>
  {draft?.reviewer_note&&<div role="status" className="rounded-xl border border-amber-400/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"><strong>Staff review:</strong> {draft.reviewer_note}</div>}
  {readonly&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"><CheckCircle2 className="mb-1 inline h-4 w-4 text-emerald-600"/> Submitted. Staff are checking this listing. Changes will be enabled if corrections are requested.</div>}
  <Card className="overflow-hidden">
   <CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>Step {step+1} of 6 · {sections[step].title}</span>
      <span className="text-xs text-muted-foreground">{saving?"Saving…":dirty?"Unsaved edits":"Draft stored"}</span></div>
    <Progress value={Math.round((step+1)/6*100)} className="h-2"/>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{sections.map((s,i)=><button type="button" key={s.title} aria-label={"Go to "+s.title} onClick={()=>setStep(i)} className={"rounded-lg border px-2 py-2 text-left text-[11px] font-medium transition "+(i===step?"border-primary bg-primary/5 text-primary":"text-muted-foreground hover:bg-muted")}>{i+1}. {s.title}</button>)}</div>
   </CardContent>
  </Card>
  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
   <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Icon className="h-5 w-5 text-primary"/>{sections[step].title}</CardTitle>
     <p className="text-sm text-muted-foreground">{sections[step].detail}</p></CardHeader>
    <CardContent className="space-y-5">
     <fieldset disabled={readonly} className="space-y-5 disabled:opacity-70">
     {step===0&&<div className="space-y-4">
      <div className="space-y-2"><Label>How do you let this property?</Label>
       <div className="grid gap-2 sm:grid-cols-2">{([["room_by_room","Room by room","Each room has an independent capacity and price"],["whole_property","Whole property","One private rental with its own price"]] as const).map(([value,title,detail])=><button key={value} type="button" disabled={readonly} onClick={()=>change({letting_mode:value})} className={"rounded-xl border p-4 text-left "+(listing.letting_mode===value?"border-primary bg-primary/5":"hover:bg-muted")}><strong className="block">{title}</strong><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></button>)}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
       {textField("Residence name",listing.name,v=>change({name:v}),"Actual residence name")}
       {textField("City / town",listing.city,v=>change({city:v}),"Pretoria")}
       {textField("Public suburb / area",listing.place_label,v=>change({place_label:v}),"Arcadia")}
       {textField("Province",listing.province,v=>change({province:v}),"Gauteng")}
       {textField("Nearest campus",listing.campus,v=>change({campus:v}),"TUT Pretoria West")}
       {textField("Street address (verification only)",listing.address,v=>change({address:v}),"Actual street address")}
      </div>
      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Students see the city and general area in the new discovery experience. Your full address is retained in the restricted review draft; exact-map presentation remains subject to ResKonnect's location settings.</p>
      <div className="space-y-1"><Label>Accurate description ({listing.description.length} characters)</Label><Textarea rows={6} value={listing.description} onChange={e=>change({description:e.target.value})} placeholder="What are the rooms like? Who is this property suitable for? Describe nearby transport and only amenities that actually exist." /></div>
     </div>}
     {step===1&&<div className="space-y-4">
      <p className="rounded-lg bg-muted p-3 text-xs">Configure each room type once. For example, a 12-bed property can have 4 single rooms and 4 sharing rooms with two beds each. <strong>Available beds must never exceed capacity.</strong></p>
      <div className="grid gap-3 sm:grid-cols-2">
       <div className="space-y-1"><Label>Academic intake year</Label><Select value={String(listing.academic_year)} onValueChange={v=>change({academic_year:Number(v)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[2026,2027,2028].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
       <div className="rounded-lg border p-3 text-sm"><strong>{roomTotal}</strong> configured beds · <strong>{rooms.reduce((n,r)=>n+(Number(r.available_beds)||0),0)}</strong> landlord-reported available</div>
      </div>
      {rooms.map(room=><div key={room.id} className="space-y-3 rounded-xl border p-4">
       <div className="flex items-center justify-between"><strong>{room.name||"New room type"}</strong><Button size="sm" variant="ghost" aria-label="Remove room type" onClick={()=>change({rooms:rooms.filter(r=>r.id!==room.id)})}><Trash2 className="h-4 w-4"/></Button></div>
       <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Room type</Label><Input value={room.name} placeholder="Single / Sharing / Bachelor" onChange={e=>setRoom(room.id,{name:e.target.value})}/></div>
        {([["capacity","Total beds"],["available_beds","Available beds"],["private_price","Private rent / month (R)"],["deposit","Deposit (R)"]] as const).map(([key,title])=><div key={key} className="space-y-1"><Label>{title}</Label><Input type="number" min={0} step={key.includes("price")||key==="deposit"?"0.01":"1"} value={room[key]} onChange={e=>setRoom(room.id,{[key]:Number(e.target.value)} as Partial<Room>)}/></div>)}
       </div>
      </div>)}
      <Button variant="outline" className="w-full" onClick={()=>change({rooms:[...rooms,{id:id(),name:listing.letting_mode==="whole_property"?"Entire property":"Single room",capacity:1,available_beds:1,private_price:0,deposit:0}]})} disabled={readonly||rooms.length>=12}><Plus className="mr-2 h-4 w-4"/>Add another room type</Button>
     </div>}
     {step===2&&<div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-7 text-center hover:bg-muted/30">
       <UploadCloud className="h-8 w-8 text-primary"/><span className="font-bold">{uploading?"Uploading photos…":"Choose property photographs"}</span><span className="text-xs text-muted-foreground">Minimum 3 to submit · up to 30 · JPG, PNG or WebP, 6 MB each · first image is the cover</span>
       <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple disabled={readonly||uploading} onChange={e=>{void uploadPhotos(e.target.files);e.currentTarget.value="";}}/>
      </label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
       {listing.photos.map((p,i)=><div key={p.id} className="overflow-hidden rounded-xl border">
        <div className="relative"><img src={p.url} alt={"Property photo "+(i+1)} className="aspect-[4/3] w-full object-cover" loading="lazy"/>{i===0&&<Badge className="absolute left-2 top-2">Cover</Badge>}</div>
        <div className="space-y-2 p-2"><Select value={p.room_tag} onValueChange={v=>change({photos:listing.photos.map(x=>x.id===p.id?{...x,room_tag:v}:x)})}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tag area"/></SelectTrigger><SelectContent>{["Residence","Exterior","Kitchen","Bathroom","Lounge",...rooms.map(r=>r.name)].map(tag=><SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select>
         <div className="flex gap-1"><Button variant="outline" size="sm" onClick={()=>movePhoto(i,-1)} disabled={i===0} aria-label="Move photo earlier">←</Button><Button variant="outline" size="sm" onClick={()=>movePhoto(i,1)} disabled={i===listing.photos.length-1} aria-label="Move photo later">→</Button><Button size="sm" variant="ghost" onClick={()=>removePhoto(p.id)} aria-label="Remove photo"><Trash2 className="h-4 w-4"/></Button></div>
        </div>
       </div>)}
      </div>
      <div className="space-y-1"><Label>Video walkthrough URL (optional)</Label><Input type="url" value={listing.video_url} onChange={e=>change({video_url:e.target.value})} placeholder="https://…"/></div>
      <p className="text-xs text-muted-foreground">Use genuine property photos with permission. Images are reviewed before appearing as official listing media. Avoid uploading identity documents into the public property gallery.</p>
     </div>}
     {step===3&&<div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
       <div className="space-y-1"><Label>Lease term</Label><Select value={listing.lease_period} onValueChange={v=>change({lease_period:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Month to month","6 months","10 months (academic year)","12 months","Custom – contact landlord"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
       <div className="space-y-1"><Label>Earliest move-in date</Label><Input type="date" value={listing.move_in_date} onChange={e=>change({move_in_date:e.target.value})}/></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{([["is_furnished","Furnished"],["has_wifi","Wi-Fi available"],["has_parking","Parking on site"],["utilities_included","Utilities included"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-3 rounded-xl border p-3"><Checkbox checked={listing[key]} onCheckedChange={v=>change({[key]:v===true})}/><span className="text-sm font-semibold">{label}</span></label>)}</div>
      <div className="space-y-2"><Label>Additional genuine amenities</Label><div className="grid gap-2 sm:grid-cols-2">{["Security","Study Room","Laundry","Gym","Garden","Bike Storage","Swimming Pool","Shared Kitchen"].map(item=><label key={item} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><Checkbox checked={listing.extras.includes(item)} onCheckedChange={v=>change({extras:v===true?[...listing.extras,item]:listing.extras.filter(e=>e!==item)})}/><span>{item}</span></label>)}</div></div>
      <p className="text-xs text-muted-foreground">Only confirm amenities that exist. Fees, tenancy and official university accreditation are verified separately by staff.</p>
     </div>}
     {step===4&&<div className="space-y-4">
      <p className="text-sm">Choose how ResKonnect should verify your authority to list this accommodation. Verification is separate from the property description and must be approved by staff.</p>
      {([["property_documents","Upload verification documents","Use the existing private compliance portal to provide ownership or management evidence."],["staff_review","Request staff verification","A ResKonnect staff member will follow up and verify the property."]] as const).map(([value,title,detail])=><button key={value} type="button" className={"w-full rounded-xl border p-4 text-left "+(listing.verification_method===value?"border-primary bg-primary/5":"")} onClick={()=>change({verification_method:value})}><strong>{title}</strong><p className="mt-1 text-xs text-muted-foreground">{detail}</p></button>)}
      <Button variant="outline" asChild><Link to="/residence/compliance"><ShieldCheck className="mr-2 h-4 w-4"/>Open private compliance & verification</Link></Button>
      <label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><Checkbox checked={listing.agree_terms} onCheckedChange={v=>change({agree_terms:v===true})}/><span>I confirm the photos and listing details are accurate, I have permission to advertise the property, and I agree to ResKonnect's publishing and privacy rules. No trust or accreditation badge is self-issued.</span></label>
     </div>}
     {step===5&&<div className="space-y-4">
       {listing.photos[0]&&<img src={listing.photos[0].url} alt="Residence listing cover preview" className="aspect-[16/9] w-full rounded-xl object-cover"/>}
       <div><p className="text-xs font-bold uppercase text-primary">Listing preview</p><h3 className="mt-1 text-2xl font-black">{listing.name||"Unnamed residence"}</h3><p className="mt-1 text-sm text-muted-foreground">{[listing.place_label,listing.city].filter(Boolean).join(", ")} · {roomTotal} beds · from {cash(minimumRent||0)} / month</p></div>
       <p className="whitespace-pre-line text-sm">{listing.description||"Add an accurate description of your accommodation."}</p>
       <div className="grid gap-2 sm:grid-cols-2">{rooms.map(r=><div key={r.id} className="rounded-xl border p-3 text-sm"><strong>{r.name}</strong><p className="text-muted-foreground">{r.available_beds}/{r.capacity} beds reported · {cash(r.private_price)}/month</p></div>)}</div>
       {errors.length>0?<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100"><p className="font-bold">Complete these items before submitting:</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs">{errors.map(e=><li key={e}>{e}</li>)}</ul></div>:<div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"><Check className="h-5 w-5 text-emerald-600"/> All required fields are complete. Staff will verify before publishing.</div>}
       <Button className="w-full" size="lg" disabled={readonly||submitting||saving||errors.length>0} onClick={()=>void submit()}>{submitting?"Submitting…":"Submit listing for official review"}<ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>}
    </fieldset>
    </CardContent>
   </Card>
   <div className="space-y-4">
    <Card><CardHeader><CardTitle className="text-base">Listing readiness</CardTitle></CardHeader><CardContent className="space-y-3">
     <div className="flex items-center justify-between text-sm"><span>Photo gallery</span><Badge variant="outline">{listing.photos.length} photos</Badge></div>
     <div className="flex items-center justify-between text-sm"><span>Bed inventory</span><strong>{roomTotal} beds</strong></div>
     <div className="flex items-center justify-between text-sm"><span>Unfinished checks</span><strong>{errors.length}</strong></div>
     <p className="text-xs text-muted-foreground">Submission does not mean the property is verified, accredited or guaranteed visible. Your existing public listing remains intact until staff approval.</p>
    </CardContent></Card>
    <Card><CardContent className="space-y-2 p-4 text-xs"><p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-primary"/>Privacy and trust</p><p className="text-muted-foreground">Documents belong in the private compliance portal, not the public gallery. Exact address handling follows existing ResKonnect map settings.</p></CardContent></Card>
   </div>
  </div>
  <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
    <Button variant="outline" disabled={step===0} onClick={()=>void advance(-1)}><ArrowLeft className="mr-1 h-4 w-4"/>Back</Button>
    <div className="flex gap-2"><Button variant="outline" disabled={saving||readonly} onClick={()=>void save(listing,step)}><Save className="mr-1 h-4 w-4"/>{saving?"Saving…":"Save draft"}</Button>
    {step<5&&<Button onClick={()=>void advance(1)}>Next step <ArrowRight className="ml-1 h-4 w-4"/></Button>}</div>
  </div>
 </div>;
}
