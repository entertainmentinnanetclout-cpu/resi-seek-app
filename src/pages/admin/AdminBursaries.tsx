import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Bursary {
  id: string;
  name: string;
  provider: string;
  amount: string | null;
  deadline: string | null;
  fields_of_study: string[] | null;
  requirements: string[] | null;
  link: string | null;
  type: string;
  description: string | null;
  is_active: boolean;
}

const emptyBursary: Partial<Bursary> = {
  name: "",
  provider: "",
  amount: "",
  deadline: "",
  fields_of_study: [],
  requirements: [],
  link: "",
  type: "general",
  description: "",
  is_active: true,
};

export const AdminBursariesContent = () => {
  const [bursaries, setBursaries] = useState<Bursary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBursary, setEditingBursary] = useState<Partial<Bursary> | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldsInput, setFieldsInput] = useState("");
  const [requirementsInput, setRequirementsInput] = useState("");

  const fetchBursaries = async () => {
    try {
      const { data, error } = await supabase
        .from("bursaries")
        .select("*")
        .order("deadline", { ascending: true });

      if (error) throw error;
      setBursaries(data || []);
    } catch (error) {
      console.error("Error fetching bursaries:", error);
      toast.error("Failed to load bursaries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBursaries();
  }, []);

  const handleSave = async () => {
    if (!editingBursary?.name || !editingBursary?.provider) {
      toast.error("Name and provider are required");
      return;
    }

    setSaving(true);
    try {
      const bursaryData = {
        name: editingBursary.name,
        provider: editingBursary.provider,
        amount: editingBursary.amount || null,
        deadline: editingBursary.deadline || null,
        fields_of_study: fieldsInput.split(",").map((s) => s.trim()).filter(Boolean),
        requirements: requirementsInput.split(",").map((s) => s.trim()).filter(Boolean),
        link: editingBursary.link || null,
        type: editingBursary.type || "general",
        description: editingBursary.description || null,
        is_active: editingBursary.is_active ?? true,
      };

      if (editingBursary.id) {
        const { error } = await supabase.from("bursaries").update(bursaryData).eq("id", editingBursary.id);
        if (error) throw error;
        toast.success("Bursary updated");
      } else {
        const { error } = await supabase.from("bursaries").insert([bursaryData]);
        if (error) throw error;
        toast.success("Bursary created");
      }

      setIsDialogOpen(false);
      setEditingBursary(null);
      setFieldsInput("");
      setRequirementsInput("");
      fetchBursaries();
    } catch (error: any) {
      toast.error(error.message || "Failed to save bursary");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bursary?")) return;
    try {
      const { error } = await supabase.from("bursaries").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bursary deleted");
      fetchBursaries();
    } catch (error) {
      toast.error("Failed to delete bursary");
    }
  };

  const openEditDialog = (bursary: Bursary) => {
    setEditingBursary(bursary);
    setFieldsInput(bursary.fields_of_study?.join(", ") || "");
    setRequirementsInput(bursary.requirements?.join(", ") || "");
    setIsDialogOpen(true);
  };

  const filteredBursaries = bursaries.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <SEO title="Manage Bursaries | Admin" description="Manage bursary listings" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bursaries</h1>
            <p className="text-muted-foreground">Manage bursary and funding opportunities</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingBursary(emptyBursary);
                  setFieldsInput("");
                  setRequirementsInput("");
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Bursary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBursary?.id ? "Edit Bursary" : "Add New Bursary"}</DialogTitle>
                <DialogDescription>Enter bursary details below.</DialogDescription>
              </DialogHeader>

              {editingBursary && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editingBursary.name || ""}
                        onChange={(e) => setEditingBursary({ ...editingBursary, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider *</Label>
                      <Input
                        value={editingBursary.provider || ""}
                        onChange={(e) => setEditingBursary({ ...editingBursary, provider: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={editingBursary.amount || ""}
                        onChange={(e) => setEditingBursary({ ...editingBursary, amount: e.target.value })}
                        placeholder="Full tuition"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Deadline</Label>
                      <Input
                        type="date"
                        value={editingBursary.deadline || ""}
                        onChange={(e) => setEditingBursary({ ...editingBursary, deadline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={editingBursary.type || "general"}
                      onValueChange={(value) => setEditingBursary({ ...editingBursary, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="nsfas">NSFAS</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fields of Study (comma-separated)</Label>
                    <Input
                      value={fieldsInput}
                      onChange={(e) => setFieldsInput(e.target.value)}
                      placeholder="Engineering, Science, Commerce"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Requirements (comma-separated)</Label>
                    <Input
                      value={requirementsInput}
                      onChange={(e) => setRequirementsInput(e.target.value)}
                      placeholder="South African citizen, Household income below R350k"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Application Link</Label>
                    <Input
                      value={editingBursary.link || ""}
                      onChange={(e) => setEditingBursary({ ...editingBursary, link: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingBursary.description || ""}
                      onChange={(e) => setEditingBursary({ ...editingBursary, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={editingBursary.is_active ?? true}
                      onCheckedChange={(checked) => setEditingBursary({ ...editingBursary, is_active: checked })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Bursary"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bursaries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredBursaries.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No bursaries found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBursaries.map((bursary) => (
                      <TableRow key={bursary.id}>
                        <TableCell className="font-medium">{bursary.name}</TableCell>
                        <TableCell>{bursary.provider}</TableCell>
                        <TableCell>
                          {bursary.deadline ? format(new Date(bursary.deadline), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{bursary.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={bursary.is_active ? "default" : "outline"}>
                            {bursary.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(bursary)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(bursary.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
    </>
  );
};

const AdminBursaries = () => (
  <AdminLayout><AdminBursariesContent /></AdminLayout>
);

export default AdminBursaries;
