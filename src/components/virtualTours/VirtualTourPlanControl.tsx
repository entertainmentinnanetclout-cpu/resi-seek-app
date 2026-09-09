import { useEffect, useMemo, useState } from "react";
import { Crown, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tourApi } from "@/lib/virtualTours/api";
import { toast } from "sonner";

type Plan = "standard" | "premium" | "gold" | "internal";

export default function VirtualTourPlanControl() {
  const [data, setData] = useState<any>(null);
  const [residenceId, setResidenceId] = useState("");
  const [plan, setPlan] = useState<Plan>("standard");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setData(await tourApi<any>("admin_summary")); }
    catch (error: any) { toast.error(error?.message || "Could not load 360 Studio plan controls."); }
  };
  useEffect(() => { void load(); }, []);

  const current = useMemo(() => (data?.entitlements || []).find((row: any) => row.residence_id === residenceId && row.is_active), [data, residenceId]);
  useEffect(() => { if (residenceId) setPlan((current?.plan || "standard") as Plan); }, [residenceId, current?.plan]);

  const save = async () => {
    if (!residenceId) return toast.error("Choose a residence first.");
    setBusy(true);
    try {
      await tourApi("grant_entitlement", { residence_id: residenceId, plan });
      await load();
      toast.success(`${plan === "standard" ? "Standard" : plan === "premium" ? "Premium" : plan === "gold" ? "Gold" : "Internal"} 360 Studio access applied.`);
    } catch (error: any) { toast.error(error?.message || "Could not update the residence plan."); }
    finally { setBusy(false); }
  };

  return <Card className="overflow-hidden border-[#F5B32F]/30">
    <CardHeader className="bg-gradient-to-r from-[#071326] to-[#0b2752] text-white">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5B32F] text-[#071326]"><Crown className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#F5B32F]">God Mode entitlement control</p><CardTitle className="text-lg">360 Studio Premium / Gold Plans</CardTitle></div></div>
    </CardHeader>
    <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_220px_auto] md:items-end">
      <div><p className="mb-2 text-xs font-bold text-muted-foreground">Residence</p><Select value={residenceId} onValueChange={setResidenceId}><SelectTrigger><SelectValue placeholder="Choose residence" /></SelectTrigger><SelectContent>{(data?.residences || []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.campus || r.city || ""}</SelectItem>)}</SelectContent></Select></div>
      <div><p className="mb-2 text-xs font-bold text-muted-foreground">Access plan</p><Select value={plan} onValueChange={(value) => setPlan(value as Plan)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard · locked</SelectItem><SelectItem value="premium">Premium · 4K capture</SelectItem><SelectItem value="gold">Gold · full V2 tools</SelectItem><SelectItem value="internal">Internal · God Mode</SelectItem></SelectContent></Select></div>
      <Button onClick={() => void save()} disabled={busy || !residenceId} className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffd16e]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Apply plan</Button>
      {residenceId && <div className="md:col-span-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">Current: {current?.plan || "standard"}</Badge><span>Premium enables 4K capture and review requests. Gold adds guided tours, analytics and unlimited scenes. Internal is reserved for ResKonnect operations.</span></div>}
    </CardContent>
  </Card>;
}
