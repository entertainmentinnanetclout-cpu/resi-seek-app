import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);

export default function AdminOpportunityRegistry(){
  const[rows,setRows]=useState<any[]>([]);const[bursaries,setBursaries]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({title:"",organisation:"",type:"internship",location:"",closing:"",applicationUrl:"",sourceUrl:"",description:"",requirements:""});

  const load=useCallback(async()=>{setLoading(true);const[o,b]=await Promise.all([(supabase as any).from("public_opportunities").select("*").order("updated_at",{ascending:false}).limit(200),(supabase as any).from("bursaries").select("id,name,provider,deadline,is_active,last_verified_at,verification_status,source_url").order("deadline",{ascending:true}).limit(200)]);if(o.error)toast.error(o.error.message||"Could not load opportunities");if(b.error)toast.error(b.error.message||"Could not load bursaries");setRows(o.data||[]);setBursaries(b.data||[]);setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);

  const create=async()=>{
    if(!form.title.trim()||!form.organisation.trim()||!form.sourceUrl.trim())return toast.error("Title, organisation and official source URL are required.");
    setSaving(true);
    const now=new Date().toISOString();
    const{error}=await(supabase as any).from("public_opportunities").insert({
      slug:slugify(form.title),title:form.title.trim(),opportunity_type:form.type.trim()||"opportunity",
      organisation:form.organisation.trim(),location:form.location.trim()||null,description:form.description.trim()||null,
      requirements:form.requirements.trim()||null,application_url:form.applicationUrl.trim()||form.sourceUrl.trim(),
      closing_date:form.closing?new Date(form.closing+"T23:59:00+02:00").toISOString():null,date_posted:now,
      employment_type:null,is_published:false,last_verified_at:now,
      metadata:{source_url:form.sourceUrl.trim(),source_class:"admin_verified",official_confirmation_required:true,date_posted_basis:"ResKonnect catalog ingestion date"},
    });
    setSaving(false);if(error)return toast.error(error.message||"Could not create opportunity");
    toast.success("Verified draft created. Review it before publishing.");setForm({title:"",organisation:"",type:"internship",location:"",closing:"",applicationUrl:"",sourceUrl:"",description:"",requirements:""});await load();
  };

  const patch=async(row:any,kind:"publish"|"unpublish"|"verify")=>{
    const update:any={updated_at:new Date().toISOString()};
    if(kind==="publish"){update.is_published=true;update.last_verified_at=new Date().toISOString();}
    if(kind==="unpublish")update.is_published=false;
    if(kind==="verify")update.last_verified_at=new Date().toISOString();
    const{error}=await(supabase as any).from("public_opportunities").update(update).eq("id",row.id);
    if(error)return toast.error(error.message||"Could not update opportunity");toast.success(kind==="verify"?"Verification timestamp refreshed":kind==="publish"?"Opportunity published":"Opportunity unpublished");await load();
  };

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary"/>Opportunity Registry</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3"><Input placeholder="Opportunity title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/><Input placeholder="Organisation" value={form.organisation} onChange={(e)=>setForm({...form,organisation:e.target.value})}/><Input placeholder="Type e.g. internship" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}/></div>
      <div className="grid gap-3 md:grid-cols-3"><Input placeholder="Location" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/><Input type="date" value={form.closing} onChange={(e)=>setForm({...form,closing:e.target.value})}/><Input placeholder="Official application URL" value={form.applicationUrl} onChange={(e)=>setForm({...form,applicationUrl:e.target.value})}/></div>
      <Input placeholder="Official source URL (required)" value={form.sourceUrl} onChange={(e)=>setForm({...form,sourceUrl:e.target.value})}/>
      <div className="grid gap-3 md:grid-cols-2"><Textarea placeholder="Verified description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/><Textarea placeholder="Verified requirements" value={form.requirements} onChange={(e)=>setForm({...form,requirements:e.target.value})}/></div>
      <Button onClick={()=>void create()} disabled={saving}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<ShieldCheck className="mr-2 h-4 w-4"/>}Save verified draft</Button>
    </CardContent></Card>

    <div className="flex items-center justify-between"><div><h3 className="font-black">Public opportunity catalog</h3><p className="text-xs text-muted-foreground">Publishing is explicit. Closed/expired items are removed from the public feed by the existing RG9 hygiene cycle.</p></div><Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div>
    <div className="space-y-2">{rows.map((row)=><div key={row.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{row.title}</p><Badge variant={row.is_published?"default":"outline"}>{row.is_published?"Published":"Draft"}</Badge>{row.last_verified_at&&<Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>Verified {new Date(row.last_verified_at).toLocaleDateString("en-ZA")}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{row.organisation}{row.closing_date?` · closes ${new Date(row.closing_date).toLocaleDateString("en-ZA")}`:""} · {row.metadata?.source_url||"Source URL missing"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void patch(row,"verify")}><CheckCircle2 className="mr-1 h-3.5 w-3.5"/>Verify now</Button><Button size="sm" variant={row.is_published?"destructive":"default"} onClick={()=>void patch(row,row.is_published?"unpublish":"publish")}>{row.is_published?"Unpublish":"Publish"}</Button></div></div>)}</div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Bursary supply</CardTitle></CardHeader><CardContent><div className="space-y-2">{bursaries.filter((x)=>x.is_active).map((row)=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-bold">{row.name}</p><p className="text-xs text-muted-foreground">{row.provider}{row.deadline?` · closes ${new Date(row.deadline).toLocaleDateString("en-ZA")}`:""}</p></div><Badge variant={row.verification_status==="verified"?"default":"outline"}>{row.verification_status||"pending"}</Badge></div>)}</div></CardContent></Card>
  </div>;
}
