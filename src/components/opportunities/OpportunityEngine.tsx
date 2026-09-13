import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, BriefcaseBusiness, CalendarDays, CheckCircle2, ExternalLink, GraduationCap, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OpportunityItem = {
  id:string;
  source_type:"public_opportunity"|"bursary";
  slug:string|null;
  to_path:string;
  title:string;
  opportunity_type:string;
  organisation:string|null;
  location:string|null;
  province:string|null;
  description:string|null;
  requirements:string|null;
  application_url:string|null;
  closing_date:string|null;
  employment_type:string|null;
  last_verified_at:string|null;
  verification_state:string;
  match_score:number;
  match_reason:string;
  user_action:string|null;
  metadata:Record<string,any>;
};

const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function OpportunityEngine(){
  const{user}=useAuth();
  const navigate=useNavigate();
  const[query,setQuery]=useState("");
  const[type,setType]=useState("all");
  const[items,setItems]=useState<OpportunityItem[]>([]);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState<string|null>(null);
  const[profileContext,setProfileContext]=useState<any>(null);

  useEffect(()=>{
    let cancelled=false;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      const{data,error}=await(supabase as any).rpc("reskonnect_opportunity_feed",{
        p_query:query.trim()||null,
        p_type:type==="all"?null:type,
        p_limit:60,
      });
      if(cancelled)return;
      if(error){toast.error(error.message||"Could not load opportunities");setItems([]);}
      else{setItems(Array.isArray(data?.items)?data.items:[]);setProfileContext(data?.profile_context||null);}
      setLoading(false);
    },query?220:0);
    return()=>{cancelled=true;window.clearTimeout(timer);};
  },[query,type,user?.id]);

  const grouped=useMemo(()=>({
    bursaries:items.filter((x)=>x.source_type==="bursary").length,
    programmes:items.filter((x)=>x.source_type==="public_opportunity").length,
    verified:items.filter((x)=>x.verification_state==="verified").length,
  }),[items]);

  const act=async(item:OpportunityItem,action:"saved"|"interested"|"applied")=>{
    if(!user){navigate(`/auth?returnTo=${encodeURIComponent("/opportunities")}`);return;}
    const key=`${item.source_type}:${item.id}`;setBusy(key);
    const{error}=await(supabase as any).rpc("set_student_opportunity_action",{p_source_type:item.source_type,p_source_id:item.id,p_action:action});
    setBusy(null);
    if(error)return toast.error(error.message||"Could not update opportunity");
    setItems((rows)=>rows.map((row)=>row.id===item.id&&row.source_type===item.source_type?{...row,user_action:action}:row));
    toast.success(action==="saved"?"Saved to My ResKonnect":action==="applied"?"Marked as applied":"Interest recorded");
  };

  return <section className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Current opportunities" value={items.length}/>
      <Metric label="Verified in feed" value={grouped.verified}/>
      <Metric label="Bursaries" value={grouped.bursaries}/>
    </div>

    <Card className="border-primary/15 shadow-sm"><CardContent className="p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search programme, organisation, field of study or location…" className="h-11 pl-9"/></div>
        <Select value={type} onValueChange={setType}><SelectTrigger className="h-11"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All opportunity types</SelectItem><SelectItem value="bursary">Bursaries</SelectItem><SelectItem value="graduate programme">Graduate programmes</SelectItem><SelectItem value="internship">Internships</SelectItem><SelectItem value="wil">WIL</SelectItem><SelectItem value="learnership">Learnerships</SelectItem></SelectContent></Select>
      </div>
      {user&&<p className="mt-3 text-xs text-muted-foreground"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary"/>Signed-in relevance uses your saved course/campus context only. A match is guidance, not an eligibility or selection decision.{profileContext?.course?` Course: ${profileContext.course}.`:""}</p>}
    </CardContent></Card>

    {loading?<div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>:items.length===0?<div className="rounded-3xl border border-dashed p-10 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground"/><h3 className="mt-3 font-black">No current matches for these filters</h3><p className="mt-1 text-sm text-muted-foreground">Clear the search or try another opportunity type. ResKonnect does not show expired items as current.</p><Button variant="outline" className="mt-4" onClick={()=>{setQuery("");setType("all");}}>Clear filters</Button></div>:(
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item)=>{
          const key=`${item.source_type}:${item.id}`;const isBusy=busy===key;
          const closing=item.closing_date?new Date(item.closing_date):null;
          const days=closing?Math.ceil((closing.getTime()-Date.now())/86400000):null;
          return <Card key={key} className="group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{item.source_type==="bursary"?<GraduationCap className="mr-1 h-3 w-3"/>:<BriefcaseBusiness className="mr-1 h-3 w-3"/>}{label(item.opportunity_type)}</Badge>
                <Badge variant="outline" className={item.verification_state==="verified"?"border-emerald-500/30 text-emerald-700 dark:text-emerald-300":""}><CheckCircle2 className="mr-1 h-3 w-3"/>{item.verification_state==="verified"?"Verified source":"Review due"}</Badge>
                {user&&<Badge variant="secondary">{item.match_score}% context match</Badge>}
              </div>
              <h3 className="mt-4 text-lg font-black leading-snug">{item.title}</h3>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.organisation||"Verified opportunity provider"}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description||"Open the opportunity for current details and the official application route."}</p>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                {(item.location||item.province)&&<p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5"/>{[item.location,item.province].filter(Boolean).join(", ")}</p>}
                {closing&&<p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5"/>Closes {closing.toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"})}{days!==null&&days>=0?` · ${days} day${days===1?"":"s"} left`:""}</p>}
              </div>
              {user&&<div className="mt-4 rounded-2xl bg-primary/[0.045] p-3"><p className="text-xs font-bold text-primary">Why ResKonnect surfaced this</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.match_reason}</p></div>}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                <Button asChild variant="outline"><Link to={item.to_path}>View details</Link></Button>
                <Button variant={item.user_action==="saved"?"secondary":"outline"} onClick={()=>void act(item,"saved")} disabled={isBusy}><Bookmark className="mr-1.5 h-4 w-4"/>{item.user_action==="saved"?"Saved":"Save"}</Button>
              </div>
              {user&&<div className="mt-2 grid grid-cols-2 gap-2"><Button variant="ghost" size="sm" onClick={()=>void act(item,"interested")} disabled={isBusy}>I'm interested</Button><Button variant="ghost" size="sm" onClick={()=>void act(item,"applied")} disabled={isBusy}>I applied</Button></div>}
              {item.application_url&&<Button asChild size="sm" className="mt-2 w-full"><a href={item.application_url} target="_blank" rel="noopener noreferrer">Official application route<ExternalLink className="ml-2 h-3.5 w-3.5"/></a></Button>}
            </CardContent>
          </Card>;
        })}
      </div>
    )}
  </section>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border bg-card p-4"><p className="text-2xl font-black">{value.toLocaleString("en-ZA")}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
