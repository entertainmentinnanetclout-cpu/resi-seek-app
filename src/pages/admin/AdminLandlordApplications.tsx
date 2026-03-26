import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, Building2, CheckCircle2, XCircle } from "lucide-react";

interface LandlordApp {
  id: string;
  application_type: string;
  status: string;
  property_name: string;
  address: string;
  nearest_campus: string | null;
  room_type: string | null;
  price: number | null;
  capacity: number | null;
  description: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  company_name: string | null;
  registration_number: string | null;
  nsfas_accredited: boolean;
  years_operating: number | null;
  total_properties: number | null;
  admin_notes: string | null;
  created_at: string;
  province: string;
  amenities: string[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const typeColors: Record<string, string> = {
  listing: "bg-primary/10 text-primary",
  accreditation: "bg-purple-100 text-purple-800",
  both: "bg-indigo-100 text-indigo-800",
};

export const AdminLandlordApplicationsContent = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<LandlordApp | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["landlord-applications", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("landlord_applications" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LandlordApp[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const payload: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
      if (notes !== undefined) payload.admin_notes = notes;
      const { error } = await supabase
        .from("landlord_applications" as never)
        .update(payload as never)
        .eq("id", id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlord-applications"] });
      toast.success("Application updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const convertToResidence = useMutation({
    mutationFn: async (app: LandlordApp) => {
      const { error } = await supabase.from("residences").insert({
        name: app.property_name,
        address: app.address,
        campus: app.nearest_campus,
        room_type: app.room_type,
        price: app.price || 0,
        capacity: app.capacity || 1,
        available_spots: app.capacity || 1,
        description: app.description,
        province: app.province,
        amenities: app.amenities || [],
        contact_email: app.contact_email,
        contact_phone: app.contact_phone,
      });
      if (error) throw error;
      await supabase
        .from("landlord_applications" as never)
        .update({ status: "approved", admin_notes: (app.admin_notes || "") + "\n[Converted to residence]" } as never)
        .eq("id", app.id as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlord-applications"] });
      toast.success("Residence created from application!");
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const openDetail = (app: LandlordApp) => {
    setSelected(app);
    setAdminNotes(app.admin_notes || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Landlord Applications</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : apps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No applications found.</p>
      ) : (
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-mono text-xs">{app.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell className="font-medium">{app.property_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeColors[app.application_type] || ""}>{app.application_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[app.status] || ""}>{app.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{app.contact_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(app.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openDetail(app)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.property_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline" className={typeColors[selected.application_type]}>{selected.application_type}</Badge></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={statusColors[selected.status]}>{selected.status}</Badge></div>
                  <div><span className="text-muted-foreground">Address:</span> {selected.address}</div>
                  <div><span className="text-muted-foreground">Campus:</span> {selected.nearest_campus || "—"}</div>
                  <div><span className="text-muted-foreground">Price:</span> {selected.price ? `R${selected.price}` : "—"}</div>
                  <div><span className="text-muted-foreground">Capacity:</span> {selected.capacity || "—"}</div>
                  <div><span className="text-muted-foreground">Room Type:</span> {selected.room_type || "—"}</div>
                  <div><span className="text-muted-foreground">Province:</span> {selected.province}</div>
                </div>
                {selected.description && <p className="text-muted-foreground">{selected.description}</p>}

                {(selected.application_type === "accreditation" || selected.application_type === "both") && (
                  <div className="border-t pt-3 space-y-1">
                    <h4 className="font-semibold">Accreditation</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>Reg #: {selected.registration_number || "—"}</div>
                      <div>NSFAS: {selected.nsfas_accredited ? "Yes" : "No"}</div>
                      <div>Years: {selected.years_operating || "—"}</div>
                      <div>Properties: {selected.total_properties || "—"}</div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-1">
                  <h4 className="font-semibold">Contact (Internal Only)</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>{selected.contact_name}</div>
                    <div>{selected.contact_email}</div>
                    <div>{selected.contact_phone}</div>
                    <div>{selected.company_name || "—"}</div>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <Label>Admin Notes</Label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.status !== "under_review" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: selected.id, status: "under_review", notes: adminNotes })}>
                      Mark Under Review
                    </Button>
                  )}
                  {selected.status !== "approved" && (
                    <Button size="sm" className="gap-1" onClick={() => updateStatus.mutate({ id: selected.id, status: "approved", notes: adminNotes })}>
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </Button>
                  )}
                  {selected.status !== "rejected" && (
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus.mutate({ id: selected.id, status: "rejected", notes: adminNotes })}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  )}
                  {(selected.application_type === "listing" || selected.application_type === "both") && selected.status !== "approved" && (
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => convertToResidence.mutate(selected)}>
                      <Building2 className="w-4 h-4" /> Approve & Create Residence
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLandlordApplicationsContent;
