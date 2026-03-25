import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Section {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  display_order: number;
  color: string;
  is_active: boolean;
  applies_to: string;
}

const COLOR_OPTIONS = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-emerald-500", label: "Emerald" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-amber-500", label: "Amber" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-cyan-500", label: "Cyan" },
  { value: "bg-lime-500", label: "Lime" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-gray-500", label: "Grey" },
];

const emptySection: Partial<Section> = {
  name: "",
  slug: "",
  subtitle: "",
  display_order: 0,
  color: "bg-blue-500",
  is_active: true,
  applies_to: "both",
};

const SectionsManager = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Section> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from("residence_sections")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast.error("Failed to load sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleSave = async () => {
    if (!editing?.name || !editing?.slug) {
      toast.error("Name and slug are required");
      return;
    }

    setSaving(true);
    try {
      const sectionData = {
        name: editing.name,
        slug: editing.slug.toUpperCase(),
        subtitle: editing.subtitle || null,
        display_order: editing.display_order || 0,
        color: editing.color || "bg-blue-500",
        is_active: editing.is_active ?? true,
        applies_to: editing.applies_to || "both",
      };

      if (editing.id) {
        const { error } = await supabase
          .from("residence_sections")
          .update(sectionData)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Section updated");
      } else {
        const { error } = await supabase
          .from("residence_sections")
          .insert([sectionData]);
        if (error) throw error;
        toast.success("Section created");
      }

      setIsDialogOpen(false);
      setEditing(null);
      fetchSections();
    } catch (error: any) {
      toast.error(error.message || "Failed to save section");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this section? Residences assigned to it will become uncategorised.")) return;
    try {
      const { error } = await supabase.from("residence_sections").delete().eq("id", id);
      if (error) throw error;
      toast.success("Section deleted");
      fetchSections();
    } catch (error) {
      toast.error("Failed to delete section");
    }
  };

  const handleToggleActive = async (section: Section) => {
    try {
      const { error } = await supabase
        .from("residence_sections")
        .update({ is_active: !section.is_active })
        .eq("id", section.id);
      if (error) throw error;
      fetchSections();
    } catch (error) {
      toast.error("Failed to update section");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Residence Sections</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptySection)}>
              <Plus className="w-4 h-4 mr-2" /> Add Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit Section" : "Add Section"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={editing.name || ""}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Private Accommodations"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input
                      value={editing.slug || ""}
                      onChange={(e) => setEditing({ ...editing, slug: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      placeholder="e.g. PRIVATE"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    value={editing.subtitle || ""}
                    onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                    placeholder="e.g. Premium private residences"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={editing.display_order || 0}
                      onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colour</Label>
                    <Select
                      value={editing.color || "bg-blue-500"}
                      onValueChange={(value) => setEditing({ ...editing, color: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${c.value}`} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Applies To</Label>
                    <Select
                      value={editing.applies_to || "both"}
                      onValueChange={(value) => setEditing({ ...editing, applies_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="trusted">Trusted Only</SelectItem>
                        <SelectItem value="findmyres">FindMyRes Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(checked) => setEditing({ ...editing, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : sections.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No sections configured yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Subtitle</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <TableRow key={section.id}>
                  <TableCell>{section.display_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${section.color}`} />
                      <span className="font-medium">{section.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{section.slug}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{section.subtitle || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{section.applies_to}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={section.is_active}
                      onCheckedChange={() => handleToggleActive(section)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(section);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(section.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Sections group residences in the Top 30 Trusted grid and FindMyRes page. Assign residences to sections using the "Section Category" field when editing a residence.
        </p>
      </CardContent>
    </Card>
  );
};

export default SectionsManager;
