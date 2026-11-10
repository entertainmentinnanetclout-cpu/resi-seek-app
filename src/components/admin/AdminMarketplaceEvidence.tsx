import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Camera, CheckCircle2, MapPin, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Coverage = {
  city_key: string;
  city: string;
  published_residences: number;
  published_private_rent_references: number;
  accepts_nsfas_count: number;
  photo_reference_listings: number;
  verified_price_listings: number;
  verified_location_listings: number;
  review_ready_listings: number;
};
const percent = (count:number,total:number) => total>0 ? Math.round(100*count/total)+"%" : "—";
export default function AdminMarketplaceEvidence() {
  const [rows,setRows] = useState<Coverage[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const load = useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const { data,error:problem } = await (supabase as any)
        .from("reskonnect_city_coverage_v")
        .select("city_key,city,published_residences,published_private_rent_references,accepts_nsfas_count,photo_reference_listings,verified_price_listings,verified_location_listings,review_ready_listings")
        .order("published_residences",{ascending:false}).limit(50);
      if(problem)throw problem;
      setRows((data||[]) as Coverage[]);
    }catch {
      setError("Marketplace evidence could not be refreshed. Historical values are not proof of current verification.");
    }finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const total=useMemo(()=>rows.reduce((out,row)=>({
    listings:out.listings+Number(row.published_residences||0),
    rates:out.rates+Number(row.published_private_rent_references||0),
    photos:out.photos+Number(row.photo_reference_listings||0),
    prices:out.prices+Number(row.verified_price_listings||0),
    locations:out.locations+Number(row.verified_location_listings||0),
    ready:out.ready+Number(row.review_ready_listings||0),
  }),{listings:0,rates:0,photos:0,prices:0,locations:0,ready:0}),[rows]);
  const cards=[
    {label:"Published residences",count:total.listings,icon:ShieldCheck},
    {label:"Reported positive private rates",count:total.rates,icon:WalletCards},
    {label:"Photo references",count:total.photos,icon:Camera},
    {label:"Verified prices",count:total.prices,icon:CheckCircle2},
    {label:"Verified locations",count:total.locations,icon:MapPin},
    {label:"Evidence-complete for staff review",count:total.ready,icon:CheckCircle2},
  ];
  return <div className="space-y-4">
    <Card><CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Marketplace intelligence · evidence health</CardTitle>
        <Button type="button" variant="outline" disabled={loading} onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
      </div>
      <p className="text-sm text-muted-foreground">A quality baseline for the AI/SI recommendation pipeline. These are published-record evidence counts, not matching accuracy, admission success, accreditation or confirmed bookings.</p>
    </CardHeader><CardContent className="space-y-4">
      {error&&<div role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4"/>{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(item=><div key={item.label} className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><item.icon className="h-4 w-4"/>{item.label}</div>
          <p className="mt-2 text-2xl font-black">{loading?"—":item.count.toLocaleString("en-ZA")}
            {item.label!=="Published residences" && !loading && <span className="ml-2 text-sm font-medium text-muted-foreground">{percent(item.count,total.listings)}</span>}
          </p>
        </div>)}
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr className="border-b text-muted-foreground"><th className="p-3">Area</th><th className="p-3">Published</th><th className="p-3">Price references</th><th className="p-3">Photo refs</th><th className="p-3">Verified prices</th></tr></thead>
        <tbody>{rows.map(row=><tr className="border-b" key={row.city_key}><td className="p-3 font-semibold">{row.city}</td><td className="p-3">{row.published_residences}</td><td className="p-3">{row.published_private_rent_references}</td><td className="p-3">{row.photo_reference_listings}</td><td className="p-3">{row.verified_price_listings}</td></tr>)}</tbody>
      </table></div>
      <p className="text-xs text-muted-foreground">Next operational action: collect real listing photos, current year-specific rates and verified property entrances. Improvements require supplier evidence and staff review. Unknown fields must never be inferred by an AI model.</p>
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/admin/residences">Open listing verification queue</Link></Button><Button asChild size="sm" variant="outline"><Link to="/admin/partnerships">Recruit housing suppliers</Link></Button></div>
    </CardContent></Card>
  </div>;
}
