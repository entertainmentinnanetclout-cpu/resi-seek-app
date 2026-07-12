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
  email: string;
  full_name: string;
  phone: string | null;
  student_number: string | null;
  campus: string | null;
  roles: string[];
  primary_role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export const AdminUsersContent = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [phoneFilter, setPhoneFilter] = useState("all");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[AdminUsers] Fetching users from safe view...');

      const { data, error: usersError } = await supabase
        .from("admin_users_safe" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error('Failed to load admin users:', {
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint,
          code: usersError.code,
        });
        throw usersError;
      }

      setUsers(data || []);
    } catch (err: any) {
      console.error("[AdminUsers] Fatal error fetching users:", err);
      setError("Failed to load users. Please refresh the page.");
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
      primaryRole: user.primary_role,
      roles: user.roles?.join(', '),
      createdAt: user.created_at,
      lastSignIn: user.last_sign_in_at,
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
    const matchesRole = roleFilter === "all" || user.primary_role === roleFilter;
    const matchesPhone = phoneFilter === "all" || 
      (phoneFilter === "with" && user.phone) ||
      (phoneFilter === "without" && !user.phone);
    return matchesSearch && matchesRole && matchesPhone;
  });

  return (
    <>
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
            ) : error ? (
              <div className="py-8 text-center text-destructive">
                <p className="font-semibold">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => fetchUsers()}>Retry</Button>
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
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              {user.primary_role === "admin" ? (
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
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map(role => (
                              <Badge key={role} variant={role === "admin" ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{safeFormatDate(user.created_at)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={user.primary_role}
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
