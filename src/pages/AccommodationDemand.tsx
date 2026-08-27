import { useMemo, useState } from "react";
import { BedDouble, Building2, MapPin, Search, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { ResidencePropertyCard } from "@/components/findmyres/ResidencePropertyCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AccommodationDemand = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { residences, loading: residencesLoading } = useRealtimeResidences();
  const [form, setForm] = useState({ academic_year:"2027", campus:"Pretoria West", area:"", monthly_budget:"", funding_type:"undecided", room_type:"", move_in_date:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const [demandId, setDemandId] = useState<string | null>(null);
  const [scores, setScores] = useState<any[]>([]);

  const matches = useMemo(() => scores.map((score) => ({ score, residence: residences.find((r:any)=>r.id===score.residence_id) })).filter((x)=>x.residence), [scores,residences]);

  const submit = async () => {
    if (!user) { navigate(`/auth?returnTo=${encodeURIComponent("/accommodation-request")}`); return; }
    if (!form.campus.trim()) return toast.error("Tell us which campus or area you need");
    setSaving(true);
    const db = supabase as any;
    const payload = { user_id:user.id, academic_year:Number(form.academic_year), campus:form.campus.trim(), area:form.area.trim()||null, monthly_budget:form.monthly_budget?Number(form.monthly_budget):null, funding_type:form.funding_type, room_type:form.room_type||null, move_in_date:form.move_in_date||null, notes:form.notes||null, status:"searching" };
    const { data, error } = await db.from("accommodation_demands").insert(payload).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message || "Could not save accommodation request"); }
    setDemandId(data.id);
    const { data: matchRows, error: matchError } = await db.rpc("match_accommodation_demand", { _demand_id:data.id });
    setScores(matchError ? [] : matchRows || []);
    setSaving(false); toast.success("Your accommodation request is live in the ResKonnect Demand Network");
  };

  return <DashboardLayout><SEO title="Tell ResKonnect What Accommodation You Need | Demand Network" description="Submit your campus, budget, funding and room preferences and let ResKonnect match you with suitable student accommodation." />
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-violet/10 p-6 md:p-10"><div className="max-w-3xl"><Badge className="gap-1"><Target className="h-3 w-3"/>RESKONNECT DEMAND NETWORK</Badge><h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">Can’t find the right residence? Tell us exactly what you need.</h1><p className="mt-4 text-base leading-7 text-muted-foreground">Instead of depending only on listings, submit your 2027 accommodation demand. ResKonnect scores matching residences using campus, funding, budget, availability and reservation status.</p></div></section>

      <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
        <Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary"/>My accommodation request</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Academic year</Label><Select value={form.academic_year} onValueChange={(v)=>setForm({...form,academic_year:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2027">2027</SelectItem><SelectItem value="2028">2028</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Funding</Label><Select value={form.funding_type} onValueChange={(v)=>setForm({...form,funding_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="undecided">Not sure</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="nsfas">NSFAS</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div>
          <div className="space-y-1.5"><Label>Campus / institution area *</Label><Input value={form.campus} onChange={(e)=>setForm({...form,campus:e.target.value})} placeholder="Pretoria West"/></div>
          <div className="space-y-1.5"><Label>Preferred suburb / area</Label><Input value={form.area} onChange={(e)=>setForm({...form,area:e.target.value})} placeholder="e.g. Pretoria West, Arcadia"/></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Monthly budget</Label><Input type="number" value={form.monthly_budget} onChange={(e)=>setForm({...form,monthly_budget:e.target.value})} placeholder="3000"/></div><div className="space-y-1.5"><Label>Room type</Label><Select value={form.room_type} onValueChange={(v)=>setForm({...form,room_type:v})}><SelectTrigger><SelectValue placeholder="Any"/></SelectTrigger><SelectContent><SelectItem value="any">Any</SelectItem><SelectItem value="single">Single</SelectItem><SelectItem value="sharing">Sharing</SelectItem><SelectItem value="bachelor">Bachelor</SelectItem><SelectItem value="commune">Commune</SelectItem></SelectContent></Select></div></div>
          <div className="space-y-1.5"><Label>Move-in date</Label><Input type="date" value={form.move_in_date} onChange={(e)=>setForm({...form,move_in_date:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Anything else?</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Security, shuttle, gender, furnished room, walking distance…"/></div>
          <Button className="w-full" onClick={()=>void submit()} disabled={saving}>{saving ? "Matching…" : user ? "Find my matches" : "Sign in & find matches"}</Button>
          <p className="text-[11px] leading-5 text-muted-foreground">Your personal contact details remain protected. Landlords see aggregated demand intelligence unless you directly apply, reserve or enter their lead pipeline.</p>
        </CardContent></Card>

        <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-black">Matched accommodation</h2><p className="text-sm text-muted-foreground">{demandId ? `${matches.length} currently matching residences` : "Submit your requirements to generate matches."}</p></div>{demandId && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3"/>Live matching</Badge>}</div>
          {!demandId ? <Card><CardContent className="py-16 text-center"><Building2 className="mx-auto h-10 w-10 text-muted-foreground"/><p className="mt-4 font-black">Your best matches will appear here</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">ResKonnect considers funding type, available beds, budget and 2027 reservation status instead of returning every property.</p></CardContent></Card> : residencesLoading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading residence matches…</CardContent></Card> : matches.length === 0 ? <Card><CardContent className="py-16 text-center"><MapPin className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-black">No strong match yet</p><p className="mt-1 text-sm text-muted-foreground">Your request is still stored as live demand so ResKonnect can measure where more accommodation supply is needed.</p><Button variant="outline" className="mt-5" onClick={()=>navigate("/find")}>Browse all accommodation</Button></CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">{matches.slice(0,12).map(({score,residence})=><div key={residence.id} className="relative"><div className="absolute left-3 top-3 z-20 rounded-full bg-background/95 px-3 py-1 text-xs font-black shadow">{score.match_score}% match</div><ResidencePropertyCard residence={residence} matchScore={score.match_score} onApply={(r)=>navigate(`/find-my-res/${r.slug||r.id}`)}/></div>)}</div>}
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/[0.035]"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><BedDouble className="mt-0.5 h-5 w-5 text-primary"/><div><p className="font-black">Demand becomes supply intelligence</p><p className="mt-1 text-sm text-muted-foreground">ResKonnect can show landlords anonymised demand totals by campus, funding and year so the market can respond to what students actually need.</p></div></div><Button variant="outline" onClick={()=>navigate("/find?reserve=2027")}>Browse 2027 listings</Button></CardContent></Card>
    </div>
  </DashboardLayout>;
};
export default AccommodationDemand;
