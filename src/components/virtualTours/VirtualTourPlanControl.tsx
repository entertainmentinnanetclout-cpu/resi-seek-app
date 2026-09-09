import { useEffect, useMemo, useState } from "react";
import { Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tourApi } from "@/lib/virtualTours/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Plan = "standard" | "premium" | "gold" | "internal";

export default function VirtualTourPlanControl() {
  const [data, setData] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [residenceId, setResidenceId] = useState("");
  const [plan, setPlan] = useState<Plan>("standard");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await tourApi<any>("admin_summary"));
      try {
        const result = await (supabase as any).from("virtual_tour_upgrade_requests").select("id,residence_id,requested_plan,status,created_at,residences(name,campus)").eq("status","pending").order("created_at",{ascending:false}).limit(30);
        setRequests(result.data || []);
      } catch { setRequests([]); }
    } catch (error: any) { toast.error(error?.message || "Could not load 360 Studio plan controls."); }
  };
  useEffect(() => { void load(); }, []);

  const current = useMemo(() => (data?.entitlements || []).find((row: any) => row.residence_id === residenceId && row.is_active), [data, residenceId]);
  useEffect(() => { if (residenceId) setPlan((current?.plan || "standard") as Plan); }, [residenceId, current?.plan]);

  const save = async () => {
    if (!residenceId) return toast.error("Choose a residence first.");
    setBusy(true);
    try {
      await tourApi("grant_entitlement", { residence_id: residenceId, plan });
      try { await (supabase as any).from("virtual_tour_upgrade_requests").update({status:"completed",decided_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("residence_id",residenceId).eq("status","pending"); } catch { /* migration-independent */ }
      await load();
      toast.success(`${plan === "standard" ? "Standard" : plan === "premium" ? "Premium" : plan === "gold" ? "Gold" : "Internal"} 360 Studio access applied.`);
    } catch (error: any) { toast.error(error?.message || "Could not update the residence plan."); }
    finally { setBusy(false); }
  };

  const pickRequest = (request: any) => {
    setResidenceId(request.residence_id);
    setPlan((request.requested_plan || "gold") as Plan);
  };

  return <div className="space-y-4">
    {requests.length > 0 && <Card className="border-[#F5B32F]/35 bg-[#F5B32F]/5"><CardHeader><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-[#C78A00]"/>Premium upgrade queue</p><p className="mt-1 text-xs text-muted-foreground">Landlords requesting access from Property OS.</p></div><Badge className="bg-[#071326] text-white">{requests.length} pending</Badge></div></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{requests.map((request:any)=><button key={request.id} onClick={()=>pickRequest(request)} className="rounded-2xl border bg-background p-3 text-left transition hover:border-[#F5B32F]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-black">{request.residences?.name || "Residence"}</p><p className="text-[10px] text-muted-foreground">{request.residences?.campus || ""}</p></div><Badge variant="outline">{request.requested_plan}</Badge></div><p className="mt-2 text-[10px] text-muted-foreground">Requested {new Date(request.created_at).toLocaleDateString("en-ZA")}</p></button>)}</CardContent></Card>}

    <Card className="overflow-hidden border-[#F5B32F]/30">
      <CardHeader className="bg-gradient-to-r from-[#071326] to-[#0b2752] text-white">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5B32F] text-[#071326]"><Crown className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#F5B32F]">God Mode entitlement control</p><CardTitle className="text-lg">360 Studio Premium / Gold Plans</CardTitle></div></div>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_220px_auto] md:items-end">
        <div><p className="mb-2 text-xs font-bold text-muted-foreground">Residence</p><Select value={residenceId} onValueChange={setResidenceId}><SelectTrigger><SelectValue placeholder="Choose residence" /></SelectTrigger><SelectContent>{(data?.residences || []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.campus || r.city || ""}</SelectItem>)}</SelectContent></Select></div>
        <div><p className="mb-2 text-xs font-bold text-muted-foreground">Access plan</p><Select value={plan} onValueChange={(value) => setPlan(value as Plan)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard · locked</SelectItem><SelectItem value="premium">Premium · 4K capture</SelectItem><SelectItem value="gold">Gold · full V2 tools</SelectItem><SelectItem value="internal">Internal · God Mode</SelectItem></SelectContent></Select></div>
        <Button onClick={() => void save()} disabled={busy || !residenceId} className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffd16e]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Apply plan</Button>
        {residenceId && <div className="md:col-span-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">Current: {current?.plan || "standard"}</Badge><span>Premium enables 4K capture and up to 36 scenes. Gold adds guided tours, analytics and extended scene capacity. Internal is reserved for ResKonnect operations.</span></div>}
      </CardContent>
    </Card>
  </div>;
}
