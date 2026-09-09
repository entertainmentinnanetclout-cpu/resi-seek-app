import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
};

const ROLE_OPTIONS = [
  { value: "none", label: "No staff access", description: "Public/student access only" },
  { value: "admin", label: "God Mode Admin", description: "Full ResKonnect administration; 2FA required" },
  { value: "operations_lead", label: "Operations Lead", description: "Operations-scoped staff access" },
  { value: "commerce_lead", label: "Commerce Lead", description: "Commerce-scoped staff access" },
  { value: "growth_lead", label: "Growth Lead", description: "Growth and partner-scoped staff access" },
  { value: "system_operator", label: "System Operator", description: "Platform operations access" },
  { value: "tvet_lead", label: "TVET Lead", description: "TVET workflow access" },
  { value: "support_agent", label: "Support Agent", description: "Customer support access" },
] as const;

const roleLabel = (role?: string | null) => ROLE_OPTIONS.find((entry) => entry.value === role)?.label || "No staff access";

export default function AdminAccessControl() {
  const { user, isGodMode } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  const loadAccounts = useCallback(async (query = "") => {
    if (!isGodMode) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_list_staff_accounts", {
        p_search: query.trim() || null,
      });
      if (error) throw error;
      const accounts = (Array.isArray(data) ? data : []) as StaffAccount[];
      setRows(accounts);
      setPendingRoles(Object.fromEntries(accounts.map((row) => [row.id, row.staff_role || "none"])));
    } catch (error: any) {
      console.error("[AdminAccessControl] failed to load staff accounts", error);
      toast.error(error?.message || "Could not load staff accounts. Re-verify God Mode 2FA and try again.");
    } finally {
      setLoading(false);
    }
  }, [isGodMode]);

  useEffect(() => {
    if (!open) return;
    void loadAccounts("");
  }, [loadAccounts, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadAccounts(search), 350);
    return () => window.clearTimeout(timer);
  }, [loadAccounts, open, search]);

  const changedCount = useMemo(() => rows.filter((row) => (pendingRoles[row.id] || "none") !== (row.staff_role || "none")).length, [pendingRoles, rows]);

  const saveRole = async (row: StaffAccount) => {
    const nextRole = pendingRoles[row.id] || "none";
    if (row.id === user?.id) {
      toast.error("You cannot change your own God Mode role from this screen.");
      return;
    }
    if (nextRole === (row.staff_role || "none")) return;

    const warning = nextRole === "admin"
      ? `Grant full God Mode Admin access to ${row.email || row.full_name || "this account"}?`
      : nextRole === "none"
        ? `Remove staff access from ${row.email || row.full_name || "this account"}?`
        : `Assign ${roleLabel(nextRole)} to ${row.email || row.full_name || "this account"}?`;

    if (!window.confirm(warning)) {
      setPendingRoles((previous) => ({ ...previous, [row.id]: row.staff_role || "none" }));
      return;
    }

    setSavingId(row.id);
    try {
      const { data, error } = await (supabase as any).rpc("admin_set_staff_role", {
        p_user_id: row.id,
        p_role: nextRole,
      });
      if (error) throw error;
      toast.success(nextRole === "none" ? "Staff access removed." : `${roleLabel(nextRole)} assigned.`);
      setRows((previous) => previous.map((entry) => entry.id === row.id ? { ...entry, staff_role: data?.staff_role || null } : entry));
      setPendingRoles((previous) => ({ ...previous, [row.id]: data?.staff_role || "none" }));
    } catch (error: any) {
      console.error("[AdminAccessControl] role change failed", error);
      setPendingRoles((previous) => ({ ...previous, [row.id]: row.staff_role || "none" }));
      toast.error(error?.message || "Role update failed. A verified AAL2 God Mode session is required.");
    } finally {
      setSavingId(null);
    }
  };

  if (!isGodMode) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hidden h-9 gap-2 sm:inline-flex">
          <UserCog className="h-4 w-4" />Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <DialogTitle>God Mode · Access Control</DialogTitle>
              <DialogDescription>Assign one scoped staff role per account. Full God Mode is the Admin role and every write is protected by AAL2 two-factor authentication and an audit log.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b bg-muted/20 px-5 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="pl-9" /></div>
            <Badge variant="outline" className="w-fit"><Users className="mr-1 h-3.5 w-3.5" />{rows.length} accounts</Badge>
            {changedCount > 0 && <Badge className="w-fit bg-amber-500 text-slate-950">{changedCount} unsaved</Badge>}
          </div>
        </div>

        <div className="max-h-[62dvh] overflow-y-auto p-3 sm:p-5">
          {loading && rows.length === 0 ? (
            <div className="grid min-h-52 place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading secure account directory…</div></div>
          ) : rows.length === 0 ? (
            <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground">No matching accounts.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const current = row.staff_role || "none";
                const pending = pendingRoles[row.id] || "none";
                const changed = current !== pending;
                const self = row.id === user?.id;
                return (
                  <div key={row.id} className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_230px_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold">{row.full_name || row.email || "Unnamed account"}</p>{self && <Badge variant="secondary">You</Badge>}{current === "admin" && <Badge className="bg-slate-950 text-white">God Mode</Badge>}</div>
                      <p className="truncate text-xs text-muted-foreground">{row.email || "No email"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">{(row.all_roles || []).map((role) => <Badge key={role} variant="outline" className="text-[10px]">{role}</Badge>)}</div>
                    </div>

                    <Select disabled={self || savingId === row.id} value={pending} onValueChange={(value) => setPendingRoles((previous) => ({ ...previous, [row.id]: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}><div><div className="font-semibold">{option.label}</div><div className="text-[10px] text-muted-foreground">{option.description}</div></div></SelectItem>)}</SelectContent>
                    </Select>

                    <Button disabled={self || !changed || savingId === row.id} onClick={() => void saveRole(row)} className="sm:w-24">
                      {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save role"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
