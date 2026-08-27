import { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";

interface RoommateProfile {
  id:string; full_name:string; campus:string|null; course:string|null; year_of_study:string|null; profile_picture_url:string|null; looking_for_roommate:boolean;
  lifestyle_preferences:{sleepSchedule?:string;studyHabits?:string;cleanliness?:string;socialLevel?:string;smoking?:boolean;pets?:boolean;budgetRange?:string}|null;
}
const campuses=["TUT Pretoria Campus","TUT Soshanguve Campus","TUT Ga-Rankuwa Campus","TUT eMalahleni Campus","TUT Polokwane Campus","TUT Mbombela Campus","Other"];
const pretty=(v?:string)=>v?v.replace(/_/g," ").replace(/\b\w/g,(m)=>m.toUpperCase()):"";

export default function RoommateFinder(){
  const {user}=useAuth();
  const [profiles,setProfiles]=useState<RoommateProfile[]>([]);const [myProfile,setMyProfile]=useState<RoommateProfile|null>(null);const [loading,setLoading]=useState(true);const [query,setQuery]=useState("");const [campus,setCampus]=useState("all");const [looking,setLooking]=useState(false);
  const load=async()=>{setLoading(true);const {data,error}=await (supabase as any).from("roommate_profiles_public_v").select("id,full_name,campus,course,year_of_study,profile_picture_url,lifestyle_preferences,looking_for_roommate").order("updated_at",{ascending:false});if(error)toast.error("Failed to load roommate directory");else setProfiles((data||[]).filter((p:any)=>p.id!==user?.id));setLoading(false);};
  const loadMine=async()=>{if(!user)return;const {data}=await supabase.from("profiles").select("id,full_name,campus,course,year_of_study,profile_picture_url,lifestyle_preferences,looking_for_roommate").eq("id",user.id).maybeSingle();if(data){setMyProfile(data as RoommateProfile);setLooking(Boolean(data.looking_for_roommate));}};
  useEffect(()=>{void load();void loadMine();},[user?.id]);
  const toggle=async(value:boolean)=>{if(!user)return;setLooking(value);const {error}=await supabase.from("profiles").update({looking_for_roommate:value}).eq("id",user.id);if(error){setLooking(!value);return toast.error("Failed to update roommate visibility");}toast.success(value?"Your safe roommate profile is now visible":"Your roommate profile is now hidden");void load();};
  const compatibility=(p:RoommateProfile)=>{const a=myProfile?.lifestyle_preferences,b=p.lifestyle_preferences;if(!a||!b)return 0;let total=0,match=0;(["sleepSchedule","studyHabits","cleanliness","socialLevel","smoking"] as const).forEach((k)=>{if(a[k]!==undefined&&b[k]!==undefined){total++;if(a[k]===b[k]||a[k]==="flexible"||b[k]==="flexible"||a[k]==="ambivert"||b[k]==="ambivert")match++;}});return total?Math.round(match/total*100):0;};
  const filtered=useMemo(()=>profiles.filter((p)=>{const hit=`${p.full_name||""} ${p.campus||""} ${p.course||""}`.toLowerCase().includes(query.toLowerCase());return hit&&(campus==="all"||p.campus===campus);}),[profiles,query,campus]);
  const contact=(p:RoommateProfile)=>{const msg=encodeURIComponent(`Hi! I found ${p.full_name}'s roommate profile on ResKonnect and would like help connecting safely.`);window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${msg}`,'_blank');};

  return <DashboardLayout><SEO title="Roommate Finder | ResKonnect" description="Find compatible roommates through privacy-safe ResKonnect profiles."/><div className="mx-auto max-w-7xl space-y-6 p-3 sm:p-6 lg:p-8">
    <div><h1 className="flex items-center gap-3 text-3xl font-black sm:text-4xl"><Users className="h-8 w-8 text-primary"/>Roommate Finder</h1><p className="mt-2 text-sm text-muted-foreground">Discover compatible students without exposing personal phone numbers or email addresses.</p></div>
    <Card className="border-emerald-500/20 bg-emerald-500/[0.035]"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600"/><div><p className="font-bold">Privacy-safe directory</p><p className="mt-1 text-xs text-muted-foreground">Only your chosen roommate-facing profile fields are published. Direct contact details stay protected.</p></div></div><div className="flex items-center gap-3"><Label htmlFor="roommate-visible">I’m looking</Label><Switch id="roommate-visible" checked={looking} onCheckedChange={(v)=>void toggle(v)}/></div></CardContent></Card>
    <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search campus, course or name…"/></div><Select value={campus} onValueChange={setCampus}><SelectTrigger className="sm:w-64"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All campuses</SelectItem>{campuses.map((c)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {loading?<Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading roommate profiles…</CardContent></Card>:filtered.length===0?<Card><CardContent className="py-16 text-center"><Users className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-bold">No matching roommate profiles</p></CardContent></Card>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((p)=>{const score=compatibility(p);return <Card key={p.id} className="overflow-hidden"><CardContent className="p-5"><div className="flex items-center gap-3"><Avatar className="h-14 w-14"><AvatarImage src={p.profile_picture_url||undefined}/><AvatarFallback>{(p.full_name||"R").slice(0,2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-lg font-black">{p.full_name}</p>{p.campus&&<p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3"/>{p.campus}</p>}</div>{score>0&&<Badge>{score}% match</Badge>}</div>{p.course&&<p className="mt-4 text-sm font-semibold">{p.course}{p.year_of_study?` · ${p.year_of_study}`:""}</p>}<div className="mt-3 flex flex-wrap gap-2">{Object.entries(p.lifestyle_preferences||{}).filter(([k,v])=>["sleepSchedule","studyHabits","cleanliness","socialLevel"].includes(k)&&Boolean(v)).slice(0,4).map(([k,v])=><Badge key={k} variant="outline" className="text-[10px]"><Sparkles className="mr-1 h-3 w-3"/>{pretty(String(v))}</Badge>)}</div><Button className="mt-5 w-full" variant="outline" onClick={()=>contact(p)}><MessageCircle className="mr-2 h-4 w-4"/>Connect through ResKonnect</Button></CardContent></Card>;})}</div>}
  </div></DashboardLayout>;
}
