import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArrowDown,ArrowUp,CheckCircle2,Clock3,ExternalLink,Eye,EyeOff,History,Image,Layers,Loader2,Monitor,Move,RefreshCw,RotateCcw,Save,Search,ShieldCheck,Smartphone,Tablet,Undo2,Redo2} from "lucide-react";
import {Link} from "react-router-dom";
import {toast} from "sonner";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import ResidenceVisualManager from "@/components/admin/ResidenceVisualManager";
import SpotlightPlacementManager from "@/components/admin/residences/SpotlightPlacementManager";
import MonthlyTopThreeManager from "@/components/admin/residences/MonthlyTopThreeManager";
import TrustedResidencesEditor from "@/components/admin/TrustedResidencesEditor";
import {AdminSlidesContent} from "@/pages/admin/AdminSlides";
import {AdminCategoryCardsContent} from "@/pages/admin/AdminCategoryCards";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Badge} from "@/components/ui/badge";
import {Card,CardContent} from "@/components/ui/card";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Switch} from "@/components/ui/switch";
import {Label} from "@/components/ui/label";
import {supabase} from "@/integrations/supabase/client";
import type {VisualPageKey,VisualPageSection,VisualSectionDraft} from "@/hooks/useVisualPageSections";
import {runRkLayoutTransition,indicateRkBoundary} from "@/lib/reskonnectMotion";
import {RkMorphIcon} from "@/components/ui/RkMorphIcon";

type Revision={id:string;revision:number;state:string;created_at:string;published_at:string|null;note:string|null;snapshot:VisualSectionDraft[]};
const mapSnapshot=(sections:VisualPageSection[]):VisualSectionDraft[]=>sections.map(s=>({
 section_key:s.section_key,position:s.position,visible:s.visible,headline:s.headline||"",subtitle:s.subtitle||"",
}));
const normalized=(sections:VisualSectionDraft[])=>[...sections].sort((a,b)=>a.position-b.position||a.section_key.localeCompare(b.section_key));
const clone=(sections:VisualSectionDraft[])=>sections.map(item=>({...item}));
const TARGETS:Record<string,{label:string;tab:string;url?:string}>={
 hero:{label:"Edit hero slides",tab:"media"},
 spotlight:{label:"Manage Spotlight residences",tab:"showcases"},
 top3:{label:"Manage monthly Top 3",tab:"showcases"},
 trusted:{label:"Edit trusted residences",tab:"showcases"},
 categories:{label:"Manage accommodation categories",tab:"media"},
 "category-rails":{label:"Manage accommodation categories",tab:"media"},
 resmap:{label:"Open ResMap tools",tab:"residences"},
 "seo-links":{label:"Open SEO administration",tab:"pages",url:"/admin/corporate-affairs"},
};
const mediaLinks=[
 ["News articles","/admin/media?tab=news"],["Events","/admin/media?tab=events"],
 ["Marketplace banners","/admin/media?tab=banners"],["Accommodation filters","/admin/accommodation?tab=configuration"],
 ["Accreditation checks","/admin/accommodation?tab=compliance"],
];

