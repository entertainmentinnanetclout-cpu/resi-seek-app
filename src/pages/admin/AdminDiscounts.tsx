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

interface StudentDiscount {
  id: string;
  name: string;
  provider: string;
  discount: string;
  category: string;
  description: string | null;
  how_to_claim: string | null;
  link: string | null;
  valid_until: string | null;
  is_verified: boolean;
  is_active: boolean;
}

const emptyDiscount: Partial<StudentDiscount> = {
  name: "",
  provider: "",
  discount: "",
  category: "Food",
  description: "",
  how_to_claim: "",
  link: "",
  valid_until: "",
  is_verified: false,
  is_active: true,
};

const categories = ["Food", "Transport", "Entertainment", "Tech", "Health", "Shopping", "Education", "Fitness"];

const AdminDiscounts = () => {
  const [discounts, setDiscounts] = useState<StudentDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Partial<StudentDiscount> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from("student_discounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      toast.error("Failed to load discounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
    
    // Realtime subscription for live updates
    const channel = supabase
      .channel('admin-discounts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_discounts' }, () => {
        fetchDiscounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSave = async () => {
    if (!editingDiscount?.name || !editingDiscount?.provider || !editingDiscount?.discount) {
      toast.error("Name, provider, and discount are required");
      return;
    }

    setSaving(true);
    try {
      const discountData = {
        name: editingDiscount.name,
        provider: editingDiscount.provider,
        discount: editingDiscount.discount,
        category: editingDiscount.category || "Food",
        description: editingDiscount.description || null,
        how_to_claim: editingDiscount.how_to_claim || null,
        link: editingDiscount.link || null,
        valid_until: editingDiscount.valid_until || null,
        is_verified: editingDiscount.is_verified ?? false,
        is_active: editingDiscount.is_active ?? true,
      };

      if (editingDiscount.id) {
        const { error } = await supabase.from("student_discounts").update(discountData).eq("id", editingDiscount.id);
        if (error) throw error;
        toast.success("Discount updated");
      } else {
        const { error } = await supabase.from("student_discounts").insert([discountData]);
        if (error) throw error;
        toast.success("Discount created");
      }

      setIsDialogOpen(false);
      setEditingDiscount(null);
      fetchDiscounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to save discount");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this discount?")) return;
    try {
      const { error } = await supabase.from("student_discounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Discount deleted");
      fetchDiscounts();
    } catch (error) {
      toast.error("Failed to delete discount");
    }
  };

  const filteredDiscounts = discounts.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <SEO title="Manage Discounts | Admin" description="Manage student discount listings" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Student Discounts</h1>
            <p className="text-muted-foreground">Manage student discount partners</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingDiscount(emptyDiscount)}>
                <Plus className="w-4 h-4 mr-2" /> Add Discount
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingDiscount?.id ? "Edit Discount" : "Add New Discount"}</DialogTitle>
                <DialogDescription>Enter discount details below.</DialogDescription>
              </DialogHeader>

              {editingDiscount && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editingDiscount.name || ""}
                        onChange={(e) => setEditingDiscount({ ...editingDiscount, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider *</Label>
                      <Input
                        value={editingDiscount.provider || ""}
                        onChange={(e) => setEditingDiscount({ ...editingDiscount, provider: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount *</Label>
                      <Input
                        value={editingDiscount.discount || ""}
                        onChange={(e) => setEditingDiscount({ ...editingDiscount, discount: e.target.value })}
                        placeholder="15% off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editingDiscount.category || "Food"}
                        onValueChange={(value) => setEditingDiscount({ ...editingDiscount, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingDiscount.description || ""}
                      onChange={(e) => setEditingDiscount({ ...editingDiscount, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>How to Claim</Label>
                    <Textarea
                      value={editingDiscount.how_to_claim || ""}
                      onChange={(e) => setEditingDiscount({ ...editingDiscount, how_to_claim: e.target.value })}
                      rows={2}
                      placeholder="Show student card at checkout"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Link</Label>
                      <Input
                        value={editingDiscount.link || ""}
                        onChange={(e) => setEditingDiscount({ ...editingDiscount, link: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valid Until</Label>
                      <Input
                        type="date"
                        value={editingDiscount.valid_until || ""}
                        onChange={(e) => setEditingDiscount({ ...editingDiscount, valid_until: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Verified Partner</Label>
                    <Switch
                      checked={editingDiscount.is_verified ?? false}
                      onCheckedChange={(checked) => setEditingDiscount({ ...editingDiscount, is_verified: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={editingDiscount.is_active ?? true}
                      onCheckedChange={(checked) => setEditingDiscount({ ...editingDiscount, is_active: checked })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Discount"}
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
                placeholder="Search discounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredDiscounts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No discounts found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDiscounts.map((discount) => (
                      <TableRow key={discount.id}>
                        <TableCell className="font-medium">{discount.name}</TableCell>
                        <TableCell>{discount.provider}</TableCell>
                        <TableCell>{discount.discount}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{discount.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {discount.is_verified && <Badge>Verified</Badge>}
                            <Badge variant={discount.is_active ? "default" : "outline"}>
                              {discount.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingDiscount(discount);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(discount.id)}
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
    </AdminLayout>
  );
};

export default AdminDiscounts;
