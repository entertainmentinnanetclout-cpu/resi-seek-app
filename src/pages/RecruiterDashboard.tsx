import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Sparkles, Trophy, MousePointer2, UserCheck, FileText, CheckCircle2, Clock, Wallet, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useRealtimeProfile(user);
  const [stats, setStats] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
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
  const bonusUnlocked = approved >= bonusTarget;

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied to clipboard"); };

  if (loading) return <div className="p-8 text-center"><BarChart3 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="mt-2 text-muted-foreground">Loading performance data...</p></div>;

  return (
    <DashboardLayout>
      <SEO title="Recruiter Dashboard | ResKonnect" description="Track referrals and commissions." />
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 pb-24">

        <div className="flex items-center justify-between flex-wrap gap-4 bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile?.full_name || 'Recruiter'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-primary/5">{stats?.code || 'NO CODE'}</Badge>
                {stats?.status === 'approved' ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Active Recruiter</Badge>
                ) : (
                  <Badge variant="destructive">{stats?.status || 'Pending'}</Badge>
                )}
              </div>
            </div>
          </div>
          {stats?.badge_level && (
            <div className="flex flex-col items-end">
              <Badge className="text-sm px-4 py-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground border-none shadow-md">
                <Trophy className="w-4 h-4 mr-1.5" /> {String(stats.badge_level).toUpperCase()} RECRUITER
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">Level verified by ResKonnect</p>
            </div>
          )}
        </div>

        {!stats && (
          <Card className="border-dashed"><CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Verification Pending</h2>
              <p className="text-muted-foreground">You are not an approved recruiter yet. Our team is reviewing your application.</p>
              <Button onClick={() => navigate("/recruit")}>View Application Status</Button>
            </div>
          </CardContent></Card>
        )}

        {stats && (
          <>
            <Card className="border-primary/20 shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-6 py-3 border-b border-primary/10">
                <h2 className="font-semibold flex items-center gap-2"><MousePointer2 className="w-4 h-4" /> Your Referral Link</h2>
              </div>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">Share this link with students looking for accommodation. You earn R200 for every student who successfully moves in.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Recruiter Code</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={stats.code} className="font-mono font-bold uppercase bg-muted/30" />
                      <Button variant="outline" size="icon" onClick={() => copy(stats.code)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Full Referral URL</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={link} className="bg-muted/30" />
                      <Button variant="outline" size="icon" onClick={() => copy(link)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <PerformanceCard icon={MousePointer2} label="Total Clicks" value={stats.total_clicks} color="text-blue-500" />
              <PerformanceCard icon={UserCheck} label="Student Signups" value={stats.total_signups} color="text-purple-500" />
              <PerformanceCard icon={FileText} label="Res Applications" value={stats.total_applications} color="text-orange-500" />
              <PerformanceCard icon={CheckCircle2} label="Approved Placements" value={stats.approved_count} color="text-green-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-orange-500/5 border-orange-500/20">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Commission</p>
                    <p className="text-2xl font-bold text-orange-600">R{Number(stats.pending_commission).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved Commission</p>
                    <p className="text-2xl font-bold text-green-600">R{Number(stats.approved_commission).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-2xl font-bold text-primary">R{Number(stats.paid_commission).toFixed(0)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className={bonusUnlocked ? "border-primary shadow-md bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className={bonusUnlocked ? "text-primary w-5 h-5" : "text-muted-foreground w-5 h-5"} />
                      Student Recruitment Bonus
                    </CardTitle>
                    <CardDescription>Get 10 verified placements to unlock an additional R3,000 bonus.</CardDescription>
                  </div>
                  {bonusUnlocked && <Badge className="bg-primary text-primary-foreground animate-pulse">BONUS UNLOCKED</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span>Progress: {approved} / {bonusTarget} Placements</span>
                  <span>{Math.round(bonusProgress)}%</span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden border">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                    style={{ width: `${bonusProgress}%` }}
                  />
                </div>
                {bonusUnlocked ? (
                  <p className="mt-4 text-sm font-bold text-primary text-center">Congratulations! You've reached the target. ResKonnect admin will verify and process your R3,000 bonus.</p>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground text-center">Only "Approved" placements count towards the 10-student bonus goal.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Referred Students</CardTitle>
                  <CardDescription>Real-time status of students you've referred.</CardDescription>
                </div>
                <Badge variant="outline">{applicants.length} Total</Badge>
              </CardHeader>
              <CardContent>
                {applicants.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                    <p className="text-muted-foreground">No students have applied using your link yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Residence</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>App Status</TableHead>
                          <TableHead>Referral</TableHead>
                          <TableHead className="text-right font-bold">Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applicants.map((a) => (
                          <TableRow key={a.application_id} className="hover:bg-muted/50 transition-colors">
                            <TableCell>
                              <div className="font-medium">{a.student_name || "Anonymous"}</div>
                              <div className="text-xs text-muted-foreground font-mono">{a.student_number || "—"}</div>
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">{a.residence_name || "—"}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(a.application_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                {a.application_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`text-[10px] uppercase font-bold tracking-wider ${
                                  a.referral_status === 'approved' ? 'bg-green-500' :
                                  a.referral_status === 'paid' ? 'bg-primary' :
                                  a.referral_status === 'rejected' ? 'bg-destructive' : 'bg-orange-500'
                                }`}
                              >
                                {a.referral_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">
                              R{Number(a.commission_amount).toFixed(0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function PerformanceCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
        <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