export default function AdminVisualStudio(){
 const [tab,setTab]=useState("pages");
 const [page,setPage]=useState<VisualPageKey>("landing");
 const [source,setSource]=useState<VisualPageSection[]>([]);
 const [draft,setDraft]=useState<VisualSectionDraft[]>([]);
 const [selected,setSelected]=useState<string>("hero");
 const [history,setHistory]=useState<Revision[]>([]);
 const [undo,setUndo]=useState<VisualSectionDraft[][]>([]);
 const [redo,setRedo]=useState<VisualSectionDraft[][]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [publishedSuccess,setPublishedSuccess]=useState(false);
 const [note,setNote]=useState("");
 const [restoring,setRestoring]=useState(false);
 const [viewport,setViewport]=useState<"desktop"|"tablet"|"mobile">("desktop");
 const [residences,setResidences]=useState<any[]>([]);
 const [search,setSearch]=useState("");
 const [editorError,setEditorError]=useState<string|null>(null);
 const [previewState,setPreviewState]=useState<"loading"|"syncing"|"ready"|"error">("loading");
 const [previewNonce,setPreviewNonce]=useState(0);
 const previewRequest=useRef(0);
 const [savedDraftSignature,setSavedDraftSignature]=useState<string|null>(null);
 const frame=useRef<HTMLIFrameElement|null>(null);
 const dragging=useRef<string|null>(null);
 const pageUrl=page==="landing"?"/":"/findmyres";
 const previewUrl=pageUrl+"?rk_visual_preview=1";
 const active=source.find(row=>row.section_key===selected)||null;
 const edit=draft.find(row=>row.section_key===selected)||null;
 const sorted=useMemo(()=>normalized(draft),[draft]);
 const draftSignature=useMemo(()=>JSON.stringify(sorted),[sorted]);
 const dirty=useMemo(()=>JSON.stringify(normalized(mapSnapshot(source)))!==draftSignature,[source,draftSignature]);
 const unsavedLocal=dirty&&savedDraftSignature!==draftSignature;
 const changedBlocks=useMemo(()=>sorted.filter(row=>{
  const published=source.find(item=>item.section_key===row.section_key);
  return !!published&&JSON.stringify(mapSnapshot([published])[0])!==JSON.stringify(row);
 }).length,[sorted,source]);
 const latestDraft=history[0]?.state==="draft" ? history[0] : null;
 const canResumeDraft=!!latestDraft&&JSON.stringify(normalized(latestDraft.snapshot))!==draftSignature;
 const studioMetrics=[["Published residences",residences.filter(r=>r.is_visible===true).length],["Spotlight properties",residences.filter(r=>r.is_visible===true&&r.is_spotlight===true).length],["Recent page revisions",history.length]] as const;
 const loadResidences=useCallback(async()=>{
  const {data,error}=await (supabase as any).from("residences").select("*").order("name");
  if(error)toast.error("Could not load property studio: "+error.message);
  else setResidences(Array.isArray(data)?data:[]);
 },[]);
 const loadPage=useCallback(async()=>{
  setLoading(true);setEditorError(null);setSavedDraftSignature(null);
  const [published,rev]=await Promise.all([
   (supabase as any).from("rk_visual_page_sections").select("page_key,section_key,title,position,visible,required,editable_copy,headline,subtitle,updated_at").eq("page_key",page).order("position"),
   (supabase as any).from("rk_visual_page_revisions").select("*").eq("page_key",page).order("revision",{ascending:false}).limit(20),
  ]);
  if(published.error||!Array.isArray(published.data)||!published.data.length){
   setEditorError(published.error?.message||"The page registry is not deployed yet.");setSource([]);setDraft([]);
  }else{
   const rows=published.data as VisualPageSection[];
   setSource(rows);setDraft(mapSnapshot(rows));setSelected(rows[0].section_key);
   setUndo([]);setRedo([]);setRestoring(false);
  }
  if(!rev.error)setHistory((rev.data||[]) as Revision[]);
  setLoading(false);
 },[page]);
 useEffect(()=>{void loadPage();},[loadPage]);
 useEffect(()=>{void loadResidences();},[loadResidences]);

 const sendPreview=useCallback(()=>{
  if(!frame.current?.contentWindow||!draft.length)return;
  const requestId=++previewRequest.current;
  frame.current.contentWindow.postMessage(
   {type:"rk-visual-preview",page,sections:normalized(draft),requestId},window.location.origin);
  setPreviewState("syncing");
 },[page,draft]);
 useEffect(()=>{sendPreview();},[sendPreview]);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
   if(event.data?.page!==page)return;
   if(event.data?.type==="rk-visual-select"&&typeof event.data.sectionKey==="string"&&
      source.some(row=>row.section_key===event.data.sectionKey)){
    setSelected(event.data.sectionKey);setTab("pages");
   }
   if(event.data?.type==="rk-visual-ready")sendPreview();
   if(event.data?.type==="rk-visual-applied"&&event.data.requestId===previewRequest.current)
    setPreviewState("ready");
  };
  window.addEventListener("message",listener);
  return()=>window.removeEventListener("message",listener);
 },[page,sendPreview,source]);
 // Report a blocked, stale or unmounted frame instead of displaying a permanent blank panel.
 useEffect(()=>{
  if(previewState==="ready"||previewState==="error"||!draft.length||tab!=="pages")return;
  const timeout=window.setTimeout(()=>setPreviewState(state=>state==="ready"?state:"error"),12000);
  return()=>window.clearTimeout(timeout);
 },[previewState,page,previewNonce,draft.length,tab]);
 useEffect(()=>{
  if(previewState!=="ready"||!selected)return;
  frame.current?.contentWindow?.postMessage({type:"rk-visual-focus",page,sectionKey:selected},window.location.origin);
 },[page,selected,previewState]);
 useEffect(()=>{
  if(!unsavedLocal)return;
  const onLeave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  window.addEventListener("beforeunload",onLeave);
  return()=>window.removeEventListener("beforeunload",onLeave);
 },[unsavedLocal]);
 const reloadPreview=()=>{setPreviewState("loading");setPreviewNonce(n=>n+1);};
 const switchPage=(next:VisualPageKey)=>{
  if(next===page)return;
  if(unsavedLocal&&!window.confirm("Your current page has edits not saved as a draft. Switch pages and discard those changes?"))return;
  setPage(next);setPreviewState("loading");setPublishedSuccess(false);setPreviewNonce(n=>n+1);
 };
 const discard=()=>{
  if(unsavedLocal&&!window.confirm("Discard unsaved changes to this page and reload its published layout?"))return;
  void loadPage();
 };

 const mutate=(transform:(current:VisualSectionDraft[])=>VisualSectionDraft[])=>{
  setPublishedSuccess(false);
  setUndo(items=>[...items.slice(-24),clone(draft)]);
  setRedo([]);setDraft(transform(clone(draft)));
 };
 const patch=(p:Partial<VisualSectionDraft>)=>mutate(rows=>rows.map(row=>row.section_key===selected?{...row,...p}:row));
 const patchByKey=(key:string,p:Partial<VisualSectionDraft>)=>mutate(rows=>rows.map(row=>row.section_key===key?{...row,...p}:row));
 const move=(key:string,target:string)=>{
  if(page!=="landing" || key===target)return;
  const items=normalized(draft);
  const from=items.findIndex(row=>row.section_key===key),to=items.findIndex(row=>row.section_key===target);
  if(from<0||to<0)return;
  const next=[...items];const [item]=next.splice(from,1);next.splice(to,0,item);
  mutate(()=>next.map((row,i)=>({...row,position:(i+1)*10})));setSelected(key);
 };
 const moveStep=(key:string,index:number,direction:-1|1,el:HTMLElement)=>{
  const candidate=sorted[index+direction];
  if(page!=="landing" || !candidate){indicateRkBoundary(el);return;}
  move(key,candidate.section_key);
 };
 const stepUndo=()=>{if(!undo.length)return;setRedo(r=>[...r,clone(draft)]);setDraft(clone(undo[undo.length-1]));setUndo(u=>u.slice(0,-1));};
 const stepRedo=()=>{if(!redo.length)return;setUndo(u=>[...u,clone(draft)]);setDraft(clone(redo[redo.length-1]));setRedo(r=>r.slice(0,-1));};
 const save=async(publish:boolean)=>{
  if(!draft.length||saving)return;
  if(publish&&!window.confirm("Publish these page changes to the live ResKonnect website?"))return;
  setSaving(true);
  const {data,error}=await (supabase as any).rpc("rk_visual_save_page",{
   p_page:page,p_snapshot:normalized(draft),p_publish:publish,
   p_note:note.trim()||null,p_rollback:restoring,
  });
  setSaving(false);
  if(error||!data){toast.error(error?.message||"Visual editor save was not confirmed");return;}
  toast.success(publish?"Live page published and version saved":"Draft revision saved privately");
  setNote("");
  if(publish){await loadPage();setPublishedSuccess(true);}
  else{
   setSavedDraftSignature(draftSignature);
   const {data:versions}=await (supabase as any).from("rk_visual_page_revisions")
    .select("*").eq("page_key",page).order("revision",{ascending:false}).limit(20);
   setHistory((versions||[]) as Revision[]);
  }
 };
 const restore=(revision:Revision)=>{
  if(!Array.isArray(revision.snapshot)||!window.confirm("Load revision "+revision.revision+" into the editor? Nothing is published until you select Publish live."))return;
  setUndo(items=>[...items,clone(draft)]);setRedo([]);
  setDraft(clone(revision.snapshot));setRestoring(revision.state==="published");setSavedDraftSignature(JSON.stringify(normalized(revision.snapshot)));setSelected(revision.snapshot[0]?.section_key||selected);
  toast.info("Version loaded for preview. Review before publishing.");
 };
 const currentPreviewWidth=viewport==="mobile"?"390px":viewport==="tablet"?"820px":"100%";
 return <AdminLayout>
  <SEO noIndex title="God Mode Visual Studio | ResKonnect" description="Secure visual editor, residence management, public page content and revisions"/>
  <div className="rk-motion rk-visual-studio min-w-0 space-y-5">
   <div className="overflow-hidden rounded-[24px] border border-[#173b70]/25 bg-[linear-gradient(120deg,#071326,#153c75)] px-5 py-6 text-white sm:px-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
     <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-[#f5b32f]"><Layers className="h-4 w-4"/> ResKonnect · God Mode</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Visual Management Studio</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Edit the real website, manage accommodation profiles, control high-visibility showcases and publish with an audited revision history.</p></div>
     <div className="flex flex-wrap gap-2"><Badge className="border border-[#f5b32f]/40 bg-[#f5b32f]/15 text-[#ffe2a2]"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>MFA protected</Badge>
      <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link to="/" target="_blank"><ExternalLink className="mr-2 h-4 w-4"/>Public site</Link></Button></div>
    </div>
   </div>
   <div className="rk-stagger-list grid gap-3 sm:grid-cols-3">
    {studioMetrics.map(([label,value])=><div key={label} className="rk-neo-stat flex min-h-20 flex-col justify-center px-5 py-3">
     <p className="text-[11px] font-black uppercase tracking-widest text-[#5d708a]">{label}</p>
     <p className="mt-1 text-2xl font-black text-[#071326]">{value.toLocaleString("en-ZA")}</p>
    </div>)}
   </div>
   <Tabs value={tab} onValueChange={setTab}>
    <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
     <TabsTrigger value="pages"><Layers className="mr-1.5 h-4 w-4"/>Visual pages</TabsTrigger>
     <TabsTrigger value="residences"><Building2Icon/>Properties</TabsTrigger>
     <TabsTrigger value="showcases"><Move className="mr-1.5 h-4 w-4"/>Showcases</TabsTrigger>
     <TabsTrigger value="media"><Image className="mr-1.5 h-4 w-4"/>Media & cards</TabsTrigger>
    </TabsList>
    <TabsContent value="pages" className="mt-5 space-y-4">
     <div className="rk-neo-panel flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2"><Label htmlFor="rk-editor-page">Editing</Label>
       <select id="rk-editor-page" value={page} onChange={e=>switchPage(e.target.value as VisualPageKey)}
        className="h-10 rounded-xl border bg-background px-3 text-sm font-black">
        <option value="landing">Homepage</option><option value="findmyres">Find My Res</option>
       </select>
       <Badge variant={dirty?"secondary":"outline"}>{dirty?(unsavedLocal?"Unsaved changes":"Saved draft · not live"):"Matching published version"}</Badge>
       <Badge variant="outline">{changedBlocks} changed block{changedBlocks===1?"":"s"}</Badge>
       {canResumeDraft&&<Button type="button" size="sm" variant="outline" disabled={loading||saving} onClick={()=>restore(latestDraft!)}><History className="mr-1.5 h-4 w-4"/>Resume saved draft</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
       <Button size="sm" variant="outline" disabled={!undo.length} onClick={stepUndo} aria-label="Undo"><Undo2 className="h-4 w-4"/></Button>
       <Button size="sm" variant="outline" disabled={!redo.length} onClick={stepRedo} aria-label="Redo"><Redo2 className="h-4 w-4"/></Button>
       <Button size="sm" variant="outline" onClick={discard} disabled={loading||saving}><RefreshCw className="mr-1.5 h-4 w-4"/>Discard / refresh</Button>
       <Button size="sm" variant="outline" disabled={saving||loading||!draft.length||!unsavedLocal} onClick={()=>void save(false)}><Save className="mr-1.5 h-4 w-4"/>Save draft</Button>
       <Button size="sm" disabled={saving||loading||!draft.length||!dirty} className={"rk-clay-action "+(publishedSuccess?"rk-success-pulse":"")} onClick={()=>void save(true)}>
        <RkMorphIcon idle={Save} active={CheckCircle2} isActive={publishedSuccess}/>{saving?"Saving…":publishedSuccess?"Published":"Publish live"}
       </Button>
       <span role="status" aria-live="polite" className="sr-only">{publishedSuccess?"Page published successfully":""}</span>
      </div>
     </div>
     {editorError&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{editorError}. The public website stays on its existing layout.</div>}
     <div className="grid min-w-0 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
      <Card className="rk-neo-panel min-w-0 overflow-hidden"><CardContent className="p-3">
       <div className="mb-3 flex items-center justify-between"><p className="font-black">Page navigator</p><Badge variant="secondary">{draft.length} blocks</Badge></div>
       <div className="max-h-[72vh] space-y-1 overflow-y-auto">
        {sorted.map((row,i)=>{
         const slot=source.find(s=>s.section_key===row.section_key);
         return <div role="button" tabIndex={0} key={row.section_key}
          aria-pressed={selected===row.section_key} aria-label={"Inspect "+(slot?.title||row.section_key)}
          draggable={!loading&&page==="landing"} onDragStart={()=>{if(page==="landing")dragging.current=row.section_key;}}
          onDragOver={e=>{if(page==="landing")e.preventDefault();}} onDrop={e=>{e.preventDefault();if(page==="landing"&&dragging.current)move(dragging.current,row.section_key);dragging.current=null;}}
          onClick={()=>setSelected(row.section_key)}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(row.section_key);}}}
          className={"rk-pressable flex w-full cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 "+(selected===row.section_key?"border-[#2563eb] bg-[#eef4ff]":"border-transparent hover:border-border hover:bg-muted/60")}>
          <Move className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 truncate text-xs font-bold">{slot?.title||row.section_key}</span>
          <button type="button" disabled={slot?.required} aria-label={(row.visible?"Hide ":"Show ")+(slot?.title||row.section_key)}
           title={slot?.required?"Required section cannot be hidden":"Toggle section visibility"}
           onClick={e=>{e.stopPropagation();patchByKey(row.section_key,{visible:!row.visible});}}
           className="rounded p-1.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
           {!row.visible?<EyeOff className="h-3.5 w-3.5 text-amber-600"/>:<Eye className="h-3.5 w-3.5 text-muted-foreground"/>}
          </button>
          <span className="flex flex-col gap-0.5">
           <button type="button" aria-label={"Move "+(slot?.title||row.section_key)+" up"} disabled={page!=="landing"} onClick={e=>{e.stopPropagation();moveStep(row.section_key,i,-1,e.currentTarget);}} className="rounded p-1 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><ArrowUp className="h-3 w-3"/></button>
           <button type="button" aria-label={"Move "+(slot?.title||row.section_key)+" down"} disabled={page!=="landing"} onClick={e=>{e.stopPropagation();moveStep(row.section_key,i,1,e.currentTarget);}} className="rounded p-1 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><ArrowDown className="h-3 w-3"/></button>
          </span>
         </div>;
        })}
       </div>
       <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{page==="landing"?"Drag homepage blocks to reorder them. Required sections cannot be hidden. Use the canvas buttons to select blocks visually.":"Find My Res keeps its search-to-application journey in a fixed sequence; visibility and approved copy are editable without disrupting that flow."}</p>
      </CardContent></Card>
      <div className="min-w-0 space-y-3">
       <div className="rk-neo-panel flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="min-w-0">
         <p className="text-xs font-black">Real page preview · unpublished edits</p>
         <p role="status" aria-live="polite" className={"mt-1 text-[11px] "+(previewState==="ready"?"text-emerald-700":previewState==="error"?"text-red-700":"text-muted-foreground")}>
          {previewState==="ready"?"Canvas connected · edits synced":
           previewState==="error"?"Canvas unavailable · try Reload preview":
           previewState==="syncing"?"Applying draft to live preview…":"Loading live website…"}
         </p>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Preview device width">
         <Button type="button" size="sm" variant="outline" className="h-8" onClick={reloadPreview} aria-label="Reload preview"><RefreshCw className="h-4 w-4"/></Button>
         <Button type="button" size="sm" variant="outline" className="h-8" asChild><a href={pageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open published website in new tab"><ExternalLink className="h-4 w-4"/></a></Button>
         {([["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]] as const).map(([v,Icon])=>
          <Button key={v} type="button" size="sm" variant={viewport===v?"default":"outline"} aria-label={v+" preview"} aria-pressed={viewport===v} onClick={()=>runRkLayoutTransition(()=>setViewport(v))} className="h-8"><Icon className="h-4 w-4"/></Button>)}
        </div>
       </div>
       <div className="flex min-h-[650px] justify-center overflow-hidden rounded-2xl border border-[#cbd7e8] bg-[#eef2f7] p-1.5 sm:p-3">
        <div className="rk-device-shell rk-layout-morph shrink-0 self-start" data-device={viewport} style={{width:currentPreviewWidth,maxWidth:"100%"}}>
         <div className="rk-device-glass">
          <iframe key={page+":"+previewNonce} ref={frame} title={"Visual preview of "+page+" on "+viewport}
           onLoad={()=>{setPreviewState("loading");sendPreview();}} onError={()=>setPreviewState("error")} src={previewUrl}
           className="block h-[830px] w-full border-0 bg-white" loading="eager"/>
         </div>
        </div>
       </div>
       {previewState==="error"&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <p>Preview did not connect. Your draft is safe. Reload the preview, or open the public page in a separate tab to check connectivity.</p>
        <Button size="sm" variant="outline" onClick={reloadPreview}><RefreshCw className="mr-1.5 h-4 w-4"/>Retry preview</Button>
       </div>}
      </div>
      <div className="min-w-0 space-y-3">
       <Card className="rk-neo-panel"><CardContent className="space-y-4 p-4">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#2563eb]">Block inspector</p><h3 className="mt-1 text-lg font-black">{active?.title||"Select a section"}</h3></div>
        {active&&edit?<><p className="text-xs text-muted-foreground">The properties below are reflected in the preview immediately. Changes reach visitors only after publishing.</p>
         <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-xs font-bold">Show this section</span><Switch checked={edit.visible} disabled={active.required} onCheckedChange={v=>patch({visible:v})}/></label>
         {active.required&&<p className="text-[11px] text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>Required for navigation, compliance or student workflows.</p>}
         {active.editable_copy?<><div><Label htmlFor="rk-vs-headline">Section heading</Label><Textarea id="rk-vs-headline" maxLength={180} className="mt-1" rows={3} value={edit.headline} onChange={e=>patch({headline:e.target.value})}/></div>
          <div><Label htmlFor="rk-vs-subtitle">Supporting text</Label><Textarea id="rk-vs-subtitle" maxLength={450} className="mt-1" rows={5} value={edit.subtitle} onChange={e=>patch({subtitle:e.target.value})}/></div></>:
          <p className="rounded-lg bg-[#f8fafc] p-3 text-xs leading-5 text-muted-foreground">This is a registered functional component. Manage its content with the linked editor; its application, search and compliance logic stays protected.</p>}
         {TARGETS[selected]&&(TARGETS[selected].url?
          <Button size="sm" variant="outline" className="w-full" asChild><Link to={TARGETS[selected].url!}>{TARGETS[selected].label}</Link></Button>:
          <Button size="sm" variant="outline" className="w-full" onClick={()=>setTab(TARGETS[selected].tab)}>{TARGETS[selected].label}</Button>)}
         <Label htmlFor="rk-vs-note">Change note (optional)</Label><Input id="rk-vs-note" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Why this layout was updated"/>
        </>:<p className="text-xs text-muted-foreground">Choose a block on the left or click an Edit button in the page preview.</p>}
       </CardContent></Card>
       <Card className="rk-neo-panel"><CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2"><History className="h-4 w-4"/><h3 className="font-black">Versions & rollback</h3></div>
        {history.length===0?<p className="text-xs text-muted-foreground">No previous saved editor revisions.</p>:
         <div className="max-h-64 space-y-2 overflow-auto">
          {history.map(revision=><div key={revision.id} className="rounded-xl border p-2.5">
           <div className="flex flex-wrap items-center justify-between gap-1"><p className="text-xs font-bold">Revision {revision.revision}</p><Badge variant={revision.state==="published"?"default":"secondary"}>{revision.state}</Badge></div>
           <p className="mt-1 text-[10px] text-muted-foreground">{new Date(revision.created_at).toLocaleString("en-ZA")}</p>
           {revision.note&&<p className="mt-1 line-clamp-2 text-[11px]">{revision.note}</p>}
           <Button size="sm" variant="outline" className="mt-2 h-8 w-full text-xs" onClick={()=>restore(revision)}><RotateCcw className="mr-1 h-3.5 w-3.5"/>Load this version</Button>
          </div>)}
         </div>}
       </CardContent></Card>
      </div>
     </div>
    </TabsContent>
    <TabsContent value="residences" className="mt-5"><ResidenceVisualManager rows={residences} onRefresh={loadResidences}/></TabsContent>
    <TabsContent value="showcases" className="mt-5 space-y-5">
     <div className="rounded-2xl border bg-card p-4"><h2 className="text-xl font-black">Living showcase controls</h2><p className="mt-2 text-sm text-muted-foreground">Edit the residence choices and display order used by the live homepage and Find My Res. Private ranking metrics are never exposed to the public.</p></div>
     <SpotlightPlacementManager residences={residences} onRefresh={()=>{void loadResidences();}}/>
     <MonthlyTopThreeManager residences={residences}/>
     <TrustedResidencesEditor/>
    </TabsContent>
    <TabsContent value="media" className="mt-5 space-y-5">
     <div className="rounded-2xl border bg-card p-4"><h2 className="text-xl font-black">Visual media & discovery cards</h2><p className="mt-2 text-sm text-muted-foreground">Use the existing production media managers in this workspace. No duplicate content records are created.</p></div>
     <div className="flex flex-wrap gap-2">{mediaLinks.map(([label,to])=><Button key={to} size="sm" variant="outline" asChild><Link to={to}>{label}<ExternalLink className="ml-1.5 h-3.5 w-3.5"/></Link></Button>)}</div>
     <AdminSlidesContent/>
     <AdminCategoryCardsContent/>
    </TabsContent>
   </Tabs>
  </div>
 </AdminLayout>;
}
function Building2Icon(){return <span aria-hidden="true" className="mr-1.5">▦</span>;}
