import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, Edit3, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Announcement = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  badge: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  graphic_variant: string | null;
  is_active: boolean;
  dismissible: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

type Draft = Omit<Announcement, "id" | "created_at" | "updated_at">;
const emptyDraft: Draft = {
  title: "",
  subtitle: "",
  body: "",
  badge: "RESKONNECT UPDATE",
  cta_label: "Explore now",
  cta_url: "/find",
  image_url: "",
  graphic_variant: "reskonnect",
  is_active: true,
  dismissible: true,
  priority: 100,
  starts_at: null,
  ends_at: null,
};

const toLocalInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const toIso = (value: string) => value ? new Date(value).toISOString() : null;

export default function AdminSiteAnnouncementsManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const db = supabase as any;
  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("site_announcements").select("*").order("priority", { ascending: false }).order("updated_at", { ascending: false });
    if (error) toast.error(error.message || "Could not load site updates");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createNew = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft });
    setOpen(true);
  };

  const edit = (item: Announcement) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      subtitle: item.subtitle || "",
      body: item.body,
      badge: item.badge || "",
      cta_label: item.cta_label || "",
      cta_url: item.cta_url || "",
      image_url: item.image_url || "",
      graphic_variant: item.graphic_variant || "reskonnect",
      is_active: item.is_active,
      dismissible: item.dismissible,
      priority: item.priority,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const payload = {
      ...draft,
      subtitle: draft.subtitle?.trim() || null,
      badge: draft.badge?.trim() || null,
      cta_label: draft.cta_label?.trim() || null,
      cta_url: draft.cta_url?.trim() || null,
      image_url: draft.image_url?.trim() || null,
      priority: Number(draft.priority) || 0,
      updated_by: auth.user?.id || null,
      ...(editingId ? {} : { created_by: auth.user?.id || null }),
    };
    const result = editingId
      ? await db.from("site_announcements").update(payload).eq("id", editingId)
      : await db.from("site_announcements").insert(payload);
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message || "Could not save site update");
      return;
    }
    toast.success(editingId ? "Site update saved" : "Site update created");
    setOpen(false);
    await load();
  };

  const toggle = async (item: Announcement) => {
    const { error } = await db.from("site_announcements").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) return toast.error(error.message || "Could not change update status");
    toast.success(!item.is_active ? "Update enabled" : "Update disabled");
    await load();
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    const { error } = await db.from("site_announcements").delete().eq("id", item.id);
    if (error) return toast.error(error.message || "Could not delete update");
    toast.success("Site update deleted");
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" /><h2 className="text-2xl font-bold">Site Updates & Landing Popup</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Create, edit, schedule, enable or disable the branded centre-screen update shown to visitors.</p>
        </div>
        <Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />New update</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total updates</p><p className="mt-1 text-2xl font-black">{items.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Enabled</p><p className="mt-1 text-2xl font-black text-primary">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Display rule</p><p className="mt-1 text-sm font-bold">Highest priority first</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Managed updates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading updates…</div> : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center"><BellRing className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 font-semibold">No updates configured</p><p className="text-sm text-muted-foreground">Create the first landing-page announcement.</p></div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Enabled" : "Disabled"}</Badge>
                    {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                    <span className="text-xs text-muted-foreground">Priority {item.priority}</span>
                  </div>
                  <h3 className="mt-2 font-bold">{item.title}</h3>
                  {item.subtitle && <p className="text-sm font-medium text-primary">{item.subtitle}</p>}
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Start: {item.starts_at ? new Date(item.starts_at).toLocaleString() : "Immediately"}</span>
                    <span>End: {item.ends_at ? new Date(item.ends_at).toLocaleString() : "No expiry"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(item)}>{item.is_active ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}{item.is_active ? "Disable" : "Enable"}</Button>
                  <Button size="sm" variant="outline" onClick={() => edit(item)}><Edit3 className="mr-2 h-4 w-4" />Edit</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(item)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit site update" : "Create site update"}</DialogTitle><DialogDescription>The popup uses ResKonnect branding automatically. Add an optional campaign image only when you have an approved graphic.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Headline *</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="2027 accommodation reservations are now open" /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={draft.subtitle || ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></div>
            <div className="space-y-2"><Label>Message *</Label><Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Badge</Label><Input value={draft.badge || ""} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="2027 RESERVATIONS OPEN" /></div>
              <div className="space-y-2"><Label>Priority</Label><Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>CTA label</Label><Input value={draft.cta_label || ""} onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })} /></div>
              <div className="space-y-2"><Label>CTA link</Label><Input value={draft.cta_url || ""} onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })} placeholder="/find?reserve=2027" /></div>
            </div>
            <div className="space-y-2"><Label>Optional campaign image URL</Label><Input value={draft.image_url || ""} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="Leave blank to use the premium ResKonnect graphic" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(e) => setDraft({ ...draft, starts_at: toIso(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Ends</Label><Input type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(e) => setDraft({ ...draft, ends_at: toIso(e.target.value) })} /></div>
            </div>
            <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3"><div><Label>Enabled</Label><p className="text-xs text-muted-foreground">Visible when its schedule is active.</p></div><Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} /></div>
              <div className="flex items-center justify-between gap-3"><div><Label>Dismissible</Label><p className="text-xs text-muted-foreground">Allow visitors to close it.</p></div><Switch checked={draft.dismissible} onCheckedChange={(v) => setDraft({ ...draft, dismissible: v })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save update"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
