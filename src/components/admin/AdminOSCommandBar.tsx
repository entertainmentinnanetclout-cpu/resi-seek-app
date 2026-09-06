import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Command as CommandIcon, FileText, GraduationCap, MessageCircle, Search, UserRound, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type SearchResult={result_type:string;result_id:string;title:string;subtitle?:string|null;url:string;score:number;metadata?:Record<string,any>};
const iconFor=(type:string)=>type==="residence"?Building2:type==="application"?FileText:type==="wil_application"?GraduationCap:type==="whatsapp_thread"?MessageCircle:UserRound;
const hubs=[
  {label:"Communications",url:"/admin/system?tab=communications",icon:MessageCircle},
  {label:"Service Intelligence",url:"/admin/system?tab=automation",icon:Zap},
  {label:"Operations",url:"/admin/system?tab=operations",icon:FileText},
  {label:"Platform",url:"/admin/system?tab=platform",icon:Building2},
];

export default function AdminOSCommandBar(){
  const[open,setOpen]=useState(false);const[query,setQuery]=useState("");const[results,setResults]=useState<SearchResult[]>([]);const[loading,setLoading]=useState(false);const navigate=useNavigate();const timer=useRef<number|null>(null);const request=useRef(0);
  useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==="k"&&(e.metaKey||e.ctrlKey)){e.preventDefault();setOpen(v=>!v);}};document.addEventListener("keydown",down);return()=>document.removeEventListener("keydown",down);},[]);
  const runSearch=useCallback((value:string)=>{setQuery(value);if(timer.current)window.clearTimeout(timer.current);const q=value.trim();if(q.length<2){setResults([]);setLoading(false);return;}const id=++request.current;setLoading(true);timer.current=window.setTimeout(async()=>{const{data,error}=await(supabase as any).rpc("adminos_global_search",{p_query:q,p_limit:30});if(id!==request.current)return;if(!error)setResults((data||[]) as SearchResult[]);else setResults([]);setLoading(false);},160);},[]);
  const go=(url:string)=>{setOpen(false);setQuery("");setResults([]);navigate(url);};
  return <>
    <Button variant="outline" size="sm" onClick={()=>setOpen(true)} className="hidden min-w-[220px] justify-between rounded-xl text-muted-foreground md:flex"><span className="flex items-center gap-2"><Search className="h-4 w-4"/>Search AdminOS</span><Badge variant="secondary" className="gap-1 rounded-md px-1.5 font-mono text-[9px]"><CommandIcon className="h-3 w-3"/>K</Badge></Button>
    <Button variant="ghost" size="icon" onClick={()=>setOpen(true)} className="md:hidden" aria-label="Search AdminOS"><Search className="h-4 w-4"/></Button>
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput value={query} onValueChange={runSearch} placeholder="Search people, phones, student numbers, applications, residences, WIL…"/>
      <CommandList className="max-h-[520px]">
        {loading&&<div className="px-4 py-3 text-xs text-muted-foreground">Searching live AdminOS data…</div>}
        {!query.trim()&&<CommandGroup heading="Command hubs">{hubs.map(item=><CommandItem key={item.url} onSelect={()=>go(item.url)} value={item.label}><item.icon className="mr-2 h-4 w-4"/><span>{item.label}</span></CommandItem>)}</CommandGroup>}
        {!!query.trim()&&!loading&&results.length===0&&<CommandEmpty>No AdminOS matches found.</CommandEmpty>}
        {results.length>0&&<><CommandGroup heading="Live results">{results.map(row=>{const Icon=iconFor(row.result_type);return <CommandItem key={`${row.result_type}:${row.result_id}`} value={`${row.title} ${row.subtitle||""} ${row.result_type}`} onSelect={()=>go(row.url)} className="items-start gap-3 py-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{row.title}</span><span className="block truncate text-[11px] text-muted-foreground">{row.subtitle||row.result_type.replaceAll("_"," ")}</span></span><Badge variant="outline" className="rounded-full text-[9px] capitalize">{row.result_type.replaceAll("_"," ")}</Badge></CommandItem>})}</CommandGroup><CommandSeparator/><CommandGroup heading="Quick navigation">{hubs.map(item=><CommandItem key={item.url} onSelect={()=>go(item.url)} value={`${item.label} hub`}><item.icon className="mr-2 h-4 w-4"/>{item.label}</CommandItem>)}</CommandGroup></>}
      </CommandList>
    </CommandDialog>
  </>;
}
