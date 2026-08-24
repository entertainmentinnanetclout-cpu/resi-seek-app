import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Star, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const client = supabase as any;

type VideoRow = {
  id: string;
  provider_slug: string;
  title: string;
  platform: string;
  video_url: string | null;
  transcript: string | null;
  transcript_points: string[];
  tags: string[];
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
};

const parseLines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const parseTags = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export const AdminCareerEducationContent = () => {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider_slug: "tumelo",
    title: "",
    platform: "tiktok",
    video_url: "",
    transcript: "",
    transcript_points: "",
    tags: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await client.from("partner_videos").select("*").order("provider_slug").order("is_featured", { ascending: false }).order("created_at", { ascending: false });
    if (error) toast.error(error.message || "Could not load partner videos");
    else setVideos((data || []).map((row: any) => ({ ...row, transcript_points: Array.isArray(row.transcript_points) ? row.transcript_points : [], tags: Array.isArray(row.tags) ? row.tags : [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return toast.error("Add a video title.");
    setSaving(true);
    const payload = {
      provider_slug: form.provider_slug.trim(),
      title: form.title.trim(),
      platform: form.platform,
      video_url: form.video_url.trim() || null,
      transcript: form.transcript.trim() || null,
      transcript_points: parseLines(form.transcript_points),
      tags: parseTags(form.tags),
      is_published: true,
      is_featured: videos.filter((video) => video.provider_slug === form.provider_slug).length === 0,
    };
    const { error } = await client.from("partner_videos").insert(payload);
    if (error) toast.error(error.message || "Could not add video");
    else {
      toast.success("Career & Education video added.");
      setForm((current) => ({ ...current, title: "", video_url: "", transcript: "", transcript_points: "", tags: "" }));
      await load();
    }
    setSaving(false);
  };

  const featureVideo = async (video: VideoRow) => {
    await client.from("partner_videos").update({ is_featured: false }).eq("provider_slug", video.provider_slug);
    const { error } = await client.from("partner_videos").update({ is_featured: true, is_published: true, updated_at: new Date().toISOString() }).eq("id", video.id);
    if (error) toast.error(error.message || "Could not feature video");
    else {
      toast.success("Featured video updated. The public page will use it automatically.");
      await load();
    }
  };

  const togglePublished = async (video: VideoRow) => {
    const { error } = await client.from("partner_videos").update({ is_published: !video.is_published, updated_at: new Date().toISOString() }).eq("id", video.id);
    if (error) toast.error(error.message || "Could not update video");
    else await load();
  };

  const remove = async (video: VideoRow) => {
    if (!window.confirm(`Delete “${video.title}”?`)) return;
    const { error } = await client.from("partner_videos").delete().eq("id", video.id);
    if (error) toast.error(error.message || "Could not delete video");
    else {
      toast.success("Video removed.");
      await load();
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add partner video</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Provider slug</Label><Input value={form.provider_slug} onChange={(e) => setForm({ ...form, provider_slug: e.target.value })} placeholder="tumelo" /></div>
              <div className="space-y-1.5"><Label>Platform</Label><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="other">Other</option></select></div>
            </div>
            <div className="space-y-1.5"><Label>Video title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Before you apply for any qualification..." /></div>
            <div className="space-y-1.5"><Label>Exact video URL</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://www.tiktok.com/@username/video/123..." /><p className="text-xs text-muted-foreground">For TikTok, paste the exact `/video/ID` URL. The public page turns it into a native embedded preview automatically.</p></div>
            <div className="space-y-1.5"><Label>Transcript / summary</Label><Textarea rows={4} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="Short transcript or video summary" /></div>
            <div className="space-y-1.5"><Label>Transcript points</Label><Textarea rows={6} value={form.transcript_points} onChange={(e) => setForm({ ...form, transcript_points: e.target.value })} placeholder="One point per line" /></div>
            <div className="space-y-1.5"><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="TVET guidance, Application dates, Career research" /></div>
            <Button className="w-full" disabled={saving}>{saving ? "Saving..." : "Publish video"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" /> Published library</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {videos.map((video) => (
            <div key={video.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{video.provider_slug}</Badge><Badge variant={video.is_published ? "default" : "secondary"}>{video.is_published ? "Published" : "Hidden"}</Badge>{video.is_featured && <Badge className="gap-1"><Star className="h-3 w-3 fill-current" /> Featured</Badge>}</div>
                  <h3 className="mt-2 font-bold">{video.title}</h3>
                  {video.video_url ? <a href={video.video_url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open original <ExternalLink className="h-3 w-3" /></a> : <p className="mt-1 text-xs text-amber-600">Exact video URL not set yet — portrait fallback is shown publicly.</p>}
                  {video.transcript && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{video.transcript}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!video.is_featured && <Button size="sm" variant="outline" onClick={() => featureVideo(video)}><Star className="mr-1 h-4 w-4" /> Feature</Button>}
                  <Button size="sm" variant="outline" onClick={() => togglePublished(video)}>{video.is_published ? "Hide" : "Publish"}</Button>
                  <Button size="icon" variant="outline" onClick={() => remove(video)} aria-label="Delete video"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          {!loading && videos.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No videos yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCareerEducationContent;
