import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, Plus, Search, UserCog, ToggleLeft, ToggleRight, 
  Mail, Pencil, Trash2, RefreshCw, Loader2, CheckCircle
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

const stringifyErrorPart = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() && value.trim() !== "{}") return value.trim();
  if (value && typeof value === "object") {
    try {
      const text = JSON.stringify(value);
      return text && text !== "{}" ? text : null;
    } catch {
      return null;
    }
  }
  return null;
};

const getReadableError = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message && err.message !== "{}") return err.message;
  if (typeof err === "string" && err.trim() && err.trim() !== "{}") return err.trim();
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const nestedDetails = record.details && typeof record.details === "object"
      ? (record.details as Record<string, unknown>)
      : null;
    const debugCode = stringifyErrorPart(record.debug_code) || stringifyErrorPart(nestedDetails?.debug_code);
    const version = stringifyErrorPart(record.version) || stringifyErrorPart(nestedDetails?._version);
    const directMessage = stringifyErrorPart(record.message) || stringifyErrorPart(record.error);
    if (directMessage) {
      return [directMessage, debugCode ? `Code: ${debugCode}` : null, version ? `Function: ${version}` : null]
        .filter(Boolean)
        .join(" · ");
    }
    for (const key of ["message", "details", "hint", "code"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (nestedDetails) {
      const nestedMessage = stringifyErrorPart(nestedDetails.error) || stringifyErrorPart(nestedDetails.message);
      if (nestedMessage) {
        return [nestedMessage, debugCode ? `Code: ${debugCode}` : null, version ? `Function: ${version}` : null]
          .filter(Boolean)
          .join(" · ");
      }
    }
    if (debugCode) return `${fallback} · Code: ${debugCode}`;
    const asText = stringifyErrorPart(record);
    if (asText) return asText;
  }
  return fallback;
};

