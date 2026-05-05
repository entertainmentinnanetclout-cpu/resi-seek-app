import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Truck, Save, X } from "lucide-react";

export const AdminDeliveryZonesContent = () => {
  const [zones, setZones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseFee, setBaseFee] = useState("");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("delivery_zones" as any)
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching delivery zones:", error);
      toast.error("Failed to load delivery zones");
    } else {
      setZones(data || []);
    }
    setIsLoading(false);
  };

  const openAddDialog = () => {
    setEditingZone(null);
    setName("");
    setDescription("");
    setBaseFee("");
    setFreeThreshold("");
    setDisplayOrder((zones.length * 10).toString());
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (zone: any) => {
    setEditingZone(zone);
    setName(zone.name);
    setDescription(zone.description || "");
    setBaseFee(zone.base_fee.toString());
    setFreeThreshold(zone.free_threshold?.toString() || "");
    setDisplayOrder(zone.display_order.toString());
    setIsActive(zone.is_active);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    const zoneData = {
      name,
      description,
      base_fee: parseFloat(baseFee) || 0,
      free_threshold: freeThreshold ? parseFloat(freeThreshold) : null,
      display_order: parseInt(displayOrder) || 0,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingZone) {
        const { error } = await supabase
          .from("delivery_zones" as any)
          .update(zoneData)
          .eq("id", editingZone.id);
        if (error) throw error;
        toast.success("Delivery zone updated");
      } else {
        const { error } = await supabase
          .from("delivery_zones" as any)
          .insert(zoneData);
        if (error) throw error;
        toast.success("Delivery zone created");
      }
      setIsDialogOpen(false);
      fetchZones();
    } catch (error: any) {
      toast.error(error.message || "Failed to save delivery zone");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery zone?")) return;

    try {
      const { error } = await supabase
        .from("delivery_zones" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Delivery zone deleted");
      fetchZones();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete delivery zone");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Truck className="w-5 h-5" /> Delivery Zones
        </h2>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" /> Add Zone
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Base Fee</TableHead>
                <TableHead>Free Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No delivery zones configured
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="text-sm">{zone.display_order}</TableCell>
                    <TableCell>
                      <div className="font-medium">{zone.name}</div>
                      {zone.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{zone.description}</div>}
                    </TableCell>
                    <TableCell>R{Number(zone.base_fee).toFixed(2)}</TableCell>
                    <TableCell>{zone.free_threshold ? `R${Number(zone.free_threshold).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${zone.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {zone.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(zone)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(zone.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit Delivery Zone" : "Add Delivery Zone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Zone Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pretoria Main Campus" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Delivery details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseFee">Base Fee (R)</Label>
                <Input id="baseFee" type="number" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freeThreshold">Free Threshold (R)</Label>
                <Input id="freeThreshold" type="number" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} placeholder="e.g. 500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Zone</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
