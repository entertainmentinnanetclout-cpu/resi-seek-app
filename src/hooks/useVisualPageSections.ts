import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {useAuth} from "@/contexts/AuthContext";
import {isVisualPreviewAuthorized} from "@/lib/adminVisualPreview";

export type VisualPageKey = "landing" | "findmyres";
export type VisualPageSection = {
 page_key: VisualPageKey;
 section_key: string;
 title: string;
 position: number;
 visible: boolean;
 required: boolean;
 editable_copy: boolean;
 headline: string;
 subtitle: string;
 updated_at?: string;
};
export type VisualSectionDraft = Pick<VisualPageSection,"section_key"|"position"|"visible"|"headline"|"subtitle">;

const pageDefaults: Record<VisualPageKey, Array<[string,string,number,boolean]>> = {
 landing: [
  ["hero","Hero",10,true],["search","Search",20,true],["spotlight","Spotlight",30,false],
  ["top3","Top 3",40,false],["vision","Vision",50,true],["cities","Cities",60,false],
  ["pillars","Platform pillars",70,true],["gmail-privacy","Gmail privacy",80,true],
  ["student-care","Student care",90,false],["intake","Student pathways",100,false],
  ["automation","Connected services",110,false],["resmap","ResMap",120,false],
  ["audience","Audience",130,false],["trusted","Trusted residences",140,false],
  ["categories","Categories",150,false],["accreditation","Accreditation",160,true],
  ["about","About",170,true],["landlord","Landlords",180,true],["benefits","Benefits",190,false],
  ["faq","FAQ",200,true],["contact","Contact",210,true],["seo-links","SEO links",220,true],
 ],
 findmyres: [
  ["search","Search",10,true],["spotlight","Spotlight",20,false],["top3","Top 3",30,false],
  ["nearby","Nearby",40,false],["sponsored","Sponsored",50,false],["referral","Referral",60,false],
  ["audience","Audience",70,true],["results","Results",80,true],
  ["category-rails","Categories",90,false],["seo-info","Search information",100,true],
 ],
};
export const VISUAL_PAGE_DEFAULTS = pageDefaults;

export function useVisualPageSections(page:VisualPageKey) {
 const {isGodMode,session}=useAuth();
 const {data=[],isLoading,error,refetch}=useQuery({
  queryKey:["rk-visual-sections",page],
  queryFn:async()=>{
   const {data,error}=await (supabase as any).from("rk_visual_page_sections").select("page_key,section_key,title,position,visible,required,editable_copy,headline,subtitle,updated_at").eq("page_key",page).order("position");
   if(error)throw error;
   return (data||[]) as VisualPageSection[];
  },staleTime:60_000,retry:1,
 });
 const isPreview=isVisualPreviewAuthorized(isGodMode,session?.access_token);
 const [preview,setPreview]=useState<Record<string,VisualSectionDraft>>({});
 useEffect(()=>{
  if(!isPreview)return;
  // Exactly one receiver per public page: the page owns this hook and all blocks
  // consume the same data. Never install one listener/query per visual section.
  const registered=new Set((data.length?data.map(row=>row.section_key):pageDefaults[page].map(row=>row[0])));
  const send=(type:string,extra:Record<string,unknown>={})=>{
   window.parent.postMessage({type,page,...extra},window.location.origin);
  };
  const receive=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin || event.source!==window.parent)return;
   const msg=event.data;
   if(!msg||msg.page!==page)return;
   if(msg.type==="rk-visual-preview" && Array.isArray(msg.sections)){
    const patches:Record<string,VisualSectionDraft>={};
    for(const item of msg.sections){
     if(!item||typeof item.section_key!=="string"||!registered.has(item.section_key))continue;
     const position=Number(item.position);
     if(!Number.isInteger(position)||position<1||position>10000)continue;
     patches[item.section_key]={
      section_key:item.section_key,position,visible:item.visible!==false,
      headline:typeof item.headline==="string"?item.headline.slice(0,180):"",
      subtitle:typeof item.subtitle==="string"?item.subtitle.slice(0,450):"",
     };
    }
    setPreview(patches);
    send("rk-visual-applied",{count:Object.keys(patches).length,requestId:msg.requestId||null});
   }
   if(msg.type==="rk-visual-focus"&&registered.has(msg.sectionKey)){
    const node=[...document.querySelectorAll<HTMLElement>("[data-rk-visual-section]")]
     .find(element=>element.dataset.rkVisualSection===msg.sectionKey);
    document.querySelectorAll<HTMLElement>(".rk-preview-selected").forEach(element=>element.classList.remove("rk-preview-selected"));
    node?.classList.add("rk-preview-selected");
    if(msg.scroll!==false)node?.scrollIntoView({block:"center",behavior:"smooth"});
   }
  };
  // The inspector's live canvas is deliberately non-interactive: clicking any
  // public section selects it instead of starting an application or navigating.
  const select=(event:MouseEvent)=>{
   const node=(event.target as Element|null)?.closest?.("[data-rk-visual-section]") as HTMLElement|null;
   const selectedKey=node?.dataset.rkVisualSection;
   if(selectedKey&&registered.has(selectedKey)){
    event.preventDefault();event.stopPropagation();
    send("rk-visual-select",{sectionKey:selectedKey});
   }else if((event.target as Element|null)?.closest?.("a,button,[role='button']")){
    event.preventDefault();event.stopPropagation();
   }
  };
  const blockSubmit=(event:Event)=>{event.preventDefault();event.stopPropagation();};
  document.documentElement.dataset.rkVisualPreview="true";
  window.addEventListener("message",receive);
  document.addEventListener("click",select,true);
  document.addEventListener("submit",blockSubmit,true);
  send("rk-visual-ready",{sectionCount:registered.size});
  return()=>{
   window.removeEventListener("message",receive);
   document.removeEventListener("click",select,true);
   document.removeEventListener("submit",blockSubmit,true);
   delete document.documentElement.dataset.rkVisualPreview;
  };
 },[page,isPreview,data]);
 const sections=useMemo(()=>{
  const base=(data.length?data:pageDefaults[page].map(([key,title,position,required])=>({
   page_key:page,section_key:key,title,position,required,visible:true,editable_copy:false,headline:"",subtitle:"",
  } as VisualPageSection)));
  return base.map(item=>preview[item.section_key]?{...item,...preview[item.section_key]}:item);
 },[data,page,preview]);
 const byKey=useMemo(()=>Object.fromEntries(sections.map(item=>[item.section_key,item])) as Record<string,VisualPageSection>,[sections]);
 return {sections,byKey,isLoading,error,refetch,isPreview};
}
