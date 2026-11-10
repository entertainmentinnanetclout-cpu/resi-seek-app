import {useEffect,useState} from "react";
import {AlertTriangle,ExternalLink,FileText} from "lucide-react";
import {Button} from "@/components/ui/button";

type Props={
 url:string;
 name:string;
 media:"pdf"|"image"|"download";
};

/**
 * The URL is a short-lived, case-authorized Supabase Storage signed URL.
 * Never render arbitrary HTML or raw SVG here. PDF uses the browser's native
 * PDF viewer without the empty iframe sandbox that breaks Chromium/WebKit.
 */
export default function SecureDocumentPreview({url,name,media}:Props){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[url]);
 const fallback=<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200/70 bg-blue-50/60 p-3 text-xs dark:bg-blue-950/20">
  <p className="min-w-0 flex-1 text-muted-foreground">
   {failed?"This browser could not display the document inline.":"If the preview is blank on your browser, use the secure external viewer."}
  </p>
  <Button size="sm" variant="outline" className="gap-1.5" asChild>
   <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
    <ExternalLink className="h-3.5 w-3.5"/>Open file in new tab
   </a>
  </Button>
 </div>;
 return <div className="space-y-2" aria-label={"File preview: "+name}>
  {media==="image"?<div className="flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-900">
   {failed?<div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground"><AlertTriangle className="h-6 w-6"/>Image preview unavailable</div>:
    <img key={url} src={url} referrerPolicy="no-referrer" alt={"Uploaded file: "+name}
     className="max-h-[60vh] max-w-full object-contain" onError={()=>setFailed(true)}/>}
  </div>:
  media==="pdf"?<div className="overflow-hidden rounded-lg border bg-white">
   <iframe key={url} title={"Document preview: "+name} src={url}
    referrerPolicy="no-referrer" onError={()=>setFailed(true)}
    className="h-[54vh] min-h-[320px] w-full border-0 bg-white"/>
  </div>:
  <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-5 text-center text-xs text-muted-foreground">
   <FileText className="h-7 w-7"/>This file format needs to be opened in a separate tab.
  </div>}
  {fallback}
 </div>;
}