interface PortalAccount {
  id: string;
  portal_role: "owner" | "manager" | "admin";
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

export const AdminResidencePortalsContent = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [availableResidences, setAvailableResidences] = useState<Residence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole,setNewRole]=useState<"owner"|"manager"|"admin">("owner");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editing,setEditing]=useState<PortalAccount|null>(null);
  const [editResidenceId,setEditResidenceId]=useState("");
  const [editEmail,setEditEmail]=useState("");
  const [editRole,setEditRole]=useState<"owner"|"manager"|"admin">("owner");
  const [editActive,setEditActive]=useState(true);
  const [isSavingEdit,setIsSavingEdit]=useState(false);

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

      // Fetch portal accounts + residence rows separately to avoid the
      // "more than one relationship" PostgREST error caused by duplicate
      // FKs on residence_portal_accounts.residence_id on External.
      const { data: accountsData, error: accountsError } = await supabase
        .from('residence_portal_accounts')
        .select('id, residence_id, user_id, email, portal_role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (accountsError) {
        console.error('Load portal accounts error:', accountsError);
        throw accountsError;
      }

      const resIds = (accountsData || []).map(a => a.residence_id);
      const { data: joinedRes } = resIds.length
        ? await supabase.from('residences').select('id, name, campus, province').in('id', resIds)
        : { data: [] as any[] };
      const resMap = new Map((joinedRes || []).map(r => [r.id, r]));
      const transformedAccounts = (accountsData || []).map(a => ({
        ...a,
        residences: resMap.get(a.residence_id) || null,
      })) as unknown as PortalAccount[];
      setAccounts(transformedAccounts);

      // Suspended accounts also occupy one of a residence's three seats.
      const counts = new Map<string, number>();
      for(const a of transformedAccounts)counts.set(a.residence_id,(counts.get(a.residence_id)||0)+1);
      setAvailableResidences((allResidences||[]).filter(r=>(counts.get(r.id)||0)<3));
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load portal accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!selectedResidence || !newEmail) {
      toast.error('Select a residence and enter an email address');
      return;
    }
    if (newPassword && newPassword.length < 12) {
      toast.error('New passwords must be at least 12 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsCreating(true);
    try {
      await managePortal({action:"create",residence_id:selectedResidence,email:newEmail,
        password:newPassword,portal_role:newRole});

      toast.success('Portal account created successfully');
      setShowCreateDialog(false);
      setSelectedResidence("");
      setNewEmail("");
      setNewRole("owner");
      setNewPassword("");
      setConfirmPassword("");
      fetchData();
    } catch (err: unknown) {
      console.error('Error creating account:', err);
      toast.error(getReadableError(err, 'Failed to create account'));
    } finally {
      setIsCreating(false);
    }
  };

  const managePortal = async (request:Record<string,unknown>) => {
    // The active portal-management function is hosted on the ResKonnect
    // Supabase project, not the historical Lovable Cloud functions host.
    const {data,error}=await supabase.functions.invoke("admin-residence-portal-accounts",{body:request});
    if(error){
      let detail="";
      try{
        const context=(error as {context?:Response}).context;
        if(context&&typeof context.clone==="function"){
          const payload=await context.clone().json();
          detail=typeof payload?.error==="string"?payload.error:"";
        }
      }catch{/* Boot or network errors may return no JSON. */}
      const message=detail||getReadableError(error,"Portal management failed");
      throw new Error(/Failed to send a request to the Edge Function/i.test(message)
        ?"Cannot reach the ResKonnect portal-management service; check its deployment."
        :message);
    }
    if(data?.error)throw new Error(String(data.error));
    if(!data?.ok)throw new Error("Portal management did not confirm the change");
    return data;
  };

  const editPortal=(account:PortalAccount)=>{
    setEditing(account);setEditResidenceId(account.residence_id);
    setEditEmail(account.email);setEditActive(account.is_active);setEditRole(account.portal_role);
  };
  const saveEdit=async()=>{
    if(!editing)return;
    setIsSavingEdit(true);
    try{
      await managePortal({action:"update",account_id:editing.id,
        new_residence_id:editResidenceId,email:editEmail,is_active:editActive,portal_role:editRole});
      toast.success("Residence portal account updated");
      setEditing(null);await fetchData();
    }catch(e){toast.error(getReadableError(e,"Could not save portal account"));}
    finally{setIsSavingEdit(false);}
  };
  const toggleAccountStatus=async(account:PortalAccount)=>{
    try{
      await managePortal({action:"update",account_id:account.id,
        new_residence_id:account.residence_id,email:account.email,is_active:!account.is_active,portal_role:account.portal_role});
      toast.success(account.is_active?"Portal deactivated":"Portal activated");await fetchData();
    }catch(e){toast.error(getReadableError(e,"Could not change portal status"));}
  };
  const deleteAccount=async(account:PortalAccount)=>{
    if(!window.confirm("Remove portal access for "+account.email+" at "+(account.residences?.name||"this residence")+"? The user's personal ResKonnect identity and unrelated student roles will be preserved."))return;
    try{
      await managePortal({action:"delete",account_id:account.id,confirmed:true});
      toast.success("Residence portal access removed without deleting the user's other data");
      await fetchData();
    }catch(e){toast.error(getReadableError(e,"Could not remove portal access"));}
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
    <>
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
              Manage up to three owner, manager or admin logins per residence
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
              <CardTitle className="text-sm font-medium">Team logins</CardTitle>
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
              <CardTitle className="text-sm font-medium">Residences with space</CardTitle>
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
                    <TableHead>Portal login</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {account.residences?.name || 'Unknown'}
                          <span className="text-xs text-muted-foreground">({accounts.filter(x=>x.residence_id===account.residence_id).length}/3)</span>
                        </div>
                      </TableCell>
                      <TableCell>{account.residences?.campus || '-'}</TableCell>
                      <TableCell>{account.residences?.province || '-'}</TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{account.portal_role}</Badge></TableCell>
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
                          <Button variant="ghost" size="sm" aria-label={"Edit "+account.email} onClick={()=>editPortal(account)}><Pencil className="h-4 w-4"/></Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={(account.is_active?"Disable ":"Enable ")+account.email}
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
                            aria-label={"Remove "+account.email}
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

      <Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null);}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit residence portal</DialogTitle>
            <DialogDescription>Edit this individual team member; other portal accounts stay unchanged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Assigned residence</Label>
              <Select value={editResidenceId} onValueChange={setEditResidenceId}>
                <SelectTrigger><SelectValue placeholder="Select residence"/></SelectTrigger>
                <SelectContent>{residences.filter(r=>r.id===editing?.residence_id||availableResidences.some(a=>a.id===r.id)).map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="portal-edit-email">Portal login email</Label>
              <Input id="portal-edit-email" type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">Changing a shared student/admin login email is blocked for account safety.</p>
            </div>
            <div className="space-y-2"><Label>Team role</Label>
              <Select value={editRole} onValueChange={v=>setEditRole(v as typeof editRole)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="owner">Residence owner</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Residence admin</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Portal access</Label>
              <Select value={editActive?"active":"inactive"} onValueChange={v=>setEditActive(v==="active")}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                  <SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Suspended</SelectItem>
                </SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button>
            <Button disabled={isSavingEdit||!editResidenceId||!editEmail} onClick={()=>void saveEdit()}>{isSavingEdit&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Portal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Residence Portal</DialogTitle>
            <DialogDescription>
              Add one of up to three team logins for this residence.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Residence</Label>
              <Select value={selectedResidence} onValueChange={value=>{
                  setSelectedResidence(value);
                  setNewRole(accounts.some(a=>a.residence_id===value)?"manager":"owner");
                }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select residence..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResidences.map((res) => (
                    <SelectItem key={res.id} value={res.id}>
                      {res.name} ({accounts.filter(a=>a.residence_id===res.id).length}/3)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableResidences.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All residences have reached the three-account limit
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Team member role</Label>
              <Select value={newRole} onValueChange={v=>setNewRole(v as typeof newRole)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Residence owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Residence admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Up to three accounts, with no more than one residence owner.</p>
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
                placeholder="At least 12 characters for a new login"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Use 12 or more characters for new logins. Leave blank to link an existing verified ResKonnect account.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAccount} 
              disabled={isCreating || !selectedResidence || !newEmail || (Boolean(newPassword) && newPassword.length<12)}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminResidencePortals = () => (
  <AdminLayout><AdminResidencePortalsContent /></AdminLayout>
);

export default AdminResidencePortals;
