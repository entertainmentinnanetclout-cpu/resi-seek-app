import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Plus, Pencil, Trash2, Eye, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppTemplate {
  id: string;
  template_key: string;
  template_name: string;
  template_text: string;
  is_active: boolean;
  created_at: string;
}

export const AdminWhatsAppTemplatesContent = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [formData, setFormData] = useState({
    template_key: "",
    template_name: "",
    template_text: "",
    is_active: true,
  });

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("template_name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();

    const channel = supabase
      .channel("whatsapp-templates-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_templates" }, fetchTemplates)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_key: template.template_key,
      template_name: template.template_name,
      template_text: template.template_text,
      is_active: template.is_active,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setFormData({
      template_key: "",
      template_name: "",
      template_text: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.template_key || !formData.template_name || !formData.template_text) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({
            template_name: formData.template_name,
            template_text: formData.template_text,
            is_active: formData.is_active,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template updated");
      } else {
        const { error } = await supabase
          .from("whatsapp_templates")
          .insert([formData]);

        if (error) throw error;
        toast.success("Template created");
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template deleted");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Template ${!currentState ? "activated" : "deactivated"}`);
      fetchTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
    }
  };

  return (
    <>
      <SEO title="WhatsApp Templates | Admin" description="Manage WhatsApp message templates" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-green-600" />
              WhatsApp Templates
            </h1>
            <p className="text-muted-foreground">Manage message templates for student communication</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>

        {/* Placeholders Info */}
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-500">Available Placeholders</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use these in your templates: <code className="bg-muted px-1 rounded">{"{name}"}</code> (student name), 
                  <code className="bg-muted px-1 rounded ml-1">{"{residence}"}</code> (residence name), 
                  <code className="bg-muted px-1 rounded ml-1">{"{residence_text}"}</code> (for residence with text)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Click to edit or toggle active status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No templates found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.template_name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{template.template_key}</code>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">{template.template_text}</p>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={() => toggleActive(template.id, template.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(template.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Add New Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update the template details" : "Create a new WhatsApp message template"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Template Key *</Label>
              <Input
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="e.g., follow_up, call_alert"
                disabled={!!editingTemplate}
              />
              <p className="text-xs text-muted-foreground mt-1">Unique identifier (cannot be changed later)</p>
            </div>

            <div>
              <Label>Template Name *</Label>
              <Input
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., Application Follow-Up"
              />
            </div>

            <div>
              <Label>Message Text *</Label>
              <Textarea
                value={formData.template_text}
                onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
                rows={5}
                placeholder="Hi {name}, this is ResKonnect following up on your application..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminWhatsAppTemplates = () => (
  <AdminLayout><AdminWhatsAppTemplatesContent /></AdminLayout>
);

export default AdminWhatsAppTemplates;
