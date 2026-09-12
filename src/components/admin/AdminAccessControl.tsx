import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_DEPARTMENTS, AdminDepartmentKey } from "@/lib/adminDepartments";
import { toast } from "sonner";

type StaffAccount = {
  id: string;
  email: string | null;
  full_name: string | null;
  student_number: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  staff_role: string | null;
  all_roles: string[] | null;
  departments: AdminDepartmentKey[] | null;
  effective_departments: AdminDepartmentKey[] | null;
};

const ROLE_OPTIONS = [
  { value: "none", label: "No legacy role", description: "Department access can still be assigned below" },
  { value: "admin", label: "God Mode Admin", description: "Full platform administration; AAL2 required" },
  { value: "operations_lead", label: "Operations Lead", description: "Legacy operations compatibility" },
  { value: "commerce_lead", label: "Commerce Lead", description: "Legacy commerce compatibility" },
  { value: "growth_lead", label: "Growth Lead", description: "Legacy growth compatibility" },
  { value: "system_operator", label: "System Operator", description: "Legacy platform compatibility" },
  { value: "tvet_lead", label: "TVET Lead", description: "Legacy TVET compatibility" },
  { value: "support_agent", label: "Support Agent", description: "Legacy support compatibility" },
] as const;

const roleLabel = (role?: string | null) => ROLE_OPTIONS.find((entry) => entry.value === role)?.label || "No legacy role";
const sorted=(values:AdminDepartmentKey[])=>[...new Set(values)].sort();

