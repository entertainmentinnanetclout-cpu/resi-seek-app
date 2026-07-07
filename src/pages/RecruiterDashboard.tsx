import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // recruiter_dashboard_v and recruiter_applicants_v are already filtered by program_key = 'student_recruitment'
      const [{ data: s }, { data: a }] = await Promise.all([
        supabase.from("recruiter_dashboard_v" as any).select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("recruiter_applicants_v" as any).select("*").eq("referral_agent_user_id", user.id).order("referred_at", { ascending: false }),
      ]);
      setStats(s || null);
      setApplicants(a || []);
      setLoading(false);
    })();
  }, [user]);

  const link = stats?.code ? `${window.location.origin}/r/${stats.code}` : "";
  const approved = Number(stats?.approved_count || 0);
  const bonusTarget = 10;
  const bonusProgress = Math.min(100, (approved / bonusTarget) * 100);

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <DashboardLayout>
      <SEO title="Recruiter Dashboard | ResKonnect" description="Track referrals and commissions." />
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="w-7 h-7 text-primary" /> Recruiter Dashboard</h1>
            <p className="text-muted-foreground">Refer students, earn R200 per successful placement, R3,000 bonus for 10 approved referrals.</p>
          </div>
          {stats?.badge_level && (
            <Badge className="text-sm px-3 py-1 bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Trophy className="w-4 h-4 mr-1" /> {String(stats.badge_level).toUpperCase()} Recruiter
            </Badge>
          )}
        </div>

        {!loading && !stats && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">You are not an approved recruiter yet. Apply from the Recruitment Programme page.</CardContent></Card>
        )}

        {stats && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Your referral link</CardTitle>
                <CardDescription>Share this to earn on every successful placement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input readOnly value={stats.code} className="font-mono font-semibold uppercase" />
                  <Button variant="outline" onClick={() => copy(stats.code)}><Copy className="w-4 h-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={link} />
                  <Button variant="outline" onClick={() => copy(link)}><Copy className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Clicks" value={stats.total_clicks} />
              <StatCard label="Signups" value={stats.total_signups} />
              <StatCard label="Applications" value={stats.total_applications} />
              <StatCard label="Approved" value={stats.approved_count} />
              <StatCard label="Pending R" value={`R${Number(stats.pending_commission).toFixed(0)}`} />
              <StatCard label="Approved R" value={`R${Number(stats.approved_commission).toFixed(0)}`} />
              <StatCard label="Paid R" value={`R${Number(stats.paid_commission).toFixed(0)}`} />
              <StatCard label="Verified" value={stats.verified_count} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bonus tracker</CardTitle>
                <CardDescription>{approved} / {bonusTarget} approved referrals — unlock R3,000 bonus</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${bonusProgress}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Referred applicants</CardTitle></CardHeader>
              <CardContent>
                {applicants.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No referred applicants yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Residence</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>App Status</TableHead>
                        <TableHead>Referral</TableHead>
                        <TableHead className="text-right">R</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applicants.map((a) => (
                        <TableRow key={a.application_id}>
                          <TableCell>{a.student_name || "—"}</TableCell>
                          <TableCell>{a.residence_name || "—"}</TableCell>
                          <TableCell>{new Date(a.application_date).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant="outline">{a.application_status}</Badge></TableCell>
                          <TableCell><Badge>{a.referral_status}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">R{Number(a.commission_amount).toFixed(0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="p-4 text-center">
      <p className="text-2xl font-bold">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}