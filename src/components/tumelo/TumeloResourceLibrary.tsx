import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const PARTNER = "tumelo-career-education";
const BUCKET = "partnership-resources";
const MAX_SIZE = 20 * 1024 * 1024;

type Resource = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  file_name: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  is_public: boolean;
  created_at: string;
};

const bytes = (value?: number | null) => {
  const n = Number(value || 0);
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export default function TumeloResourceLibrary({ manage = false }: { manage?: boolean }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("guide");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("partnership_resources").select("*").eq("partner_slug", PARTNER).order("display_order").order("created_at", { ascending: false });
    if (!manage) query = query.eq("is_public", true);
    const { data, error } = await query;
    setLoading(false);
    if (error) { console.error(error); return; }
    setResources(data || []);
  }, [manage]);

  useEffect(() => { void load(); }, [load]);

  const urlFor = (resource: Resource) => supabase.storage.from(BUCKET).getPublicUrl(resource.storage_path).data.publicUrl;

  const upload = async () => {
    if (!manage) return;
    if (!file || !title.trim()) return toast.error("Add a resource title and choose a file.");
    if (file.size > MAX_SIZE) return toast.error("Resource files are limited to 20 MB.");
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to upload resources.");
      const extension = file.name.includes(".") ? file.name.split(".").pop() : "file";
      const path = `${PARTNER}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const storage = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (storage.error) throw storage.error;
      const inserted = await (supabase as any).from("partnership_resources").insert({
        partner_slug: PARTNER,
        title: title.trim(),
        description: description.trim() || null,
        category,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        is_public: true,
        created_by: user.id,
        published_at: new Date().toISOString(),
      });
      if (inserted.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw inserted.error;
      }
      setTitle(""); setDescription(""); setFile(null);
      const input = document.getElementById("tumelo-resource-file") as HTMLInputElement | null;
      if (input) input.value = "";
      toast.success("Resource published to the Tumelo section");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not publish resource");
    } finally { setUploading(false); }
  };

  const remove = async (resource: Resource) => {
    if (!manage || !window.confirm(`Remove “${resource.title}” from the public resource library?`)) return;
    const db = await (supabase as any).from("partnership_resources").delete().eq("id", resource.id);
    if (db.error) return toast.error(db.error.message);
    await supabase.storage.from(BUCKET).remove([resource.storage_path]);
    toast.success("Resource removed");
    await load();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2"><Badge className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]">TUMELO × RESKONNECT</Badge><Badge variant="outline">Resource Library</Badge></div><h2 className="mt-3 text-2xl font-black">Career & Education Downloads</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Guides, checklists and educational resources published through the Tumelo partnership workspace.</p></div>
      </div>

      {manage && <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border"><div className="bg-[#071326] px-5 py-4 text-white"><p className="font-black">Publish a new resource</p><p className="mt-1 text-xs text-white/65">Files published here become downloadable from Tumelo's public Career & Education section. Do not upload private student documents.</p></div><CardContent className="grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-1.5"><Label>Resource title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2027 University Application Checklist" /></div>
        <div className="space-y-1.5"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guide">Guide</SelectItem><SelectItem value="checklist">Checklist</SelectItem><SelectItem value="template">Template</SelectItem><SelectItem value="application">Application resource</SelectItem><SelectItem value="career">Career resource</SelectItem><SelectItem value="resource">Other resource</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain what this document helps a learner do." /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Document</Label><Input id="tumelo-resource-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} /><p className="text-xs text-muted-foreground">PDF, Office documents, images or text · maximum 20 MB</p></div>
        <div className="md:col-span-2"><Button onClick={() => void upload()} disabled={uploading || !file || !title.trim()} className="gap-2">{uploading ? <Loader2 className="animate-spin" /> : <Upload />}Publish resource</Button></div>
      </CardContent></Card>}

      {loading ? <div className="rounded-2xl border p-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div> : resources.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-black">No resources published yet</p><p className="mt-1 text-sm text-muted-foreground">New Tumelo guidance resources will appear here.</p></div> : <div className="grid gap-3 md:grid-cols-2">{resources.map((resource) => <Card key={resource.id} className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start gap-4"><div className="rounded-xl bg-[#071326] p-3 text-[#F5B32F]"><FileText className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{resource.category}</Badge>{resource.size_bytes ? <span className="text-[11px] text-muted-foreground">{bytes(resource.size_bytes)}</span> : null}</div><h3 className="mt-2 font-black leading-5">{resource.title}</h3>{resource.description && <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted-foreground">{resource.description}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm" className="gap-2"><a href={urlFor(resource)} target="_blank" rel="noreferrer" download={resource.file_name}><Download />Download</a></Button>{manage && <Button size="sm" variant="outline" onClick={() => void remove(resource)} className="gap-2 text-destructive hover:text-destructive"><Trash2 />Remove</Button>}</div></div></div></CardContent></Card>)}</div>}
    </section>
  );
}
