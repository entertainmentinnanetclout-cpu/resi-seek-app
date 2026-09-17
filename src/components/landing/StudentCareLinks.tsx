import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedSingle, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/studentCare';
export default function StudentCareLinks() {
  const [count,setCount]=useState<number|null>(null);
  useEffect(()=>{ let active=true; db.rpc('rk_single_room_waitlist_count',{p_year:2027}).then(({data,error}:any)=>{if(active&&!error)setCount(Number(data));});return()=>{active=false;};},[]);
  return <section className="mx-auto grid max-w-7xl gap-5 px-4 py-10 sm:px-6 md:grid-cols-2" aria-label="Student care and single rooms">
    <div className="rounded-3xl bg-[#071326] p-7 text-white"><BedSingle className="h-8 w-8 text-[#F5B32F]"/><p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#F5B32F]">2027 Single-room waiting list</p><h2 className="mt-2 text-2xl font-black">A room of your own.</h2><p className="mt-3 text-sm leading-6 text-white/75">Strictly single rooms. Tell us your campus, budget and preferred residence so ResKonnect can help find a suitable option.</p>{count!==null&&<p className="mt-3 text-sm">{count} active requests · Your contact details stay private.</p>}<Button asChild className="mt-5 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]/90"><Link to="/single-room-waiting-list">Join the single-room waiting list</Link></Button></div>
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-7"><HeartHandshake className="h-8 w-8 text-primary"/><p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">Your stay. Your voice.</p><h2 className="mt-2 text-2xl font-black">Care continues after placement.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Share residence feedback, report concerns and support improvements. We track issues and seek action with residences and institutions with your permission.</p><Button asChild variant="outline" className="mt-5"><Link to="/student-care">Give residence feedback</Link></Button></div>
  </section>;
}
