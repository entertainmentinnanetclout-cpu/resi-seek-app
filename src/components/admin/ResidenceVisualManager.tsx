import {useCallback,useEffect,useMemo,useState} from "react";
import {Building2,ExternalLink,ImagePlus,RefreshCw,Save,Search,ShieldCheck,Sparkles} from "lucide-react";
import {Link} from "react-router-dom";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Label} from "@/components/ui/label";
import {supabase} from "@/integrations/supabase/client";
import ResidenceDiscoveryCard from "@/components/findmyres/ResidenceDiscoveryCard";
import ResidenceInstitutionBadges,{INSTITUTION_SUGGESTIONS,normalizeInstitutionTags} from "@/components/findmyres/ResidenceInstitutionBadges";
import {usePublicLivingSignals} from "@/hooks/usePublicLivingSignals";

type Row=Record<string,any>&{id:string;name:string;slug?:string;institution_tags?:string[]};
const FIELDS=["name","address","place_label","city","campus","province","description","cover_image_url","image_url",
 "accepts_university","accepts_tvet","accepts_private","accepts_nsfas","institution_tags","is_visible","is_spotlight"] as const;
const flags=["accepts_university","accepts_tvet","accepts_private","accepts_nsfas"] as const;
const fieldLabel:Record<string,string>={
 accepts_university:"University students",accepts_tvet:"TVET college students",
 accepts_private:"Private-paying tenants",accepts_nsfas:"Accepts NSFAS funding (not accreditation)",
};
export default function ResidenceVisualManager({rows,onRefresh}:{rows:Row[];onRefresh:()=>Promise<void>}){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [draft,setDraft]=useState<Row|null>(null);
 const [query,setQuery]=useState("");
 const [uploading,setUploading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [previewStyle,setPreviewStyle]=useState<"compact"|"editorial"|"horizontal">("compact");
 const livingSignals=usePublicLivingSignals();
 const selected=rows.find(r=>r.id===selectedId)||null;
 useEffect(()=>{
  if(!selectedId&&rows.length)setSelectedId(rows[0].id);
  if(selectedId&&!rows.some(r=>r.id===selectedId))setSelectedId(rows[0]?.id||null);
 },[rows,selectedId]);
 useEffect(()=>{setDraft(selected?{...selected,institution_tags:[...(selected.institution_tags||[])]}:null);},[selectedId,selected?.updated_at]);
 const dirty=useMemo(()=>!!draft&&!!selected&&FIELDS.some(k=>JSON.stringify(draft[k]??null)!==JSON.stringify(selected[k]??null)),[draft,selected]);
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return rows.filter(r=>!q||[r.name,r.city,r.campus,r.address,...(r.institution_tags||[])].join(" ").toLowerCase().includes(q))
   .sort((a,b)=>a.name.localeCompare(b.name));
 },[rows,query]);
 const set=(key:string,value:unknown)=>setDraft(current=>current?{...current,[key]:value}:current);
 const toggleTag=(code:string)=>{
  if(!draft)return;
  const tags=normalizeInstitutionTags(draft.institution_tags);
  set("institution_tags",tags.includes(code)?tags.filter(t=>t!==code):[...tags,code]);
 };
 const save=async()=>{
  if(!draft||!selected||!dirty)return toast.info("No changes to publish");
  const payload:Record<string,unknown>={};
  for(const key of FIELDS)if(JSON.stringify(draft[key]??null)!==JSON.stringify(selected[key]??null))payload[key]=draft[key]??null;
  if(!String(draft.name||"").trim()||!String(draft.address||"").trim())return toast.error("Residence name and address are required");
  if((payload.institution_tags as string[]||[]).length>30)return toast.error("Select no more than 30 institutions");
  if(payload.institution_tags)payload.institution_tags=normalizeInstitutionTags(payload.institution_tags);
  setSaving(true);
  const {data,error}=await (supabase as any).from("residences").update(payload).eq("id",selected.id)
   .select("id,name,slug,updated_at").maybeSingle();
  setSaving(false);
  if(error||!data)return toast.error(error?.message||"Property update was not confirmed");
  toast.success("Residence saved. Public cards and name-based URL are refreshed.");
  await onRefresh();
 };
 const upload=async(file?:File|null)=>{
  if(!file||!draft)return;
  if(!["image/png","image/webp","image/jpeg"].includes(file.type)||file.size>6*1024*1024)
   return toast.error("Use JPG, PNG or WebP under 6 MB");
  setUploading(true);
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path="visual-residences/"+draft.id+"/"+Date.now()+"."+extension;
  const {error}=await supabase.storage.from("admin-images").upload(path,file,{upsert:false,contentType:file.type});
  if(error){setUploading(false);return toast.error(error.message||"Image upload failed");}
  const url=supabase.storage.from("admin-images").getPublicUrl(path).data.publicUrl;
  setDraft(d=>d?{...d,cover_image_url:url,image_url:d.image_url||url}:d);
  setUploading(false);
  toast.success("Photo uploaded. Click Publish changes to update the listing.");
 };
 return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(235px,.7fr)_minmax(0,1.25fr)_minmax(260px,.8fr)]">
  <Card className="min-w-0 overflow-hidden"><CardContent className="p-4">
   <div className="mb-3 flex items-center justify-between gap-2"><p className="font-black">Property gallery</p><Badge variant="secondary">{rows.length}</Badge></div>
   <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, area, TUT, UP, TNC..."/></div>
   <div className="max-h-[75vh] space-y-1.5 overflow-auto pr-1">
    {filtered.map(r=><button type="button" key={r.id} onClick={()=>{if(dirty&&!window.confirm("Discard unsaved property changes?"))return;setSelectedId(r.id);}}
     className={"flex w-full items-center gap-3 rounded-xl border p-2 text-left transition "+(r.id===selectedId?"border-[#2563eb] bg-[#eef4ff]":"border-transparent hover:border-[#dce4f0]")}>
     <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {r.cover_image_url||r.image_url?<img src={r.cover_image_url||r.image_url} alt="" className="h-full w-full object-cover"/>:<Building2 className="m-auto mt-3 h-5 w-5 text-slate-400"/>}
     </div>
     <div className="min-w-0"><p className="truncate text-xs font-black">{r.name}</p><p className="truncate text-[11px] text-muted-foreground">{r.city||r.campus||"Area not set"} · {r.is_visible===false?"Hidden":"Published"}</p></div>
    </button>)}
   </div>
  </CardContent></Card>
  {!draft?<Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Choose a residence to edit.</CardContent></Card>:
  <Card className="min-w-0 overflow-hidden"><CardContent className="space-y-5 p-4 sm:p-5">
   <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-black uppercase tracking-widest text-[#2563eb]">Property editor</p><h2 className="mt-1 text-xl font-black">{draft.name}</h2><p className="mt-1 text-xs text-muted-foreground">Public URL: /find-my-res/{draft.slug||draft.id}</p></div><Button disabled={saving||!dirty} onClick={()=>void save()}><Save className="mr-2 h-4 w-4"/>{saving?"Publishing…":"Publish changes"}</Button></div>
   <div className="grid gap-3 sm:grid-cols-2">
    {([["Residence name","name"],["Street address","address"],["Public location","place_label"],["City","city"],["Campus reference","campus"],["Province","province"]] as const).map(([label,key])=>
     <div key={key} className={key==="address"?"sm:col-span-2":""}><Label htmlFor={"rk-edit-"+key}>{label}</Label><Input id={"rk-edit-"+key} className="mt-1" value={draft[key]||""} onChange={e=>set(key,e.target.value)}/></div>)}
    <div className="sm:col-span-2"><Label htmlFor="rk-edit-description">Public description</Label><Textarea id="rk-edit-description" className="mt-1 min-h-24" value={draft.description||""} onChange={e=>set("description",e.target.value)}/></div>
   </div>
   <section className="rounded-2xl border p-4">
    <h3 className="flex items-center gap-2 text-sm font-black"><ImagePlus className="h-4 w-4"/>Public listing photograph</h3>
    <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-xs font-bold hover:bg-muted">{uploading?"Uploading…":"Upload listing cover photo"}<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>void upload(e.target.files?.[0])}/></label>
    <Label htmlFor="rk-edit-cover" className="mt-3 block">Or use an approved image URL</Label><Input id="rk-edit-cover" value={draft.cover_image_url||""} onChange={e=>set("cover_image_url",e.target.value)}/>
   </section>
   <section className="space-y-3 rounded-2xl border border-[#dce4f0] bg-[#f8fafc] p-4">
    <h3 className="text-sm font-black">Student audience and accepted institutions</h3>
    <p className="text-xs leading-5 text-muted-foreground">These are landlord-reported acceptance categories. TUT, UP, TNC and other exact institution badges only appear after you explicitly select them.</p>
    <div className="grid gap-2 sm:grid-cols-2">{flags.map(key=><label key={key} className="flex items-center justify-between gap-2 rounded-lg border bg-white p-2.5"><span className="text-xs font-semibold">{fieldLabel[key]}</span><Switch checked={draft[key]===true} onCheckedChange={value=>set(key,value)}/></label>)}</div>
    <div className="flex flex-wrap gap-1.5">{INSTITUTION_SUGGESTIONS.filter(item=>item.code!=="TSC COLLEGE").map(item=>{
     const checked=normalizeInstitutionTags(draft.institution_tags).includes(item.code);
     return <Button key={item.code} type="button" size="sm" variant={checked?"default":"outline"} aria-pressed={checked} title={item.label} className="h-8 rounded-full text-[11px]" onClick={()=>toggleTag(item.code)}>{item.code}</Button>;
    })}</div>
    <Label htmlFor="rk-edit-inst">Additional accepted institutions (comma-separated)</Label>
    <Input id="rk-edit-inst" value={normalizeInstitutionTags(draft.institution_tags).join(", ")}
     onChange={e=>set("institution_tags",e.target.value.split(",").map(t=>t.trim()).filter(Boolean))}/>
   </section>
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="flex items-center justify-between gap-2 rounded-xl border p-3"><span className="text-xs font-semibold">Published on public search</span><Switch checked={draft.is_visible===true} onCheckedChange={v=>set("is_visible",v)}/></label>
    <label className="flex items-center justify-between gap-2 rounded-xl border p-3"><span className="text-xs font-semibold">Editorial Spotlight</span><Switch checked={draft.is_spotlight===true} onCheckedChange={v=>set("is_spotlight",v)}/></label>
   </div>
   <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Official NSFAS accreditation, verification evidence, student ratings and placement decisions are never editable here.</p>
  </CardContent></Card>}
  <div className="min-w-0 space-y-3">
   <Card className="overflow-hidden"><CardContent className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">Live card preview</p><Badge variant="outline">Unpublished draft</Badge></div>
    <div className="flex flex-wrap gap-1">{(["compact","editorial","horizontal"] as const).map(key=><Button key={key} size="sm" variant={previewStyle===key?"default":"outline"} onClick={()=>setPreviewStyle(key)} className="h-8 text-xs">{key}</Button>)}</div>
    {draft&&<ResidenceDiscoveryCard residence={draft} layout={previewStyle} rating={livingSignals.ratings[draft.id]}
      accredited={livingSignals.accreditedIds.has(draft.id)} nsfasAccredited={livingSignals.nsfasAccreditedIds.has(draft.id)}/>}
    {draft&&<ResidenceInstitutionBadges residence={draft} maxVisible={30}/>}
    {draft&&<Link to={"/find-my-res/"+encodeURIComponent(selected?.slug||selected?.id||"")} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-bold text-[#2563eb]">Open published property <ExternalLink className="h-3.5 w-3.5"/></Link>}
   </CardContent></Card>
   <div className="rounded-xl border border-[#f5b32f]/40 bg-[#fff9eb] p-3 text-xs leading-5 text-[#715019]"><Sparkles className="mr-1 inline h-4 w-4"/>Renaming a property generates a matching URL. Older URLs continue to resolve through secured aliases.</div>
  </div>
 </div>;
}