export default function AdminAccessControl() {
  const { user, isGodMode } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDepartmentsId, setSavingDepartmentsId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [pendingDepartments, setPendingDepartments] = useState<Record<string, AdminDepartmentKey[]>>({});

  const loadAccounts = useCallback(async (query = "") => {
    if (!isGodMode) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_list_staff_accounts", { p_search: query.trim() || null });
      if (error) throw error;
      const accounts = (Array.isArray(data) ? data : []) as StaffAccount[];
      setRows(accounts);
      setPendingRoles(Object.fromEntries(accounts.map((row) => [row.id, row.staff_role || "none"])));
      setPendingDepartments(Object.fromEntries(accounts.map((row) => [row.id, sorted(row.departments || [])])));
    } catch (error: any) {
      console.error("[AdminAccessControl] failed to load staff accounts", error);
      toast.error(error?.message || "Could not load access directory. Re-verify God Mode 2FA.");
    } finally {
      setLoading(false);
    }
  }, [isGodMode]);

  useEffect(() => { if (open) void loadAccounts(""); }, [loadAccounts, open]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadAccounts(search), 350);
    return () => window.clearTimeout(timer);
  }, [loadAccounts, open, search]);

  const changedCount = useMemo(() => rows.filter((row) => {
    const roleChanged=(pendingRoles[row.id]||"none")!==(row.staff_role||"none");
    const deptChanged=JSON.stringify(sorted(pendingDepartments[row.id]||[]))!==JSON.stringify(sorted(row.departments||[]));
    return roleChanged||deptChanged;
  }).length, [pendingDepartments,pendingRoles,rows]);

  const saveRole = async (row: StaffAccount) => {
    const nextRole = pendingRoles[row.id] || "none";
    if (row.id === user?.id) return toast.error("You cannot change your own God Mode role here.");
    if (nextRole === (row.staff_role || "none")) return;
    const warning = nextRole === "admin"
      ? `Grant full God Mode access to ${row.email || row.full_name || "this account"}?`
      : nextRole === "none"
        ? `Remove the legacy staff role from ${row.email || row.full_name || "this account"}? Department assignments will remain.`
        : `Assign ${roleLabel(nextRole)} to ${row.email || row.full_name || "this account"}?`;
    if (!window.confirm(warning)) return;
    setSavingId(row.id);
    try {
      const { data, error } = await (supabase as any).rpc("admin_set_staff_role", { p_user_id: row.id, p_role: nextRole });
      if (error) throw error;
      setRows((previous) => previous.map((entry) => entry.id === row.id ? { ...entry, staff_role: data?.staff_role || null } : entry));
      setPendingRoles((previous) => ({ ...previous, [row.id]: data?.staff_role || "none" }));
      toast.success(nextRole === "none" ? "Legacy role removed." : `${roleLabel(nextRole)} assigned.`);
      await loadAccounts(search);
    } catch (error: any) {
      toast.error(error?.message || "Role update failed. A verified AAL2 God Mode session is required.");
    } finally { setSavingId(null); }
  };

  const toggleDepartment=(userId:string,key:AdminDepartmentKey,checked:boolean)=>{
    setPendingDepartments((previous)=>{
      const current=previous[userId]||[];
      return {...previous,[userId]:checked?sorted([...current,key]):current.filter((value)=>value!==key)};
    });
  };

  const saveDepartments=async(row:StaffAccount)=>{
    if(row.id===user?.id)return toast.error("You cannot change your own department access here.");
    const departments=sorted(pendingDepartments[row.id]||[]);
    setSavingDepartmentsId(row.id);
    try{
      const {data,error}=await(supabase as any).rpc("admin_set_department_assignments",{p_user_id:row.id,p_departments:departments});
      if(error)throw error;
      setRows((previous)=>previous.map((entry)=>entry.id===row.id?{...entry,departments:data?.departments||departments,effective_departments:data?.effective_departments||departments}:entry));
      toast.success("Department access updated.");
      await loadAccounts(search);
    }catch(error:any){
      toast.error(error?.message||"Department access update failed. A verified AAL2 God Mode session is required.");
    }finally{setSavingDepartmentsId(null);}
  };

  if (!isGodMode) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hidden h-9 gap-2 sm:inline-flex"><UserCog className="h-4 w-4" />Access</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <DialogTitle>God Mode · Department Access</DialogTitle>
              <DialogDescription>Assign complete departmental workspaces. Legacy staff roles remain only for compatibility with older policies and specialist routes.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b bg-muted/20 px-5 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="pl-9" /></div>
            <Badge variant="outline" className="w-fit"><Users className="mr-1 h-3.5 w-3.5" />{rows.length} accounts</Badge>
            {changedCount > 0 && <Badge className="w-fit bg-amber-500 text-slate-950">{changedCount} changed</Badge>}
          </div>
        </div>

        <div className="max-h-[70dvh] overflow-y-auto p-3 sm:p-5">
          {loading && rows.length === 0 ? (
            <div className="grid min-h-52 place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading secure account directory…</div></div>
          ) : rows.length === 0 ? (
            <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground">No matching accounts.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const self=row.id===user?.id;
                const roleChanged=(pendingRoles[row.id]||"none")!==(row.staff_role||"none");
                const departments=pendingDepartments[row.id]||[];
                const deptChanged=JSON.stringify(sorted(departments))!==JSON.stringify(sorted(row.departments||[]));
                return <section key={row.id} className="rounded-2xl border bg-card p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold">{row.full_name||row.email||"Unnamed account"}</p>{self&&<Badge variant="secondary">You</Badge>}{row.staff_role==="admin"&&<Badge>God Mode</Badge>}</div>
                      <p className="truncate text-xs text-muted-foreground">{row.email||"No email"}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{(row.effective_departments||[]).map((key)=><Badge key={key} variant="outline" className="text-[9px]">{ADMIN_DEPARTMENTS.find((d)=>d.key===key)?.shortLabel||key}</Badge>)}</div>
                    </div>
                    <Select disabled={self||savingId===row.id} value={pendingRoles[row.id]||"none"} onValueChange={(value)=>setPendingRoles((previous)=>({...previous,[row.id]:value}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLE_OPTIONS.map((option)=><SelectItem key={option.value} value={option.value}><div><div className="font-semibold">{option.label}</div><div className="text-[10px] text-muted-foreground">{option.description}</div></div></SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" disabled={self||!roleChanged||savingId===row.id} onClick={()=>void saveRole(row)}>{savingId===row.id?<Loader2 className="h-4 w-4 animate-spin"/>:"Save role"}</Button>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div><p className="flex items-center gap-2 text-sm font-black"><Building2 className="h-4 w-4"/>Department assignments</p><p className="text-[11px] text-muted-foreground">Checking an office grants its complete departmental navigation. Sensitive God Mode-only controls remain protected.</p></div>
                      <Button size="sm" disabled={self||!deptChanged||savingDepartmentsId===row.id} onClick={()=>void saveDepartments(row)}>{savingDepartmentsId===row.id?<Loader2 className="h-4 w-4 animate-spin"/>:"Save offices"}</Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {ADMIN_DEPARTMENTS.map((department)=>{
                        const checked=departments.includes(department.key);
                        return <label key={department.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs transition ${checked?"border-primary/40 bg-primary/5":"hover:bg-muted/40"}`}>
                          <Checkbox disabled={self} checked={checked} onCheckedChange={(value)=>toggleDepartment(row.id,department.key,value===true)}/>
                          <span><span className="block font-bold">{department.shortLabel}</span><span className="mt-0.5 block leading-4 text-muted-foreground">{department.description}</span></span>
                        </label>;
                      })}
                    </div>
                  </div>
                </section>;
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
