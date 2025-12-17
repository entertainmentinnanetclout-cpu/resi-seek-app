import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Application {
  id: string;
  user_id: string;
  residence_id: string;
  status: string;
  notes: string | null;
  application_date: string;
  created_at: string;
  residence?: { name: string };
  profile?: { full_name: string; email: string; phone: string | null; student_number: string | null };
}

const AdminApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`*, residence:residences(name)`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const appsWithProfiles = await Promise.all(
        (data || []).map(async (app) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, phone, student_number")
            .eq("id", app.user_id)
            .maybeSingle();
          return { ...app, profile } as Application;
        })
      );

      setApplications(appsWithProfiles);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Application ${newStatus}`);
      fetchApplications();
      setSelectedApplication(null);
    } catch (error) {
      console.error("Error updating application:", error);
      toast.error("Failed to update application");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      submitted: "secondary",
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      withdrawn: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.residence?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <SEO title="Manage Applications | Admin" description="Review and manage student applications" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Review and manage student applications</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or residence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredApplications.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No applications found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Residence</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{app.profile?.full_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{app.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{app.residence?.name || "Unknown"}</TableCell>
                        <TableCell>{format(new Date(app.application_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedApplication(app)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(app.status === "submitted" || app.status === "pending") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                onClick={() => updateStatus(app.id, "approved")}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => updateStatus(app.id, "rejected")}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
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

      {/* Application Detail Modal */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>Review student application information</DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-medium">{selectedApplication.profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Student Number</p>
                  <p className="font-medium">{selectedApplication.profile?.student_number || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedApplication.profile?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedApplication.profile?.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Residence</p>
                  <p className="font-medium">{selectedApplication.residence?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applied On</p>
                  <p className="font-medium">{format(new Date(selectedApplication.application_date), "dd MMM yyyy")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                {getStatusBadge(selectedApplication.status)}
              </div>

              {selectedApplication.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedApplication.notes}</p>
                </div>
              )}

              {(selectedApplication.status === "submitted" || selectedApplication.status === "pending") && (
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => updateStatus(selectedApplication.id, "rejected")}
                  >
                    Reject
                  </Button>
                  <Button className="flex-1" onClick={() => updateStatus(selectedApplication.id, "approved")}>
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminApplications;
