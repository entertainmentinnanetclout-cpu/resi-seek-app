import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { adminApproveRecruiter, adminRejectRecruiter, adminMarkReferralStatus } from "@/lib/referrals/referralApi";
import { Loader2, Search, UserCheck, Wallet, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";

export const AdminRecruitmentProgrammeContent = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [refs, setRefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: a }, { data: r }] = await Promise.all([
        supabase.from("recruiter_applications" as any).select("*").eq("program_key", "student_recruitment").order("created_at", { ascending: false }),
        supabase.from("admin_referral_applications_v" as any).select("*").eq("program_key", "student_recruitment").order("referred_at", { ascending: false }).limit(200),
      ]);
      setApps(a || []);
      setRefs(r || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load recruitment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    const { error } = await adminApproveRecruiter(id);
    if (error) return toast.error(error.message);
    toast.success("Recruiter approved and role assigned");
    load();
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional)") || undefined;
    const { error } = await adminRejectRecruiter(id, reason);
    if (error) return toast.error(error.message);
    toast.success("Recruiter rejected");
    load();
  };

  const mark = async (appId: string, status: string) => {
    const { error } = await adminMarkReferralStatus(appId, status);
    if (error) return toast.error(error.message);
    toast.success(`Marked referral as ${status}`);
    load();
  };

  const filteredApps = apps.filter(a =>
    a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    pendingApps: apps.filter(a => a.status === 'pending').length,
    totalRecruiters: apps.filter(a => a.status === 'approved').length,
    pendingPayouts: refs.filter(r => r.referral_status === 'approved').length,
    totalPaid: refs.filter(r => r.referral_status === 'paid').reduce((sum, r) => sum + Number(r.commission_amount || 0), 0)
  };

  return (
    <>
      <SEO title="Recruitment Programme | Admin" description="Approve recruiters and manage referrals." />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Student Recruitment Programme</h1>
            <p className="text-muted-foreground">Manage recruiters, track placements, and handle commissions.</p>
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatMiniCard label="Pending Applications" value={stats.pendingApps} icon={Search} color="text-orange-500" />
          <StatMiniCard label="Active Recruiters" value={stats.totalRecruiters} icon={UserCheck} color="text-green-500" />
          <StatMiniCard label="Pending Payouts" value={stats.pendingPayouts} icon={Wallet} color="text-blue-500" />
          <StatMiniCard label="Total Paid (R)" value={`R${stats.totalPaid.toFixed(0)}`} icon={Trophy} color="text-primary" />
        </div>

        <Tabs defaultValue="apps" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="apps" className="px-6">Applications ({stats.pendingApps})</TabsTrigger>
            <TabsTrigger value="refs" className="px-6">Placements & Referrals ({refs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="apps">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Recruiter Applications</CardTitle>
                  <CardDescription>Review and approve new recruiter requests.</CardDescription>
                </div>
                <div className="w-64">
                  <Input
                    placeholder="Search apps..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : filteredApps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 border-2 border-dashed rounded-lg">No matching applications found.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Recruiter</TableHead>
                          <TableHead>Contact & Social</TableHead>
                          <TableHead>Location/Area</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredApps.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div className="font-bold">{a.full_name}</div>
                              <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{a.email}</div>
                              <div className="text-xs text-muted-foreground">{a.phone || a.whatsapp_number}</div>
                              {a.social_media_link && (
                                <a href={a.social_media_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block truncate max-w-[150px]">
                                  {a.social_media_link}
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{a.recruitment_area}</div>
                              <div className="text-xs text-muted-foreground">{a.city}, {a.province}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={a.status==='approved' ? 'default' : a.status==='rejected' ? 'destructive' : 'outline'}>
                                {a.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {a.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => approve(a.id)} className="h-8">Approve</Button>
                                  <Button size="sm" variant="outline" onClick={() => reject(a.id)} className="h-8">Reject</Button>
                                </div>
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
          </TabsContent>

          <TabsContent value="refs">
            <Card>
              <CardHeader>
                <CardTitle>Accommodation Referrals</CardTitle>
                <CardDescription>Verify student placements and approve payouts.</CardDescription>
              </CardHeader>
              <CardContent>
                {refs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 border-2 border-dashed rounded-lg">No referrals tracked yet.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Residence</TableHead>
                          <TableHead>Recruiter</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead className="text-right">Payout Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {refs.map((r) => (
                          <TableRow key={r.application_id}>
                            <TableCell>
                              <div className="font-bold">{r.student_name || '—'}</div>
                              <div className="text-xs text-muted-foreground">{r.student_number || 'No student #'}</div>
                            </TableCell>
                            <TableCell>{r.residence_name || '—'}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{r.agent_name || '—'}</div>
                              <div className="text-[10px] text-muted-foreground">{r.agent_email}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.referral_code}</TableCell>
                            <TableCell>
                              <Badge className={
                                r.referral_status === 'approved' ? 'bg-green-500' :
                                r.referral_status === 'paid' ? 'bg-primary' :
                                r.referral_status === 'rejected' ? 'bg-destructive' : 'bg-orange-500'
                              }>
                                {r.referral_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold">R{Number(r.commission_amount).toFixed(0)}</TableCell>
                            <TableCell className="text-right space-x-1">
                              {r.referral_status === 'submitted' && (
                                <Button size="sm" variant="outline" onClick={() => mark(r.application_id, 'verified')} className="h-7 text-[10px]">Verify</Button>
                              )}
                              {(r.referral_status === 'submitted' || r.referral_status === 'verified') && (
                                <Button size="sm" variant="outline" onClick={() => mark(r.application_id, 'approved')} className="h-7 text-[10px]">Approve Payout</Button>
                              )}
                              {r.referral_status === 'approved' && (
                                <Button size="sm" onClick={() => mark(r.application_id, 'paid')} className="h-7 text-[10px]">Mark Paid</Button>
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
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

function StatMiniCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRecruitmentProgramme() {
  return <AdminLayout><AdminRecruitmentProgrammeContent /></AdminLayout>;
}
