import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertCircle, Phone, Clock, CheckCircle, Home, Search, Download, Loader2, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadVCard, downloadEnhancedCSV, generateCallList } from "@/lib/exportHelpers";
import StudentContactCard from "@/components/admin/StudentContactCard";

interface FollowUpStudent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  campus: string | null;
  studentNumber: string | null;
  residenceApplied: string | null;
  status: string;
  applicationDate: string;
  documentsCount: number;
  daysSinceApplication: number;
  priority: 'urgent' | 'high' | 'normal';
  reason: string;
  applicationId: string;
  moveInConfirmed?: boolean;
  movedIn?: boolean;
}

const AdminFollowUp = () => {
  const [students, setStudents] = useState<FollowUpStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("urgent");

  const fetchFollowUpData = async () => {
    try {
      // Fetch ALL applications with residence data
      const { data: applications, error: appError } = await supabase
        .from("applications")
        .select(`
          id,
          user_id,
          status,
          application_date,
          move_in_confirmed,
          moved_in,
          residence:residences(name)
        `)
        .order("application_date", { ascending: false });

      if (appError) throw appError;

      // Fetch all profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, campus, student_number");

      if (profileError) throw profileError;

      // Fetch document counts per user
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("user_id");

      if (docError) throw docError;

      // Create profile lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // Count documents per user
      const docCounts = new Map<string, number>();
      documents?.forEach(doc => {
        docCounts.set(doc.user_id, (docCounts.get(doc.user_id) || 0) + 1);
      });

      // Map ALL applications (no restrictive filter)
      const now = new Date();
      const followUpStudents: FollowUpStudent[] = (applications || [])
        .map(app => {
          const profile = profileMap.get(app.user_id);
          const appDate = new Date(app.application_date);
          const daysSinceApplication = Math.floor((now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let priority: 'urgent' | 'high' | 'normal' = 'normal';
          let reason = '';

          // Priority logic - GOD MODE: includes all, prioritizes appropriately
          if (app.status === 'approved' && !app.move_in_confirmed && daysSinceApplication > 7) {
            priority = 'urgent';
            reason = 'Approved 7+ days ago - confirm move-in';
          } else if (app.status === 'documents_required') {
            priority = 'urgent';
            reason = 'Documents required';
          } else if (app.status === 'rejected') {
            priority = 'normal';
            reason = 'Application rejected';
          } else if ((app.status === 'submitted' || app.status === 'pending') && daysSinceApplication > 5) {
            priority = 'high';
            reason = 'Pending > 5 days';
          } else if (app.status === 'approved' && !app.moved_in) {
            priority = 'normal';
            reason = 'Track move-in';
          } else if (app.status === 'submitted' || app.status === 'pending') {
            priority = 'normal';
            reason = 'Pending review';
          } else if (app.status === 'approved' && app.moved_in) {
            priority = 'normal';
            reason = 'Moved in ✓';
          } else {
            reason = app.status;
          }

          return {
            id: profile?.id || app.user_id,
            name: profile?.full_name || 'Unknown Student',
            phone: profile?.phone || null,
            email: profile?.email || null,
            campus: profile?.campus || null,
            studentNumber: profile?.student_number || null,
            residenceApplied: app.residence?.name || 'Unknown Residence',
            status: app.status,
            applicationDate: app.application_date,
            documentsCount: docCounts.get(app.user_id) || 0,
            daysSinceApplication,
            priority,
            reason,
            applicationId: app.id,
            moveInConfirmed: app.move_in_confirmed,
            movedIn: app.moved_in,
          };
        });

      setStudents(followUpStudents);
    } catch (error) {
      console.error("Error fetching follow-up data:", error);
      toast.error("Failed to load follow-up data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUpData();

    const channel = supabase
      .channel("follow-up-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, fetchFollowUpData)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_logs" }, fetchFollowUpData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.residenceApplied?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.campus?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const urgentStudents = filteredStudents.filter(s => s.priority === 'urgent');
  const highStudents = filteredStudents.filter(s => s.priority === 'high');
  const normalStudents = filteredStudents.filter(s => s.priority === 'normal');
  const approvedStudents = filteredStudents.filter(s => s.status === 'approved');

  const handleExportVCard = () => {
    const tabStudents = activeTab === 'urgent' ? urgentStudents :
                        activeTab === 'high' ? highStudents :
                        activeTab === 'approved' ? approvedStudents : normalStudents;
    
    downloadVCard(tabStudents.map(s => ({
      name: s.name,
      phone: s.phone,
      email: s.email,
      campus: s.campus,
      studentNumber: s.studentNumber,
      residenceApplied: s.residenceApplied,
      status: s.status,
    })));
    toast.success("vCard exported - import to your phone contacts");
  };

  const handleExportCSV = () => {
    const tabStudents = activeTab === 'urgent' ? urgentStudents :
                        activeTab === 'high' ? highStudents :
                        activeTab === 'approved' ? approvedStudents : normalStudents;
    
    downloadEnhancedCSV(tabStudents.map(s => ({
      name: s.name,
      phone: s.phone,
      email: s.email,
      campus: s.campus,
      studentNumber: s.studentNumber,
      residenceApplied: s.residenceApplied,
      status: s.status,
      applicationDate: s.applicationDate,
      documentsCount: s.documentsCount,
    })));
    toast.success("CSV exported");
  };

  const updateMoveInStatus = async (applicationId: string, field: 'move_in_confirmed' | 'moved_in', value: boolean) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ [field]: value })
        .eq("id", applicationId);

      if (error) throw error;
      toast.success("Status updated");
      fetchFollowUpData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const renderStudentList = (studentList: FollowUpStudent[]) => {
    if (studentList.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No students in this category</p>
          <p className="text-sm mt-2">Students will appear here when they submit applications</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/admin/applications'}>
            View All Applications
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {studentList.map((student) => (
          <div key={`${student.applicationId}`}>
            <StudentContactCard
              student={student}
              onLogSuccess={fetchFollowUpData}
            />
            {student.status === 'approved' && (
              <div className="flex gap-2 mt-2 ml-4">
                <Button
                  size="sm"
                  variant={student.moveInConfirmed ? "default" : "outline"}
                  onClick={() => updateMoveInStatus(student.applicationId, 'move_in_confirmed', !student.moveInConfirmed)}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  {student.moveInConfirmed ? 'Move-in Confirmed ✓' : 'Confirm Move-in'}
                </Button>
                <Button
                  size="sm"
                  variant={student.movedIn ? "default" : "outline"}
                  className={student.movedIn ? "bg-success hover:bg-success/90" : ""}
                  onClick={() => updateMoveInStatus(student.applicationId, 'moved_in', !student.movedIn)}
                >
                  <Home className="w-3 h-3 mr-1" />
                  {student.movedIn ? 'Moved In ✓' : 'Mark Moved In'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <SEO title="Student Follow-Up | Admin" description="Smart student follow-up system" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Student Follow-Up</h1>
            <p className="text-muted-foreground">GOD MODE: Smart prioritized call list</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportVCard}>
              <Phone className="w-4 h-4 mr-2" />
              Export vCard
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-destructive/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{urgentStudents.length}</p>
                  <p className="text-sm text-muted-foreground">Urgent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{highStudents.length}</p>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{approvedStudents.length}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedStudents.filter(s => s.movedIn).length}</p>
                  <p className="text-sm text-muted-foreground">Moved In</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, residence, or campus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="urgent" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                Urgent ({urgentStudents.length})
              </TabsTrigger>
              <TabsTrigger value="high" className="gap-1">
                <Clock className="w-3 h-3" />
                High ({highStudents.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Approved ({approvedStudents.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1">
                <Users className="w-3 h-3" />
                All ({filteredStudents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="urgent" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">🚨 Urgent Follow-Ups</CardTitle>
                  <CardDescription>These students need immediate attention</CardDescription>
                </CardHeader>
                <CardContent>{renderStudentList(urgentStudents)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="high" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-warning">⚠️ High Priority</CardTitle>
                  <CardDescription>Applications pending for extended periods</CardDescription>
                </CardHeader>
                <CardContent>{renderStudentList(highStudents)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-success">✅ Move-In Tracking</CardTitle>
                  <CardDescription>Track approved students through move-in</CardDescription>
                </CardHeader>
                <CardContent>{renderStudentList(approvedStudents)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Follow-Ups</CardTitle>
                  <CardDescription>Complete list of actionable students</CardDescription>
                </CardHeader>
                <CardContent>{renderStudentList(filteredStudents)}</CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFollowUp;
