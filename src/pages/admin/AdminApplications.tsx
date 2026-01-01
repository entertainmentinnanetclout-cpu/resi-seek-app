import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Check, X, CheckCheck, XCircle } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchApplications = async () => {
    try {
      console.log('[AdminApplications] Fetching applications...');
      
      const { data, error } = await supabase
        .from("applications")
        .select(`*, residence:residences(name)`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[AdminApplications] Fetch error:', error);
        throw error;
      }
      
      console.log(`[AdminApplications] Fetched ${data?.length || 0} applications`);

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
      console.error("[AdminApplications] Error:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    
    // Subscribe to realtime updates for applications
    const channel = supabase
      .channel('admin-applications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        (payload) => {
          console.log('[AdminApplications] Realtime update:', payload);
          fetchApplications();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AdminApplications] Subscribed to realtime updates');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[AdminApplications] Subscription error:', err);
        }
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
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

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      toast.error("No applications selected");
      return;
    }

    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .in("id", Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} applications ${newStatus}`);
      setSelectedIds(new Set());
      fetchApplications();
    } catch (error) {
      console.error("Error bulk updating applications:", error);
      toast.error("Failed to update applications");
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllPending = () => {
    const pendingIds = filteredApplications
      .filter(app => app.status === "submitted" || app.status === "pending")
      .map(app => app.id);
    setSelectedIds(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
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

  const pendingCount = filteredApplications.filter(
    app => app.status === "submitted" || app.status === "pending"
  ).length;

  return (
    <AdminLayout>
      <SEO title="Manage Applications | Admin" description="Review and manage student applications" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Review and manage student applications</p>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-medium">{selectedIds.size} selected</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => bulkUpdateStatus("approved")}
                    disabled={bulkProcessing}
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => bulkUpdateStatus("rejected")}
                    disabled={bulkProcessing}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject All
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              {pendingCount > 0 && (
                <Button variant="outline" onClick={selectAllPending}>
                  Select All Pending ({pendingCount})
                </Button>
              )}
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredApplications.filter(a => a.status === "submitted" || a.status === "pending").length && selectedIds.size > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllPending();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Residence</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id} className={selectedIds.has(app.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          {(app.status === "submitted" || app.status === "pending") && (
                            <Checkbox
                              checked={selectedIds.has(app.id)}
                              onCheckedChange={() => toggleSelection(app.id)}
                            />
                          )}
                        </TableCell>
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