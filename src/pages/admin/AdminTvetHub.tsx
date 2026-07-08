import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Users, FileText, CheckCircle2, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";

export default function AdminTvetHub() {
  const { staffRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && staffRole && staffRole !== "admin" && staffRole !== "tvet_lead") {
      toast.error("Access denied: TVET Lead or Admin required");
      navigate("/admin");
    }
  }, [staffRole, isLoading, navigate]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("tvet_applications_v" as any).select("*").order("created_at", { ascending: false });
      if (error) {
        console.warn("[AdminTvetHub] view read failed, falling back to applications filter:", error.message);
        const { data: fallback } = await supabase.from("applications").select("id, user_id, residence_id, status, application_date, created_at, institution_type, residence:residences!fk_applications_residence(name)").eq("institution_type", "tvet").order("created_at", { ascending: false });
        // Enrich with profile
        const enriched = await Promise.all((fallback || []).map(async (a: any) => {
          const { data: p } = await supabase.from("profiles").select("full_name, email, phone, student_number, campus").eq("id", a.user_id).maybeSingle();
          return {
            application_id: a.id,
            user_id: a.user_id,
            residence_id: a.residence_id,
            application_status: a.status,
            application_date: a.application_date,
            created_at: a.created_at,
            residence_name: a.residence?.name,
            student_name: p?.full_name,
            student_email: p?.email,
            student_phone: p?.phone,
            student_number: p?.student_number,
            student_campus: p?.campus,
          };
        }));
        setRows(enriched);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase();
    const matchesQ = !q || [r.student_name, r.student_email, r.student_number, r.residence_name, r.recruiter_name].some((v) => String(v || "").toLowerCase().includes(q));
    const matchesStatus = statusFilter === "all" || r.application_status === statusFilter;
    const matchesRecruiter = recruiterFilter === "all" || (recruiterFilter === "none" ? !r.referral_agent_user_id : r.referral_agent_user_id === recruiterFilter);
    return matchesQ && matchesStatus && matchesRecruiter;
  }), [rows, search, statusFilter, recruiterFilter]);

  const recruiters = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.referral_agent_user_id) map.set(r.referral_agent_user_id, r.recruiter_name || r.referral_code || "Recruiter"); });
    return Array.from(map.entries());
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    students: new Set(rows.map((r) => r.user_id)).size,
    approved: rows.filter((r) => r.application_status === "approved").length,
    referred: rows.filter((r) => r.referral_agent_user_id).length,
  }), [rows]);

  return (
    <AdminLayout>
      <SEO title="TVET Hub | Admin" description="Manage TVET student applications and recruiter attribution" />
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary"><GraduationCap className="w-6 h-6" /></div>
          <div>
            <h1 className="text-3xl font-bold">TVET Hub</h1>
            <p className="text-muted-foreground">All applications from TVET college students, with recruiter attribution.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox icon={FileText} label="TVET Applications" value={stats.total} color="text-orange-500" />
          <StatBox icon={Users} label="Unique Students" value={stats.students} color="text-blue-500" />
          <StatBox icon={CheckCircle2} label="Approved" value={stats.approved} color="text-green-500" />
          <StatBox icon={GraduationCap} label="Via Recruiter" value={stats.referred} color="text-purple-500" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Filter by status or recruiter. Data restricted by RLS to TVET rows only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, residence, recruiter…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                <SelectTrigger className="sm:w-56"><SelectValue placeholder="Recruiter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="none">Direct (no recruiter)</SelectItem>
                  {recruiters.map(([id, name]) => (<SelectItem key={id} value={id}>{name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading TVET applications…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No TVET applications match your filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Residence</TableHead>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.application_id}>
                        <TableCell>
                          <div className="font-medium">{r.student_name || "Anonymous"}</div>
                          <div className="text-xs text-muted-foreground">{r.student_email || "—"} · {r.student_number || "—"}</div>
                        </TableCell>
                        <TableCell>{r.residence_name || "—"}</TableCell>
                        <TableCell>
                          {r.recruiter_name ? (
                            <div>
                              <div className="font-medium text-sm">{r.recruiter_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{r.referral_code}</div>
                            </div>
                          ) : (<Badge variant="outline">Direct</Badge>)}
                        </TableCell>
                        <TableCell className="text-sm">{safeFormatDate(r.application_date || r.created_at)}</TableCell>
                        <TableCell><Badge variant={r.application_status === "approved" ? "default" : r.application_status === "rejected" ? "destructive" : "secondary"}>{String(r.application_status || "").replace(/_/g, " ")}</Badge></TableCell>
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
}

function StatBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}