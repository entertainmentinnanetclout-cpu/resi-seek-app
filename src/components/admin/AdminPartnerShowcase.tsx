import { FormEvent, useEffect, useState } from "react";
import { Edit3, ExternalLink, Handshake, Plus, RefreshCw, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageInput from "@/components/ImageInput";
import { supabase } from "@/integrations/supabase/client";

const client = supabase as any;

const RELATIONSHIP_TYPES = [
  ["partner", "Partner"],
  ["strategic_collaborator", "Strategic collaborator"],
  ["client", "Client"],
  ["institutional_ecosystem", "Institutional ecosystem"],
  ["regulatory_reference", "Regulatory / compliance reference"],
  ["technology_provider", "Technology provider"],
] as const;

type ShowcaseRow = {
  id: string;
  slug: string;
  name: string;
  relationship_type: string;
  short_label: string | null;
  description: string | null;
  logo_url: string;
  website_url: string | null;
  compliance_note: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
};

const emptyForm = {
  name: "",
  slug: "",
  relationship_type: "partner",
  short_label: "",
  description: "",
  logo_url: "",
  website_url: "",
  compliance_note: "",
  sort_order: 0,
  is_featured: true,
  is_published: true,
};

const toSlug = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const AdminPartnerShowcase = () => {
  const [items, setItems] = useState<ShowcaseRow[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await client
      .from("partner_showcase")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Could not load partner showcase.");
      return;
    }
    setItems((data || []) as ShowcaseRow[]);
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const edit = (item: ShowcaseRow) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      relationship_type: item.relationship_type,
      short_label: item.short_label || "",
      description: item.description || "",
      logo_url: item.logo_url,
      website_url: item.website_url || "",
      compliance_note: item.compliance_note || "",
      sort_order: item.sort_order || 0,
      is_featured: item.is_featured,
      is_published: item.is_published,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Add the organization or partner name.");
    if (!form.logo_url.trim()) return toast.error("Upload or add an approved logo first.");
    const slug = toSlug(form.slug || form.name);
    if (!slug) return toast.error("A valid slug is required.");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug,
      relationship_type: form.relationship_type,
      short_label: form.short_label.trim() || null,
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim(),
      website_url: form.website_url.trim() || null,
      compliance_note: form.compliance_note.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_featured: form.is_featured,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await client.from("partner_showcase").update(payload).eq("id", editingId)
      : await client.from("partner_showcase").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message || "Could not save partner showcase item.");
      return;
    }
    toast.success(editingId ? "Showcase identity updated." : "Showcase identity added.");
    reset();
    await load();
  };

  const togglePublished = async (item: ShowcaseRow) => {
    const { error } = await client
      .from("partner_showcase")
      .update({ is_published: !item.is_published, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error(error.message || "Could not update visibility.");
    await load();
  };

  const toggleFeatured = async (item: ShowcaseRow) => {
    const { error } = await client
      .from("partner_showcase")
      .update({ is_featured: !item.is_featured, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error(error.message || "Could not update featured status.");
    await load();
  };

  const remove = async (item: ShowcaseRow) => {
    if (!window.confirm(`Remove ${item.name} from the public showcase?`)) return;
    const { error } = await client.from("partner_showcase").delete().eq("id", item.id);
    if (error) return toast.error(error.message || "Could not delete showcase item.");
    toast.success("Showcase identity removed.");
    if (editingId === item.id) reset();
    await load();
  };

  return (
    <Card className="border-primary/15">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5" /> Partner & ecosystem logo showcase</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Manage the logo strip displayed directly below the Tumelo strategic collaboration preview.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-muted-foreground">
          Only publish a logo when ResKonnect has a documented basis to describe the organization using the selected relationship label. A logo must not be presented as proof of endorsement, accreditation or regulatory approval unless that statement is independently supported.
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-2">
            {editingId ? <Edit3 className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
            <h3 className="font-bold">{editingId ? "Edit showcase identity" : "Add partner / client / ecosystem identity"}</h3>
          </div>
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingId ? form.slug : toSlug(e.target.value) })} placeholder="Organization name" /></div>
          <div className="space-y-1.5"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: toSlug(e.target.value) })} placeholder="organization-name" /></div>
          <div className="space-y-1.5"><Label>Relationship label</Label><select value={form.relationship_type} onChange={(e) => setForm({ ...form, relationship_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{RELATIONSHIP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Custom short label</Label><Input value={form.short_label} onChange={(e) => setForm({ ...form, short_label: e.target.value })} placeholder="Optional public label" /></div>
          <div className="space-y-1.5 md:col-span-2"><ImageInput label="Approved logo" value={form.logo_url} onChange={(logo_url) => setForm({ ...form, logo_url })} bucket="admin-images" pathPrefix="partner-showcase" /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://..." /></div>
          <div className="space-y-1.5"><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Public context</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is the documented relationship or ecosystem context?" /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Compliance / relationship note</Label><Textarea rows={2} value={form.compliance_note} onChange={(e) => setForm({ ...form, compliance_note: e.target.value })} placeholder="Optional legal or relationship qualifier" /></div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
            </div>
            <div className="flex gap-2">
              {editingId && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
              <Button type="submit" disabled={saving}>{editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? "Saving..." : editingId ? "Save identity" : "Add to showcase"}</Button>
            </div>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-bold">Configured identities</h3><Badge variant="outline">{items.length} total</Badge></div>
          {loading ? (
            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Loading showcase…</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No partner showcase identities have been configured.</div>
          ) : items.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-black/5"><img src={item.logo_url} alt={`${item.name} logo`} className="max-h-10 max-w-full object-contain" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.name}</p>{item.is_featured && <Badge><Star className="mr-1 h-3 w-3 fill-current" />Featured</Badge>}<Badge variant={item.is_published ? "default" : "secondary"}>{item.is_published ? "Published" : "Hidden"}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.short_label || RELATIONSHIP_TYPES.find(([value]) => value === item.relationship_type)?.[1] || item.relationship_type}</p>
                  {item.website_url && <a href={item.website_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">Visit website <ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(item)}><Edit3 className="mr-1 h-4 w-4" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => toggleFeatured(item)}>{item.is_featured ? "Unfeature" : "Feature"}</Button>
                <Button size="sm" variant="outline" onClick={() => togglePublished(item)}>{item.is_published ? "Hide" : "Publish"}</Button>
                <Button size="icon" variant="outline" aria-label={`Delete ${item.name}`} onClick={() => remove(item)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPartnerShowcase;
