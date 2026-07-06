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

export const AdminRecruitmentProgrammeContent = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [refs, setRefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase.from("recruiter_applications" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("admin_referral_applications_v" as any).select("*").order("referred_at", { ascending: false }).limit(200),
    ]);
    setApps(a || []);
    setRefs(r || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    const { error } = await adminApproveRecruiter(id);
    if (error) return toast.error(error.message);
    toast.success("Recruiter approved");
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
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <>
      <SEO title="Recruitment Programme | Admin" description="Approve recruiters and manage referrals." />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Recruitment Programme</h1>
          <p className="text-muted-foreground">Approve recruiters, track referrals, mark commissions.</p>
        </div>
        <Tabs defaultValue="apps" className="space-y-4">
          <TabsList>
            <TabsTrigger value="apps">Recruiter Applications ({apps.filter(a=>a.status==='pending').length})</TabsTrigger>
            <TabsTrigger value="refs">Referrals ({refs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="apps">
            <Card>
              <CardHeader><CardTitle>Applications</CardTitle><CardDescription>Approve to grant recruiter access.</CardDescription></CardHeader>
              <CardContent>
                {loading ? "Loading…" : apps.length === 0 ? <p className="text-muted-foreground text-center py-8">No applications yet.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Area</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {apps.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.full_name}</TableCell>
                          <TableCell><div>{a.email}</div><div className="text-xs text-muted-foreground">{a.phone || a.whatsapp_number}</div></TableCell>
                          <TableCell>{a.recruitment_area}</TableCell>
                          <TableCell><Badge variant={a.status==='approved' ? 'default' : a.status==='rejected' ? 'destructive' : 'outline'}>{a.status}</Badge></TableCell>
                          <TableCell className="space-x-2">
                            {a.status === 'pending' && <>
                              <Button size="sm" onClick={() => approve(a.id)}>Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => reject(a.id)}>Reject</Button>
                            </>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="refs">
            <Card>
              <CardHeader><CardTitle>Referred applications</CardTitle></CardHeader>
              <CardContent>
                {refs.length === 0 ? <p className="text-muted-foreground text-center py-8">No referrals yet.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Student</TableHead><TableHead>Residence</TableHead><TableHead>Agent</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead>R</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {refs.map((r) => (
                        <TableRow key={r.application_id}>
                          <TableCell>{r.student_name || '—'}</TableCell>
                          <TableCell>{r.residence_name || '—'}</TableCell>
                          <TableCell>{r.agent_name || '—'}</TableCell>
                          <TableCell className="font-mono">{r.referral_code}</TableCell>
                          <TableCell><Badge>{r.referral_status}</Badge></TableCell>
                          <TableCell>R{Number(r.commission_amount).toFixed(0)}</TableCell>
                          <TableCell className="space-x-1">
                            <Button size="sm" variant="outline" onClick={() => mark(r.application_id, 'verified')}>Verify</Button>
                            <Button size="sm" variant="outline" onClick={() => mark(r.application_id, 'approved')}>Approve</Button>
                            <Button size="sm" onClick={() => mark(r.application_id, 'paid')}>Paid</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default function AdminRecruitmentProgramme() {
  return <AdminLayout><AdminRecruitmentProgrammeContent /></AdminLayout>;
}