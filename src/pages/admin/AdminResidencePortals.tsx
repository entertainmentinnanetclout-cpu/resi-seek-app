import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, Plus, Search, UserCog, ToggleLeft, ToggleRight, 
  Mail, Trash2, RefreshCw, Loader2, CheckCircle
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PortalAccount {
  residence_id: string;
  user_id: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
  residences?: {
    id: string;
    name: string;
    campus: string | null;
    province: string | null;
  } | null;
}

interface Residence {
  id: string;
  name: string;
}

const AdminResidencePortals = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [availableResidences, setAvailableResidences] = useState<Residence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Session expired. Please login again.");
        navigate("/auth");
        return;
      }

      if (import.meta.env.DEV) {
        console.log('Admin session user:', session.user.id);
      }

      // Fetch all residences for the dropdown
      const { data: allResidences } = await supabase
        .from('residences')
        .select('id, name')
        .order('name');
      
      setResidences(allResidences || []);

      // Fetch portal accounts with joined residence data
      const { data: accountsData, error: accountsError } = await supabase
        .from('residence_portal_accounts')
        .select(`
          residence_id,
          user_id,
          email,
          is_active,
          created_at,
          residences (
            id,
            name,
            campus,
            province
          )
        `)
        .order('created_at', { ascending: false });

      if (accountsError) {
        console.error('Load portal accounts error:', accountsError);
        throw accountsError;
      }

      const transformedAccounts = (accountsData || []) as unknown as PortalAccount[];
      setAccounts(transformedAccounts);

      // Filter out residences that already have accounts
      const usedResidenceIds = new Set(transformedAccounts.map(a => a.residence_id));
      setAvailableResidences(
        (allResidences || []).filter(r => !usedResidenceIds.has(r.id))
      );
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load portal accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!selectedResidence || !newEmail || !newPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsCreating(true);
    try {
      // Create the auth user with admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Assign residence_portal role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'residence_portal'
        });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        // Continue anyway, role can be assigned manually
      }

      // Create portal account record
      const { error: portalError } = await supabase
        .from('residence_portal_accounts')
        .insert({
          residence_id: selectedResidence,
          user_id: authData.user.id,
          email: newEmail,
          is_active: true
        });

      if (portalError) throw portalError;

      toast.success('Portal account created successfully');
      setShowCreateDialog(false);
      setSelectedResidence("");
      setNewEmail("");
      setNewPassword("");
      fetchData();
    } catch (err: any) {
      console.error('Error creating account:', err);
      toast.error(err.message || 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleAccountStatus = async (account: PortalAccount) => {
    try {
      const { error } = await supabase
        .from('residence_portal_accounts')
        .update({ is_active: !account.is_active })
        .eq('residence_id', account.residence_id);

      if (error) throw error;

      toast.success(`Account ${account.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Failed to update account status');
    }
  };

  const deleteAccount = async (account: PortalAccount) => {
    if (!confirm(`Are you sure you want to delete the portal account for ${account.residences?.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('residence_portal_accounts')
        .delete()
        .eq('residence_id', account.residence_id);

      if (error) throw error;

      toast.success('Portal account deleted');
      fetchData();
    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Failed to delete account');
    }
  };

  const filteredAccounts = accounts.filter(account => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      account.email.toLowerCase().includes(query) ||
      account.residences?.name?.toLowerCase().includes(query) ||
      account.residences?.campus?.toLowerCase().includes(query) ||
      account.residences?.province?.toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout>
      <SEO 
        title="Residence Portals | Admin | ResKonnect"
        description="Manage residence portal accounts"
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Residence Portals</h1>
            <p className="text-muted-foreground">
              Manage residence portal user accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Portal
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Portals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {accounts.filter(a => a.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Residences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {availableResidences.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by residence or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <UserCog className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-medium">No portal accounts found</p>
                  <p className="text-sm text-muted-foreground">
                    Get started by creating a new residence portal account.
                  </p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Portal Account
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Residence</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.residence_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {account.residences?.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>{account.residences?.campus || '-'}</TableCell>
                      <TableCell>{account.residences?.province || '-'}</TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(account.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAccountStatus(account)}
                          >
                            {account.is_active ? (
                              <ToggleRight className="h-4 w-4 text-success" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAccount(account)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Portal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Residence Portal</DialogTitle>
            <DialogDescription>
              Create a portal account for a residence owner to manage their applications.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Residence</Label>
              <Select value={selectedResidence} onValueChange={setSelectedResidence}>
                <SelectTrigger>
                  <SelectValue placeholder="Select residence..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResidences.map((res) => (
                    <SelectItem key={res.id} value={res.id}>
                      {res.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableResidences.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All residences already have portal accounts
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Portal Email</Label>
              <Input
                type="email"
                placeholder="residence@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAccount} 
              disabled={isCreating || !selectedResidence || !newEmail || !newPassword}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminResidencePortals;
