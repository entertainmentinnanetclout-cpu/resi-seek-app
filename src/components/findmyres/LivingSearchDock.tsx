import {useState,type FormEvent} from "react";
import {ArrowRight,MapPin,Search,Sparkles} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

export default function LivingSearchDock({compact=false}:{compact?:boolean}){
 const [query,setQuery]=useState("");
 const navigate=useNavigate();
 const search=(e?:FormEvent)=>{
  e?.preventDefault();
  const params=new URLSearchParams();
  if(query.trim())params.set("query",query.trim().slice(0,100));
  navigate("/findmyres"+(params.toString()?"?"+params.toString():"")+"#results");
 };
 const ai=()=>{
  const params=new URLSearchParams({discovery:"discover"});
  if(query.trim())params.set("query",query.trim().slice(0,100));
  navigate("/findmyres?"+params.toString());
 };
 return <section aria-label="Find accommodation fast" className="relative z-10 bg-[#fffdfa] py-5 sm:py-7">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
   <div className="rounded-[24px] border border-[#e8e2d7] bg-white p-4 shadow-[0_16px_42px_rgba(29,37,53,.09)] sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
     <p className="inline-flex items-center gap-1.5 text-sm font-black text-[#132848]"><MapPin className="h-4 w-4 text-[#dd765d]"/>Your campus. Your budget. Your next home.</p>
     <p className="text-xs text-[#7c8794]">Search live published residence listings</p>
    </div>
    <form onSubmit={search} className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
     <label className="sr-only" htmlFor="rk-living-fast-search">Search by city, university, residence or suburb</label>
     <Input id="rk-living-fast-search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}
      className="h-12 w-full rounded-xl border-[#e2e6ed] bg-[#f8f9fb] px-4 text-base text-[#1b2b47] placeholder:text-[#8a94a3]"
      placeholder="City, campus, residence or suburb"/>
     <Button type="submit" className="h-12 rounded-xl bg-[#e94478] px-7 font-black text-white hover:bg-[#c62c62]">
      <Search className="mr-2 h-4 w-4"/>Search rooms
     </Button>
     <Button type="button" variant="outline" onClick={ai} className="h-12 rounded-xl border-[#d8c8ed] bg-[#f6f0ff] px-5 font-black text-[#61379a] hover:bg-[#eee1ff]">
      <Sparkles className="mr-2 h-4 w-4"/>AI-assisted finder
     </Button>
    </form>
    {!compact&&<div className="mt-3 flex flex-wrap gap-2">
     {["Pretoria","Soshanguve","Ga-Rankuwa","Polokwane"].map(area=>
      <button type="button" key={area} onClick={()=>navigate("/findmyres?query="+encodeURIComponent(area)+"#results")}
       className="inline-flex items-center gap-1 rounded-full border border-[#e7e2db] px-3 py-1.5 text-[11px] font-semibold text-[#526275] hover:border-[#e94478] hover:text-[#b82d62]">
       {area}<ArrowRight className="h-3 w-3"/>
      </button>)}
    </div>}
   </div>
  </div>
 </section>;
}
