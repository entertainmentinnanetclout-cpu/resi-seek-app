import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Upload, Grid3X3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TrustedResidencesEditor from "@/components/admin/TrustedResidencesEditor";

interface Residence {
  id: string;
  name: string;
  address: string;
  price: number;
  capacity: number;
  available_spots: number;
  campus: string | null;
  province: string | null;
  room_type: string | null;
  verification_level: string | null;
  featured: boolean | null;
  image_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  amenities: string[] | null;
}

const emptyResidence: Partial<Residence> = {
  name: "",
  address: "",
  price: 0,
  capacity: 1,
  available_spots: 0,
  campus: "",
  province: "Gauteng",
  room_type: "single",
  verification_level: "basic",
  featured: false,
  description: "",
  contact_email: "",
  contact_phone: "",
  amenities: [],
};

const AdminResidences = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResidence, setEditingResidence] = useState<Partial<Residence> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchResidences = async () => {
    try {
      const { data, error } = await supabase
        .from("residences")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResidences(data || []);
    } catch (error) {
      console.error("Error fetching residences:", error);
      toast.error("Failed to load residences");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidences();
  }, []);

  const handleSave = async () => {
    if (!editingResidence?.name || !editingResidence?.address) {
      toast.error("Name and address are required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingResidence.image_url;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `residence-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("admin-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from("admin-images")
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      }

      const residenceData = {
        name: editingResidence.name!,
        address: editingResidence.address!,
        image_url: imageUrl,
        price: Number(editingResidence.price) || 0,
        capacity: Number(editingResidence.capacity) || 1,
        available_spots: Number(editingResidence.available_spots) || 0,
        campus: editingResidence.campus || null,
        province: editingResidence.province || null,
        room_type: editingResidence.room_type || null,
        verification_level: editingResidence.verification_level || null,
        featured: editingResidence.featured || false,
        description: editingResidence.description || null,
        contact_email: editingResidence.contact_email || null,
        contact_phone: editingResidence.contact_phone || null,
      };

      if (editingResidence.id) {
        // Update existing
        const { error } = await supabase
          .from("residences")
          .update(residenceData)
          .eq("id", editingResidence.id);

        if (error) throw error;
        toast.success("Residence updated successfully");
      } else {
        // Create new
        const { error } = await supabase
          .from("residences")
          .insert([residenceData]);

        if (error) throw error;
        toast.success("Residence created successfully");
      }

      setIsDialogOpen(false);
      setEditingResidence(null);
      setImageFile(null);
      fetchResidences();
    } catch (error: any) {
      console.error("Error saving residence:", error);
      toast.error(error.message || "Failed to save residence");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this residence?")) return;

    try {
      const { error } = await supabase
        .from("residences")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Residence deleted");
      fetchResidences();
    } catch (error) {
      console.error("Error deleting residence:", error);
      toast.error("Failed to delete residence");
    }
  };

  const filteredResidences = residences.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <SEO title="Manage Residences | Admin" description="Manage residence listings" />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Residences</h1>
          <p className="text-muted-foreground">Manage all residence listings</p>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Residences</TabsTrigger>
            <TabsTrigger value="trusted" className="gap-2">
              <Grid3X3 className="w-4 h-4" />
              Trusted Grid
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingResidence(emptyResidence)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Residence
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingResidence?.id ? "Edit Residence" : "Add New Residence"}</DialogTitle>
                <DialogDescription>Fill in the residence details below.</DialogDescription>
              </DialogHeader>
              
              {editingResidence && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editingResidence.name || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, name: e.target.value })}
                        placeholder="Residence name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (R/month) *</Label>
                      <Input
                        type="number"
                        value={editingResidence.price || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, price: Number(e.target.value) })}
                        placeholder="3500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address *</Label>
                    <Input
                      value={editingResidence.address || ""}
                      onChange={(e) => setEditingResidence({ ...editingResidence, address: e.target.value })}
                      placeholder="Full address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campus</Label>
                      <Input
                        value={editingResidence.campus || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, campus: e.target.value })}
                        placeholder="TUT Pretoria"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Province</Label>
                      <Select
                        value={editingResidence.province || "Gauteng"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, province: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gauteng">Gauteng</SelectItem>
                          <SelectItem value="Western Cape">Western Cape</SelectItem>
                          <SelectItem value="KwaZulu-Natal">KwaZulu-Natal</SelectItem>
                          <SelectItem value="Eastern Cape">Eastern Cape</SelectItem>
                          <SelectItem value="Free State">Free State</SelectItem>
                          <SelectItem value="Limpopo">Limpopo</SelectItem>
                          <SelectItem value="Mpumalanga">Mpumalanga</SelectItem>
                          <SelectItem value="North West">North West</SelectItem>
                          <SelectItem value="Northern Cape">Northern Cape</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Input
                        type="number"
                        value={editingResidence.capacity || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, capacity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Available Spots</Label>
                      <Input
                        type="number"
                        value={editingResidence.available_spots || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, available_spots: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Room Type</Label>
                      <Select
                        value={editingResidence.room_type || "single"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, room_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="sharing">Sharing</SelectItem>
                          <SelectItem value="bachelor">Bachelor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Verification Level</Label>
                      <Select
                        value={editingResidence.verification_level || "basic"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, verification_level: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="trusted_partner">Trusted Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Featured</Label>
                      <Select
                        value={editingResidence.featured ? "yes" : "no"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, featured: value === "yes" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingResidence.description || ""}
                      onChange={(e) => setEditingResidence({ ...editingResidence, description: e.target.value })}
                      placeholder="Describe the residence..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={editingResidence.contact_email || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, contact_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={editingResidence.contact_phone || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Image</Label>
                    <div className="flex items-center gap-4">
                      {editingResidence.image_url && (
                        <img src={editingResidence.image_url} alt="Preview" className="w-20 h-20 object-cover rounded" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Residence"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search residences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredResidences.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No residences found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResidences.map((residence) => (
                      <TableRow key={residence.id}>
                        <TableCell className="font-medium">{residence.name}</TableCell>
                        <TableCell>{residence.campus || "-"}</TableCell>
                        <TableCell>R{residence.price.toLocaleString()}</TableCell>
                        <TableCell>{residence.available_spots}/{residence.capacity}</TableCell>
                        <TableCell>
                          <Badge variant={residence.verification_level === "verified" || residence.verification_level === "premium" ? "default" : "secondary"}>
                            {residence.verification_level || "basic"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingResidence(residence);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(residence.id)}
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
          </TabsContent>

          <TabsContent value="trusted">
            <TrustedResidencesEditor />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminResidences;
