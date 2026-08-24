import { FormEvent, useEffect, useState } from "react";
import { Edit3, ExternalLink, Plus, RefreshCw, Save, Star, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const client = supabase as any;
const parseLines = (value: string) => value.split("\n").map(v => v.trim()).filter(Boolean);
const parseTags = (value: string) => value.split(",").map(v => v.trim()).filter(Boolean);

type VideoRow = { id:string; provider_slug:string; title:string; platform:string; video_url:string|null; transcript:string|null; transcript_points:string[]; tags:string[]; is_featured:boolean; is_published:boolean; sort_order:number; };
type ProviderRow = { id:string; slug:string; name:string; role_label:string; bio:string|null; profile_image_url:string|null; profile_page_path:string; social_handle:string|null; social_url:string|null; is_featured:boolean; is_published:boolean; sort_order:number; };
type PartnerContent = { id:string; slug:string; partner_name:string; section_title:string; subtitle:string; social_handle:string; social_url:string; preview_text:string; summary:string; bullet_points:string[]; tags:string[]; cta_label:string; cta_url:string; is_published:boolean; };

export const AdminCareerEducationContent = () => {
  const [videos,setVideos]=useState<VideoRow[]>([]);
  const [providers,setProviders]=useState<ProviderRow[]>([]);
  const [content,setContent]=useState<PartnerContent|null>(null);
  const [editingVideo,setEditingVideo]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [videoForm,setVideoForm]=useState({ provider_slug:"tumelo", title:"", platform:"tiktok", video_url:"", transcript:"", transcript_points:"", tags:"" });

  const load = async () => {
    const [videosRes,providersRes,contentRes]=await Promise.all([
      client.from("partner_videos").select("*").order("provider_slug").order("is_featured",{ascending:false}).order("created_at",{ascending:false}),
      client.from("career_education_providers").select("*").order("sort_order"),
      client.from("partner_content").select("*").eq("slug","tumelo-career-education").maybeSingle(),
    ]);
    if(videosRes.error||providersRes.error||contentRes.error) toast.error("Could not load Career & Education content.");
    setVideos((videosRes.data||[]).map((r:any)=>({...r,transcript_points:Array.isArray(r.transcript_points)?r.transcript_points:[],tags:Array.isArray(r.tags)?r.tags:[]})));
    setProviders(providersRes.data||[]);
    if(contentRes.data) setContent({...contentRes.data,bullet_points:Array.isArray(contentRes.data.bullet_points)?contentRes.data.bullet_points:[],tags:Array.isArray(contentRes.data.tags)?contentRes.data.tags:[]});
  };

  useEffect(()=>{load();},[]);

  const savePartnerContent = async () => {
    if(!content) return;
    setSaving(true);
    const { error } = await client.from("partner_content").update({
      partner_name:content.partner_name, section_title:content.section_title, subtitle:content.subtitle,
      social_handle:content.social_handle, social_url:content.social_url, preview_text:content.preview_text,
      summary:content.summary, bullet_points:content.bullet_points, tags:content.tags,
      cta_label:content.cta_label, cta_url:content.cta_url, is_published:content.is_published,
      updated_at:new Date().toISOString(),
    }).eq("id",content.id);
    setSaving(false);
    if(error) toast.error(error.message||"Could not update section content");
    else toast.success("Published Career & Education section updated. Frontend reads this record directly.");
  };

  const saveProvider = async (provider:ProviderRow) => {
    const { error } = await client.from("career_education_providers").update({
      name:provider.name, role_label:provider.role_label, bio:provider.bio, profile_image_url:provider.profile_image_url,
      profile_page_path:provider.profile_page_path, social_handle:provider.social_handle, social_url:provider.social_url,
      is_featured:provider.is_featured, is_published:provider.is_published, sort_order:provider.sort_order, updated_at:new Date().toISOString(),
    }).eq("id",provider.id);
    if(error) toast.error(error.message||"Could not update provider"); else toast.success(`${provider.name} updated.`);
  };

  const submitVideo = async (e:FormEvent) => {
    e.preventDefault();
    if(!videoForm.title.trim()) return toast.error("Add a video title.");
    const payload={provider_slug:videoForm.provider_slug.trim(),title:videoForm.title.trim(),platform:videoForm.platform,video_url:videoForm.video_url.trim()||null,transcript:videoForm.transcript.trim()||null,transcript_points:parseLines(videoForm.transcript_points),tags:parseTags(videoForm.tags),updated_at:new Date().toISOString()};
    setSaving(true);
    const { error } = editingVideo ? await client.from("partner_videos").update(payload).eq("id",editingVideo) : await client.from("partner_videos").insert({...payload,is_published:true,is_featured:videos.filter(v=>v.provider_slug===videoForm.provider_slug).length===0});
    setSaving(false);
    if(error) return toast.error(error.message||"Could not save video");
    toast.success(editingVideo?"Published video updated.":"Career & Education video added.");
    setEditingVideo(null); setVideoForm({provider_slug:"tumelo",title:"",platform:"tiktok",video_url:"",transcript:"",transcript_points:"",tags:""}); await load();
  };

  const editVideo=(video:VideoRow)=>{setEditingVideo(video.id);setVideoForm({provider_slug:video.provider_slug,title:video.title,platform:video.platform,video_url:video.video_url||"",transcript:video.transcript||"",transcript_points:(video.transcript_points||[]).join("\n"),tags:(video.tags||[]).join(", ")});window.scrollTo({top:0,behavior:"smooth"});};
  const featureVideo=async(video:VideoRow)=>{await client.from("partner_videos").update({is_featured:false}).eq("provider_slug",video.provider_slug);await client.from("partner_videos").update({is_featured:true,is_published:true,updated_at:new Date().toISOString()}).eq("id",video.id);await load();};
  const togglePublished=async(video:VideoRow)=>{await client.from("partner_videos").update({is_published:!video.is_published,updated_at:new Date().toISOString()}).eq("id",video.id);await load();};
  const remove=async(video:VideoRow)=>{if(!window.confirm(`Delete “${video.title}”?`)) return;await client.from("partner_videos").delete().eq("id",video.id);await load();};

  return <div className="space-y-6">
    {content && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5"/> Edit live Tumelo section</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5"><Label>Section title</Label><Input value={content.section_title} onChange={e=>setContent({...content,section_title:e.target.value})}/></div>
      <div className="space-y-1.5"><Label>Partner name</Label><Input value={content.partner_name} onChange={e=>setContent({...content,partner_name:e.target.value})}/></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Subtitle</Label><Textarea value={content.subtitle} onChange={e=>setContent({...content,subtitle:e.target.value})}/></div>
      <div className="space-y-1.5"><Label>Social handle</Label><Input value={content.social_handle} onChange={e=>setContent({...content,social_handle:e.target.value})}/></div>
      <div className="space-y-1.5"><Label>Social URL</Label><Input value={content.social_url} onChange={e=>setContent({...content,social_url:e.target.value})}/></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Preview headline</Label><Input value={content.preview_text} onChange={e=>setContent({...content,preview_text:e.target.value})}/></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Summary</Label><Textarea rows={3} value={content.summary} onChange={e=>setContent({...content,summary:e.target.value})}/></div>
      <div className="space-y-1.5"><Label>Guidance points · one per line</Label><Textarea rows={7} value={content.bullet_points.join("\n")} onChange={e=>setContent({...content,bullet_points:parseLines(e.target.value)})}/></div>
      <div className="space-y-1.5"><Label>Tags · comma separated</Label><Textarea rows={7} value={content.tags.join(", ")} onChange={e=>setContent({...content,tags:parseTags(e.target.value)})}/></div>
      <div className="space-y-1.5"><Label>CTA label</Label><Input value={content.cta_label} onChange={e=>setContent({...content,cta_label:e.target.value})}/></div>
      <div className="space-y-1.5"><Label>CTA URL</Label><Input value={content.cta_url} onChange={e=>setContent({...content,cta_url:e.target.value})}/></div>
      <div className="md:col-span-2 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={content.is_published} onChange={e=>setContent({...content,is_published:e.target.checked})}/> Published</label><Button onClick={savePartnerContent} disabled={saving}><Save className="mr-2 h-4 w-4"/> Save live section</Button></div>
    </CardContent></Card>}

    <Card><CardHeader><CardTitle>Career & Education providers</CardTitle></CardHeader><CardContent className="space-y-4">{providers.map((p,i)=><div key={p.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <Input value={p.name} onChange={e=>setProviders(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Name"/>
      <Input value={p.role_label} onChange={e=>setProviders(prev=>prev.map((x,j)=>j===i?{...x,role_label:e.target.value}:x))} placeholder="Role label"/>
      <Textarea value={p.bio||""} onChange={e=>setProviders(prev=>prev.map((x,j)=>j===i?{...x,bio:e.target.value}:x))} placeholder="Bio"/>
      <div className="space-y-2"><Input value={p.social_url||""} onChange={e=>setProviders(prev=>prev.map((x,j)=>j===i?{...x,social_url:e.target.value}:x))} placeholder="Social URL"/><div className="flex items-center justify-between"><label className="text-sm"><input type="checkbox" checked={p.is_published} onChange={e=>setProviders(prev=>prev.map((x,j)=>j===i?{...x,is_published:e.target.checked}:x))}/> Published</label><Button size="sm" onClick={()=>saveProvider(p)}>Save provider</Button></div></div>
    </div>)}</CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2">{editingVideo?<Edit3 className="h-5 w-5"/>:<Plus className="h-5 w-5"/>}{editingVideo?" Edit published video":" Add partner video"}</CardTitle></CardHeader><CardContent><form onSubmit={submitVideo} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Provider slug</Label><Input value={videoForm.provider_slug} onChange={e=>setVideoForm({...videoForm,provider_slug:e.target.value})}/></div><div><Label>Platform</Label><select value={videoForm.platform} onChange={e=>setVideoForm({...videoForm,platform:e.target.value})} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="other">Other</option></select></div></div>
        <div><Label>Video title</Label><Input value={videoForm.title} onChange={e=>setVideoForm({...videoForm,title:e.target.value})}/></div>
        <div><Label>Exact video URL</Label><Input value={videoForm.video_url} onChange={e=>setVideoForm({...videoForm,video_url:e.target.value})}/></div>
        <div><Label>Transcript / summary</Label><Textarea rows={4} value={videoForm.transcript} onChange={e=>setVideoForm({...videoForm,transcript:e.target.value})}/></div>
        <div><Label>Transcript points</Label><Textarea rows={6} value={videoForm.transcript_points} onChange={e=>setVideoForm({...videoForm,transcript_points:e.target.value})}/></div>
        <div><Label>Tags</Label><Input value={videoForm.tags} onChange={e=>setVideoForm({...videoForm,tags:e.target.value})}/></div>
        <div className="flex gap-2"><Button className="flex-1" disabled={saving}>{saving?"Saving...":editingVideo?"Save video changes":"Publish video"}</Button>{editingVideo&&<Button type="button" variant="outline" onClick={()=>{setEditingVideo(null);setVideoForm({provider_slug:"tumelo",title:"",platform:"tiktok",video_url:"",transcript:"",transcript_points:"",tags:""});}}>Cancel</Button>}</div>
      </form></CardContent></Card>

      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5"/> Published library</CardTitle><Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/> Refresh</Button></CardHeader><CardContent className="space-y-3">{videos.map(video=><div key={video.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{video.provider_slug}</Badge><Badge variant={video.is_published?"default":"secondary"}>{video.is_published?"Published":"Hidden"}</Badge>{video.is_featured&&<Badge><Star className="mr-1 h-3 w-3 fill-current"/>Featured</Badge>}</div><h3 className="mt-2 font-bold">{video.title}</h3>{video.video_url&&<a href={video.video_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary inline-flex items-center gap-1">Open original <ExternalLink className="h-3 w-3"/></a>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>editVideo(video)}><Edit3 className="mr-1 h-4 w-4"/> Edit</Button>{!video.is_featured&&<Button size="sm" variant="outline" onClick={()=>featureVideo(video)}><Star className="mr-1 h-4 w-4"/> Feature</Button>}<Button size="sm" variant="outline" onClick={()=>togglePublished(video)}>{video.is_published?"Hide":"Publish"}</Button><Button size="icon" variant="outline" onClick={()=>remove(video)}><Trash2 className="h-4 w-4"/></Button></div></div></div>)}</CardContent></Card>
    </div>
  </div>;
};

export default AdminCareerEducationContent;
