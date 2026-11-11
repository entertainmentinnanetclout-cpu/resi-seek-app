import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
 const {data=[],isLoading,error,refetch}=useQuery({
  queryKey:["rk-visual-sections",page],
  queryFn:async()=>{
   const {data,error}=await (supabase as any).from("rk_visual_page_sections").select("*").eq("page_key",page).order("position");
   if(error)throw error;
   return (data||[]) as VisualPageSection[];
  },staleTime:60_000,retry:1,
 });
 const [preview,setPreview]=useState<Record<string,VisualSectionDraft>>({});
 useEffect(()=>{
  if(typeof window==="undefined" || window.parent===window || new URLSearchParams(window.location.search).get("rk_visual_preview")!=="1")return;
  const receive=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin || event.source!==window.parent)return;
   const message=event.data;
   if(message?.type!=="rk-visual-preview" || message.page!==page || !Array.isArray(message.sections))return;
   const patches:Record<string,VisualSectionDraft>={};
   for(const item of message.sections)if(item&&typeof item.section_key==="string"){
    patches[item.section_key]={section_key:item.section_key,position:Number(item.position)||0,
     visible:item.visible!==false,headline:String(item.headline||""),subtitle:String(item.subtitle||"")};
   }
   setPreview(patches);
  };
  window.addEventListener("message",receive);
  window.parent.postMessage({type:"rk-visual-ready",page},window.location.origin);
  return()=>window.removeEventListener("message",receive);
 },[page]);
 const sections=useMemo(()=>{
  const base=(data.length?data:pageDefaults[page].map(([key,title,position,required])=>({
   page_key:page,section_key:key,title,position,required,visible:true,editable_copy:false,headline:"",subtitle:"",
  } as VisualPageSection)));
  return base.map(item=>preview[item.section_key]?{...item,...preview[item.section_key]}:item);
 },[data,page,preview]);
 const byKey=useMemo(()=>Object.fromEntries(sections.map(item=>[item.section_key,item])) as Record<string,VisualPageSection>,[sections]);
 return {sections,byKey,isLoading,error,refetch};
}
