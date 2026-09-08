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
const PROVIDER = "tumelo";
const CONTENT_SLUG = "tumelo-career-education";
const parseLines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const parseTags = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

type PartnerContent = {
  id: string;
  partner_name: string;
  section_title: string;
  subtitle: string;
  social_handle: string;
  social_url: string;
  preview_text: string;
  summary: string;
  bullet_points: string[];
  tags: string[];
  cta_label: string;
  cta_url: string;
  is_published: boolean;
};

type ProviderRow = {
  id: string;
  name: string;
  role_label: string;
  bio: string | null;
  profile_image_url: string | null;
  social_handle: string | null;
  social_url: string | null;
  is_published: boolean;
};

type VideoRow = {
  id: string;
  title: string;
  platform: string;
  video_url: string | null;
  transcript: string | null;
  transcript_points: string[];
  tags: string[];
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
};

const blankVideo = { title: "", platform: "tiktok", video_url: "", transcript: "", transcript_points: "", tags: "", sort_order: 0 };

const TumeloCareerEditor = () => {
  const [content, setContent] = useState<PartnerContent | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [videoForm, setVideoForm] = useState({ ...blankVideo });
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [contentRes, providerRes, videoRes] = await Promise.all([
      client.from("partner_content").select("*").eq("slug", CONTENT_SLUG).maybeSingle(),
      client.from("career_education_providers").select("*").eq("slug", PROVIDER).maybeSingle(),
      client.from("partner_videos").select("*").eq("provider_slug", PROVIDER).order("is_featured", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    ]);
    setLoading(false);

    if (contentRes.error || providerRes.error || videoRes.error) {
      toast.error("Could not load your Career & Education editor. Refresh and try again.");
      return;
    }

    if (contentRes.data) setContent({
      ...contentRes.data,
      bullet_points: Array.isArray(contentRes.data.bullet_points) ? contentRes.data.bullet_points : [],
      tags: Array.isArray(contentRes.data.tags) ? contentRes.data.tags : [],
    });
    if (providerRes.data) setProvider(providerRes.data as ProviderRow);
    setVideos((videoRes.data || []).map((row: any) => ({
      ...row,
      transcript_points: Array.isArray(row.transcript_points) ? row.transcript_points : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
    })) as VideoRow[]);
  };

  useEffect(() => { void load(); }, []);

  const saveContent = async () => {
    if (!content) return;
    setSaving(true);
    const { error } = await client.from("partner_content").update({
      partner_name: content.partner_name,
      section_title: content.section_title,
      subtitle: content.subtitle,
      social_handle: content.social_handle,
      social_url: content.social_url,
      preview_text: content.preview_text,
      summary: content.summary,
      bullet_points: content.bullet_points,
      tags: content.tags,
      cta_label: content.cta_label,
      cta_url: content.cta_url,
      is_published: content.is_published,
      updated_at: new Date().toISOString(),
    }).eq("id", content.id).eq("slug", CONTENT_SLUG);
    setSaving(false);
    if (error) return toast.error(error.message || "Could not save your public section.");
    toast.success("Career & Education section updated on ResKonnect.");
  };

  const saveProvider = async () => {
    if (!provider) return;
    setSaving(true);
    const { error } = await client.from("career_education_providers").update({
      name: provider.name,
      role_label: provider.role_label,
      bio: provider.bio,
      profile_image_url: provider.profile_image_url,
      social_handle: provider.social_handle,
      social_url: provider.social_url,
      is_published: provider.is_published,
      updated_at: new Date().toISOString(),
    }).eq("id", provider.id).eq("slug", PROVIDER);
    setSaving(false);
    if (error) return toast.error(error.message || "Could not save your contributor profile.");
    toast.success("Contributor profile updated.");
  };

  const submitVideo = async (event: FormEvent) => {
    event.preventDefault();
    if (!videoForm.title.trim()) return toast.error("Add a video title first.");
    if (!videoForm.video_url.trim()) return toast.error("Add the original video URL first.");

    const payload = {
      provider_slug: PROVIDER,
      title: videoForm.title.trim(),
      platform: videoForm.platform,
      video_url: videoForm.video_url.trim(),
      transcript: videoForm.transcript.trim() || null,
      transcript_points: parseLines(videoForm.transcript_points),
      tags: parseTags(videoForm.tags),
      sort_order: Number(videoForm.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    const { error } = editingVideoId
      ? await client.from("partner_videos").update(payload).eq("id", editingVideoId).eq("provider_slug", PROVIDER)
      : await client.from("partner_videos").insert({ ...payload, is_published: true, is_featured: videos.length === 0 });
    setSaving(false);

    if (error) return toast.error(error.message || "Could not save the video.");
    toast.success(editingVideoId ? "Video updated." : "Video published to your Career & Education library.");
    setEditingVideoId(null);
    setVideoForm({ ...blankVideo });
    await load();
  };

  const editVideo = (video: VideoRow) => {
    setEditingVideoId(video.id);
    setVideoForm({
      title: video.title,
      platform: video.platform,
      video_url: video.video_url || "",
      transcript: video.transcript || "",
      transcript_points: (video.transcript_points || []).join("\n"),
      tags: (video.tags || []).join(", "),
      sort_order: video.sort_order || 0,
    });
    document.getElementById("tumelo-video-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const featureVideo = async (video: VideoRow) => {
    const clear = await client.from("partner_videos").update({ is_featured: false }).eq("provider_slug", PROVIDER);
    if (clear.error) return toast.error(clear.error.message || "Could not update featured video.");
    const next = await client.from("partner_videos").update({ is_featured: true, is_published: true, updated_at: new Date().toISOString() }).eq("id", video.id).eq("provider_slug", PROVIDER);
    if (next.error) return toast.error(next.error.message || "Could not feature video.");
    toast.success("Featured video updated.");
    await load();
  };

  const toggleVideo = async (video: VideoRow) => {
    const { error } = await client.from("partner_videos").update({ is_published: !video.is_published, updated_at: new Date().toISOString() }).eq("id", video.id).eq("provider_slug", PROVIDER);
    if (error) return toast.error(error.message || "Could not change video visibility.");
    await load();
  };

  const deleteVideo = async (video: VideoRow) => {
    if (!window.confirm(`Delete “${video.title}” from your ResKonnect section?`)) return;
    const { error } = await client.from("partner_videos").delete().eq("id", video.id).eq("provider_slug", PROVIDER);
    if (error) return toast.error(error.message || "Could not delete video.");
    toast.success("Video removed.");
    if (editingVideoId === video.id) { setEditingVideoId(null); setVideoForm({ ...blankVideo }); }
    await load();
  };

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading your live Career & Education controls…</CardContent></Card>;

  return (
    <section className="space-y-6" id="manage-career-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Owner controls</p><h2 className="mt-1 text-2xl font-black">Manage your Career & Education section</h2><p className="mt-1 text-sm text-muted-foreground">Changes here are scoped to Tumelo content only. No student or AdminOS data is exposed.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button asChild variant="outline"><a href="/career-education/tumelo" target="_blank" rel="noreferrer">Preview public page <ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
      </div>

      {content && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5" />Live section copy</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Section title</Label><Input value={content.section_title} onChange={(e) => setContent({ ...content, section_title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Display name</Label><Input value={content.partner_name} onChange={(e) => setContent({ ...content, partner_name: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Subtitle</Label><Textarea rows={3} value={content.subtitle} onChange={(e) => setContent({ ...content, subtitle: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Social handle</Label><Input value={content.social_handle} onChange={(e) => setContent({ ...content, social_handle: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Social URL</Label><Input type="url" value={content.social_url} onChange={(e) => setContent({ ...content, social_url: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Preview headline</Label><Input value={content.preview_text} onChange={(e) => setContent({ ...content, preview_text: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Summary</Label><Textarea rows={4} value={content.summary} onChange={(e) => setContent({ ...content, summary: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Guidance points · one per line</Label><Textarea rows={8} value={content.bullet_points.join("\n")} onChange={(e) => setContent({ ...content, bullet_points: parseLines(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Topics / tags · comma separated</Label><Textarea rows={8} value={content.tags.join(", ")} onChange={(e) => setContent({ ...content, tags: parseTags(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>CTA label</Label><Input value={content.cta_label} onChange={(e) => setContent({ ...content, cta_label: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>CTA destination</Label><Input value={content.cta_url} onChange={(e) => setContent({ ...content, cta_url: e.target.value })} /></div>
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={content.is_published} onChange={(e) => setContent({ ...content, is_published: e.target.checked })} />Public section published</label><Button onClick={() => void saveContent()} disabled={saving}><Save className="mr-2 h-4 w-4" />Save live section</Button></div>
          </CardContent>
        </Card>
      )}

      {provider && (
        <Card>
          <CardHeader><CardTitle>Contributor profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={provider.name} onChange={(e) => setProvider({ ...provider, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Role label</Label><Input value={provider.role_label} onChange={(e) => setProvider({ ...provider, role_label: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Bio</Label><Textarea rows={4} value={provider.bio || ""} onChange={(e) => setProvider({ ...provider, bio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Profile image URL</Label><Input type="url" value={provider.profile_image_url || ""} onChange={(e) => setProvider({ ...provider, profile_image_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Social handle</Label><Input value={provider.social_handle || ""} onChange={(e) => setProvider({ ...provider, social_handle: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Social URL</Label><Input type="url" value={provider.social_url || ""} onChange={(e) => setProvider({ ...provider, social_url: e.target.value })} /></div>
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={provider.is_published} onChange={(e) => setProvider({ ...provider, is_published: e.target.checked })} />Contributor profile published</label><Button onClick={() => void saveProvider()} disabled={saving}><Save className="mr-2 h-4 w-4" />Save profile</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.85fr,1.15fr]" id="tumelo-video-editor">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">{editingVideoId ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}{editingVideoId ? "Edit video" : "Publish a video"}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitVideo}>
              <div className="space-y-1.5"><Label>Video title</Label><Input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Platform</Label><select value={videoForm.platform} onChange={(e) => setVideoForm({ ...videoForm, platform: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="other">Other</option></select></div><div className="space-y-1.5"><Label>Sort order</Label><Input type="number" value={videoForm.sort_order} onChange={(e) => setVideoForm({ ...videoForm, sort_order: Number(e.target.value) })} /></div></div>
              <div className="space-y-1.5"><Label>Original video URL</Label><Input type="url" value={videoForm.video_url} onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })} placeholder="https://www.tiktok.com/..." /></div>
              <div className="space-y-1.5"><Label>Transcript / summary</Label><Textarea rows={4} value={videoForm.transcript} onChange={(e) => setVideoForm({ ...videoForm, transcript: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Key points · one per line</Label><Textarea rows={6} value={videoForm.transcript_points} onChange={(e) => setVideoForm({ ...videoForm, transcript_points: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tags · comma separated</Label><Input value={videoForm.tags} onChange={(e) => setVideoForm({ ...videoForm, tags: e.target.value })} /></div>
              <div className="flex gap-2"><Button className="flex-1" disabled={saving}>{saving ? "Saving…" : editingVideoId ? "Save video" : "Publish video"}</Button>{editingVideoId && <Button type="button" variant="outline" onClick={() => { setEditingVideoId(null); setVideoForm({ ...blankVideo }); }}>Cancel</Button>}</div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" />Your video library</CardTitle><Badge variant="outline">{videos.length} videos</Badge></CardHeader>
          <CardContent className="space-y-3">
            {videos.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No videos yet. Publish your first Career & Education video.</div> : videos.map((video) => (
              <div key={video.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant={video.is_published ? "default" : "secondary"}>{video.is_published ? "Published" : "Hidden"}</Badge>{video.is_featured && <Badge><Star className="mr-1 h-3 w-3 fill-current" />Featured</Badge>}</div><h3 className="mt-2 font-bold">{video.title}</h3>{video.video_url && <a href={video.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open original <ExternalLink className="h-3 w-3" /></a>}</div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => editVideo(video)}><Edit3 className="mr-1 h-4 w-4" />Edit</Button>{!video.is_featured && <Button size="sm" variant="outline" onClick={() => void featureVideo(video)}><Star className="mr-1 h-4 w-4" />Feature</Button>}<Button size="sm" variant="outline" onClick={() => void toggleVideo(video)}>{video.is_published ? "Hide" : "Publish"}</Button><Button size="icon" variant="outline" aria-label={`Delete ${video.title}`} onClick={() => void deleteVideo(video)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default TumeloCareerEditor;
