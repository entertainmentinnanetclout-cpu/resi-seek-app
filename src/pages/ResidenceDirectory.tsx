import {useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowLeft,Building2,MapPin,Search} from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import {Input} from "@/components/ui/input";
import {supabase} from "@/integrations/supabase/client";

type DirectoryResidence={
 id:string;slug:string|null;name:string;city:string|null;campus:string|null;address:string|null;
};

export default function ResidenceDirectory(){
 const [rows,setRows]=useState<DirectoryResidence[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const {data,error:failed}=await (supabase as any).from("residences")
    .select("id,slug,name,city,campus,address").eq("is_visible",true)
    .order("name",{ascending:true}).limit(1000);
   if(!active)return;
   setRows(failed?[]:(data||[]));
   setError(failed?"The accommodation directory is temporarily unavailable. Please retry from Find My Res.":"");
   setLoading(false);
  };
  void load();
  return()=>{active=false;};
 },[]);
 const matching=useMemo(()=>{
  const term=query.trim().toLowerCase();
  return term?rows.filter(r=>[r.name,r.city,r.campus,r.address].some(value=>String(value||"").toLowerCase().includes(term))):rows;
 },[rows,query]);
 return <DashboardLayout>
  <SEO noIndex={false} title="Accommodation Directory A–Z | ResKonnect" canonicalPath="/directory/residences"
   description="Find a specific student residence by name, city, campus or address on ResKonnect. View its individual listing, including free and incomplete directory entries."/>
  <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
   <Link to="/findmyres" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
    <ArrowLeft className="h-4 w-4"/>Back to photo-first accommodation discovery
   </Link>
   <header>
    <h1 className="text-3xl font-black tracking-tight">Accommodation directory A–Z</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
     Search the full published ResKonnect directory, including basic residences whose photos and details are still being completed.
     These listings are kept findable; appearing here is not a partnership, accreditation or availability guarantee.
    </p>
   </header>
   <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
    <Input className="pl-9" aria-label="Search residence directory by name or location" placeholder="Search residence name, campus or street" value={query} onChange={e=>setQuery(e.target.value)}/>
   </div>
   {loading?<p role="status" className="text-sm text-muted-foreground">Loading published residence names…</p>:
    error?<p role="alert" className="rounded-xl border border-amber-500/40 p-4 text-sm">{error}</p>:<>
     <p className="text-xs font-semibold text-muted-foreground">{matching.length} matching published residences</p>
     <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {matching.map(residence=><Link key={residence.id} to={`/find-my-res/${encodeURIComponent(residence.slug||residence.id)}`}
       className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/30">
       <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>
       <span className="min-w-0"><span className="block break-words text-sm font-bold">{residence.name}</span>
        <span className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-muted-foreground">
         <MapPin className="h-3 w-3 shrink-0"/><span className="truncate">{residence.city||residence.campus||residence.address||"Address details pending"}</span>
        </span></span>
      </Link>)}
     </div>
     {!matching.length&&<p className="text-sm text-muted-foreground">No name matches. Try part of the residence name or its campus.</p>}
    </>}
  </main>
 </DashboardLayout>;
}
