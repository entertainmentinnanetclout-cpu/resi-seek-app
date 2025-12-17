import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  category: string;
  campus: string | null;
  location: string | null;
  event_date: string;
  image_url: string | null;
  interested_count: number | null;
}

const emptyEvent: Partial<Event> = {
  title: "",
  description: "",
  category: "Social",
  campus: "",
  location: "",
  event_date: "",
  image_url: "",
};

const categories = ["Academic", "Social", "Career", "Sports", "Cultural", "Workshop", "Other"];

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSave = async () => {
    if (!editingEvent?.title || !editingEvent?.event_date) {
      toast.error("Title and event date are required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingEvent.image_url;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `event-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("admin-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("admin-images")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const eventData = {
        title: editingEvent.title,
        description: editingEvent.description || null,
        category: editingEvent.category || "Social",
        campus: editingEvent.campus || null,
        location: editingEvent.location || null,
        event_date: editingEvent.event_date,
        image_url: imageUrl || null,
      };

      if (editingEvent.id) {
        const { error } = await supabase.from("events").update(eventData).eq("id", editingEvent.id);
        if (error) throw error;
        toast.success("Event updated");
      } else {
        const { error } = await supabase.from("events").insert([eventData]);
        if (error) throw error;
        toast.success("Event created");
      }

      setIsDialogOpen(false);
      setEditingEvent(null);
      setImageFile(null);
      fetchEvents();
    } catch (error: any) {
      toast.error(error.message || "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Event deleted");
      fetchEvents();
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  const filteredEvents = events.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.campus?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <SEO title="Manage Events | Admin" description="Manage campus events" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Campus Events</h1>
            <p className="text-muted-foreground">Manage campus events and activities</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEvent(emptyEvent)}>
                <Plus className="w-4 h-4 mr-2" /> Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEvent?.id ? "Edit Event" : "Add New Event"}</DialogTitle>
                <DialogDescription>Enter event details below.</DialogDescription>
              </DialogHeader>

              {editingEvent && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={editingEvent.title || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Event Date *</Label>
                      <Input
                        type="datetime-local"
                        value={editingEvent.event_date || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editingEvent.category || "Social"}
                        onValueChange={(value) => setEditingEvent({ ...editingEvent, category: value })}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campus</Label>
                      <Input
                        value={editingEvent.campus || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, campus: e.target.value })}
                        placeholder="TUT Pretoria"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={editingEvent.location || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                        placeholder="Student Centre"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingEvent.description || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Image</Label>
                    <div className="space-y-2">
                      {editingEvent.image_url && (
                        <img src={editingEvent.image_url} alt="Preview" className="w-full h-32 object-cover rounded" />
                      )}
                      <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Event"}
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
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No events found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Interested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.title}</TableCell>
                        <TableCell>{format(new Date(event.event_date), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell>{event.campus || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{event.category}</Badge>
                        </TableCell>
                        <TableCell>{event.interested_count || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingEvent(event);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(event.id)}
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

export default AdminEvents;
