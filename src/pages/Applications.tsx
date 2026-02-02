import SEO from "@/components/SEO";
import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Eye, Search, Filter, X, AlertCircle, FileText, Upload, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

interface UserDocument {
  id: string;
  document_type: string;
}

const Applications = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);

  // Fetch user's uploaded documents
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("documents")
        .select("id, document_type")
        .eq("user_id", user.id);
      setUserDocuments(data || []);
    };
    fetchDocuments();
  }, [user]);

  const requiredDocTypes = ["student_card", "proof_of_registration"];
  const hasRequiredDocs = requiredDocTypes.every(type =>
    userDocuments.some(doc => doc.document_type === type)
  );

  useEffect(() => {
    const fetchDetails = async () => {
      if (applicationsLoading || !applications.length) {
        setLoading(applicationsLoading);
        if (!applications.length) setDetailedApplications([]);
        return;
      }

      setLoading(true);
      const residenceIds = [...new Set(applications.map(app => app.residence_id))];
      const { data: residences, error: resError } = await supabase
        .from('residences')
        .select('*')
        .in('id', residenceIds);

      if (resError) {
        console.error("Error fetching residence details:", resError);
        setLoading(false);
        return;
      }

      const detailed = applications.map(app => {
        const residence = residences.find(res => res.id === app.residence_id);
        return { ...app, residence };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDetailedApplications(detailed);
      setLoading(false);
    };

    fetchDetails();
  }, [applications, applicationsLoading]);

  const filteredApplications = useMemo(() => detailedApplications.filter(app => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm ? app.residence?.name.toLowerCase().includes(searchTermLower) : true;
      const matchesStatus = statusFilter !== "all" ? app.status === statusFilter : true;
      const matchesRoomType = roomTypeFilter !== "all" ? app.residence?.room_type === roomTypeFilter : true;
      return matchesSearch && matchesStatus && matchesRoomType;
  }), [detailedApplications, searchTerm, statusFilter, roomTypeFilter]);
  
  const resetFilter = (filter: 'status' | 'room' | 'search') => {
      if (filter === 'status') setStatusFilter('all');
      if (filter === 'room') setRoomTypeFilter('all');
      if (filter === 'search') setSearchTerm('');
      toast.info(`Cleared ${filter} filter.`);
  }

  const getStatusProps = (status: string) => {
    switch (status) {
      case "submitted": return { Icon: Clock, color: "yellow", label: "Pending", step: 1 };
      case "under_review": return { Icon: Clock, color: "blue", label: "Under Review", step: 1 };
      case "documents_required": return { Icon: AlertCircle, color: "orange", label: "Documents Required", step: 1 };
      case "approved": return { Icon: CheckCircle2, color: "green", label: "Approved", step: 2 };
      case "rejected": return { Icon: XCircle, color: "red", label: "Rejected", step: 2 };
      case "waitlisted": return { Icon: Clock, color: "purple", label: "Waitlisted", step: 1 };
      case "cancelled": return { Icon: XCircle, color: "gray", label: "Cancelled", step: 2 };
      default: return { Icon: Clock, color: "gray", label: status || "Unknown", step: 0 };
    }
  };
  
  const ApplicationCard = ({ application }: { application: any }) => {
      const { Icon, color, label, step } = getStatusProps(application.status);
      const steps = ["Submitted", "Decision"];
      const [downloadingSlip, setDownloadingSlip] = useState(false);

      const handleDownloadSlip = async () => {
        setDownloadingSlip(true);
        try {
          const { data, error } = await supabase.functions.invoke('generate-booking-slip', {
            body: { application_id: application.id }
          });
          if (error) throw error;
          // Open HTML in new tab
          const blob = new Blob([data], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          toast.success('Booking slip generated!');
        } catch (err: any) {
          toast.error(err.message || 'Failed to generate booking slip');
        } finally {
          setDownloadingSlip(false);
        }
      };

      return (
        <Card className={`bg-card shadow-sm hover:shadow-xl transition-all duration-300 border-l-4 border-${color}-500 animate-fade-in`}>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <CardTitle className="text-foreground">{application.residence?.name}</CardTitle>
                        <CardDescription>{application.residence?.address}</CardDescription>
                    </div>
                    <Badge variant="outline" className={`border-${color}-500/50 bg-${color}-500/10 text-${color}-700 shrink-0`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2 px-1">
                        {steps.map((s, i) => <span key={i} className={i + 1 <= step ? `text-${color}-600 font-semibold` : ""}>{s}</span>)}
                    </div>
                    <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                        <div className={`absolute top-0 left-0 h-1.5 bg-${color}-500 rounded-full transition-all duration-500`} style={{ width: `${(step / (steps.length -1)) * 100}%` }}></div>
                    </div>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Applied on {new Date(application.created_at).toLocaleDateString()}
                </div>
                
                {/* Document Status Indicator */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {hasRequiredDocs ? (
                    <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700">
                      <FileText className="w-3 h-3 mr-1" />
                      Documents Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-orange-500/50 bg-orange-500/10 text-orange-700">
                      <Upload className="w-3 h-3 mr-1" />
                      Documents Missing
                    </Badge>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                    <Button asChild variant="outline" aria-label={`View details for ${application.residence?.name}`}>
                      <Link to={`/res/${application.residence_id}`}>View Details</Link>
                    </Button>
                    {!hasRequiredDocs && (
                      <Button asChild variant="secondary" size="sm">
                        <Link to="/documents">
                          <Upload className="w-4 h-4 mr-1" />
                          Upload Docs
                        </Link>
                      </Button>
                    )}
                    {/* Booking Slip Download */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadSlip}
                      disabled={downloadingSlip}
                    >
                      {downloadingSlip ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Booking Slip
                    </Button>
                </div>
            </CardContent>
        </Card>
      )
  }

  const SkeletonLoader = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card shadow-sm animate-pulse" aria-hidden="true">
                <CardHeader><div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div><div className="h-4 mt-2 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div></CardHeader>
                <CardContent><div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div><div className="mt-4 pt-4 border-t h-8 bg-gray-300 dark:bg-gray-600 rounded w-24"></div></CardContent>
            </Card>
        ))}
    </div>
  );

  return (
    <DashboardLayout>
      <SEO
        title="Track Your Applications | ResKonnect"
        description="Stay updated on the status of your student accommodation applications."
      />
      <div className="p-4 md:p-8 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/dashboard">Dashboard</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink>Applications</BreadcrumbLink>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
            <h1 className="text-3xl font-bold mb-2 text-foreground">My Applications</h1>
            <p className="text-muted-foreground">Track your residence applications and their status.</p>
          </div>

          <Card className="p-4 sm:p-6 sticky top-2 z-10 bg-card/80 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <label htmlFor="search-applications" className="sr-only">Search by residence</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input id="search-applications" aria-label="Search by residence name" placeholder="Search by residence name..." className="pl-10 h-11" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1"><label htmlFor="status-filter" className="sr-only">Filter by status</label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger id="status-filter" className="h-11" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="submitted">Pending</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="documents_required">Documents Required</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="waitlisted">Waitlisted</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
                    <div className="flex-1"><label htmlFor="room-type-filter" className="sr-only">Filter by room type</label><Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}><SelectTrigger id="room-type-filter" className="h-11" aria-label="Filter by room type"><SelectValue placeholder="Room Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Room Types</SelectItem><SelectItem value="single">Single</SelectItem><SelectItem value="shared">Shared</SelectItem><SelectItem value="apartment">Apartment</SelectItem></SelectContent></Select></div>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
                {searchTerm && <Badge variant="secondary" className="pl-2.5">Search: "{searchTerm}" <Button onClick={() => resetFilter('search')} variant="ghost" size="icon" className="h-5 w-5 ml-1"><X className="w-3 h-3"/></Button></Badge>}
                {statusFilter !== "all" && <Badge variant="secondary" className="pl-2.5 capitalize">Status: {statusFilter} <Button onClick={() => resetFilter('status')} variant="ghost" size="icon" className="h-5 w-5 ml-1"><X className="w-3 h-3"/></Button></Badge>}
                {roomTypeFilter !== "all" && <Badge variant="secondary" className="pl-2.5 capitalize">Room: {roomTypeFilter} <Button onClick={() => resetFilter('room')} variant="ghost" size="icon" className="h-5 w-5 ml-1"><X className="w-3 h-3"/></Button></Badge>}
            </div>
          </Card>
          
          {loading ? <SkeletonLoader /> : filteredApplications.length === 0 ? (
            <Card className="bg-card shadow-sm text-center py-16 transition-all">
              <Eye className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Applications Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Your search or filter returned no results. Try adjusting your filters.</p>
              <Button variant="link" onClick={() => { resetFilter('status'); resetFilter('room'); resetFilter('search');}}>Clear all filters</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((application) => <ApplicationCard key={application.id} application={application} />)}
            </div>
          )}
           <Card className="bg-card/50 mt-8">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Manage Your Applications</h3>
                    <p className="text-muted-foreground text-sm">
                    Your student accommodation applications are displayed here with real-time status, step tracking, and simplified management. ResKonnect provides a centralized place to monitor your application progress, ensuring you never miss an update from a landlord. Stay organized and in control of your housing search.
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Applications;
