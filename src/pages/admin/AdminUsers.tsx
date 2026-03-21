import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Shield, User, Download, Phone, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";
import { format } from "date-fns";
import { downloadVCard, downloadEnhancedCSV, formatPhoneNumber } from "@/lib/exportHelpers";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  campus: string | null;
  student_number: string | null;
  created_at: string;
  year_of_study?: string | null;
  role?: string;
  applicationStatus?: string | null;
  residenceApplied?: string | null;
  documentsCount?: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [phoneFilter, setPhoneFilter] = useState("all");

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      let roles: Array<{ user_id: string; role: string }> = [];
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (!rolesError) {
        roles = rolesData || [];
      }

      // Fetch applications for each user
      const { data: applications } = await supabase
        .from("applications")
        .select("user_id, status, residence:residences!fk_applications_residence(name)")
        .order("created_at", { ascending: false });

      // Fetch document counts
      const { data: documents } = await supabase
        .from("documents")
        .select("user_id");

      // Create lookup maps
      const applicationMap = new Map<string, { status: string; residenceName: string | null }>();
      applications?.forEach(app => {
        if (!applicationMap.has(app.user_id)) {
          applicationMap.set(app.user_id, {
            status: app.status,
            residenceName: app.residence?.name || null
          });
        }
      });

      const docCounts = new Map<string, number>();
      documents?.forEach(doc => {
        docCounts.set(doc.user_id, (docCounts.get(doc.user_id) || 0) + 1);
      });

      // Merge all data
      const usersWithData = (profiles || []).map((profile) => ({
        ...profile,
        role: roles.find((r) => r.user_id === profile.id)?.role || "student",
        applicationStatus: applicationMap.get(profile.id)?.status || null,
        residenceApplied: applicationMap.get(profile.id)?.residenceName || null,
        documentsCount: docCounts.get(profile.id) || 0,
      }));

      setUsers(usersWithData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateRole = async (userId: string, newRole: "admin" | "student") => {
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: newRole }]);
        if (error) throw error;
      }

      toast.success("User role updated");
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleExportCSV = () => {
    downloadEnhancedCSV(filteredUsers.map(user => ({
      name: user.full_name,
      phone: user.phone,
      email: user.email,
      campus: user.campus,
      studentNumber: user.student_number,
      residenceApplied: user.residenceApplied,
      status: user.applicationStatus,
      documentsCount: user.documentsCount,
      yearOfStudy: user.year_of_study,
    })));
    toast.success(`Exported ${filteredUsers.length} users to CSV`);
  };

  const handleExportVCard = () => {
    downloadVCard(filteredUsers.map(user => ({
      name: user.full_name,
      phone: user.phone,
      email: user.email,
      campus: user.campus,
      studentNumber: user.student_number,
      residenceApplied: user.residenceApplied,
      status: user.applicationStatus,
    })));
    toast.success(`Exported ${filteredUsers.filter(u => u.phone).length} contacts to vCard`);
  };

  const handleWhatsApp = (user: UserProfile) => {
    const phone = formatPhoneNumber(user.phone);
    const message = encodeURIComponent(
      `Hi ${user.full_name}, this is ResKonnect. How can we assist you with your accommodation?`
    );
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${formatPhoneNumber(phone)}`, '_self');
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.student_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesPhone = phoneFilter === "all" || 
      (phoneFilter === "with" && user.phone) ||
      (phoneFilter === "without" && !user.phone);
    return matchesSearch && matchesRole && matchesPhone;
  });

  return (
    <AdminLayout>
      <SEO title="Manage Users | Admin" description="Manage user accounts and roles" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage user accounts and permissions ({users.length} total)</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportVCard} variant="outline" size="sm">
              <Phone className="w-4 h-4 mr-2" />
              Export vCard
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or student number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
              <Select value={phoneFilter} onValueChange={setPhoneFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Phone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="with">Has Phone</SelectItem>
                  <SelectItem value="without">No Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              {user.role === "admin" ? (
                                <Shield className="w-5 h-5 text-primary" />
                              ) : (
                                <User className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{user.full_name}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              {user.student_number && (
                                <p className="text-xs text-muted-foreground">#{user.student_number}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.phone ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{formatPhoneNumber(user.phone)}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleCall(user.phone!)}
                                  title="Call"
                                >
                                  <Phone className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-green-600"
                                  onClick={() => handleWhatsApp(user)}
                                  title="WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No phone</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.campus || "-"}</span>
                        </TableCell>
                        <TableCell>
                          {user.applicationStatus ? (
                            <div>
                              <Badge variant={user.applicationStatus === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                {user.applicationStatus}
                              </Badge>
                              {user.residenceApplied && (
                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[120px]">
                                  {user.residenceApplied}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateRole(user.id, value as "admin" | "student")}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
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

const AdminUsers = () => (
  <AdminLayout><AdminUsersContent /></AdminLayout>
);

export default AdminUsers;
