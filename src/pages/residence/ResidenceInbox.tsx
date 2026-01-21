import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useOutletContext } from "react-router-dom";
import { 
  Search, Filter, Download, CheckSquare, Square, 
  Clock, AlertCircle, CheckCircle, XCircle, FileText, Users,
  ChevronDown, MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

interface ResidenceContext {
  residence: { id: string; name: string } | null;
}

interface Application {
  id: string;
  status: string;
  funding_type: string;
  created_at: string;
  updated_at: string;
  desired_move_in: string | null;
  notes: string | null;
  profiles: { full_name: string; email: string; phone: string | null } | null;
  document_count?: number;
}

const STATUS_TABS = [
  { value: 'all', label: 'All', icon: Users },
  { value: 'new', label: 'New', icon: AlertCircle },
  { value: 'docs_required', label: 'Docs Required', icon: FileText },
  { value: 'under_review', label: 'Under Review', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle },
  { value: 'declined', label: 'Declined', icon: XCircle },
];

const ResidenceInbox = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { residence } = useOutletContext<ResidenceContext>();
  
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'all');

  useEffect(() => {
    if (!residence?.id) return;

    const fetchApplications = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('applications')
          .select('id, status, funding_type, created_at, updated_at, desired_move_in, notes, user_id')
          .eq('residence_id', residence.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Fetch profiles separately
        const userIds = [...new Set((data || []).map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        const appsWithProfiles = (data || []).map(app => ({
          ...app,
          profiles: profileMap.get(app.user_id) || null
        }));
        
        setApplications(appsWithProfiles as Application[]);
      } catch (err) {
        console.error('Error fetching applications:', err);
        toast.error('Failed to load applications');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();

    // Subscribe to changes
    const channel = supabase
      .channel('residence-inbox')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'applications',
          filter: `residence_id=eq.${residence.id}`
        },
        () => fetchApplications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [residence?.id]);

  // Filter applications
  const filteredApplications = applications.filter(app => {
    // Status filter
    if (activeTab !== 'all') {
      if (activeTab === 'new' && !['new', 'submitted'].includes(app.status)) return false;
      if (activeTab === 'approved' && !['provisionally_approved', 'approved'].includes(app.status)) return false;
      if (activeTab === 'declined' && !['declined', 'rejected'].includes(app.status)) return false;
      if (activeTab === 'under_review' && !['under_review', 'ready_for_review'].includes(app.status)) return false;
      if (activeTab === 'docs_required' && app.status !== 'docs_required') return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = app.profiles?.full_name?.toLowerCase() || '';
      const email = app.profiles?.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query) || app.id.includes(query);
    }

    return true;
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(value === 'all' ? {} : { status: value });
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map(a => a.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'new': { label: 'New', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      'submitted': { label: 'Submitted', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      'docs_required': { label: 'Docs Required', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      'ready_for_review': { label: 'Ready', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
      'under_review': { label: 'Under Review', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      'provisionally_approved': { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      'approved': { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      'declined': { label: 'Declined', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      'rejected': { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      'stale': { label: 'Stale', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getFundingBadge = (type: string) => {
    if (type === 'nsfas') {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 text-xs">NSFAS</Badge>;
    }
    if (type === 'bursary') {
      return <Badge variant="outline" className="text-xs">Bursary</Badge>;
    }
    if (type === 'private') {
      return <Badge variant="outline" className="text-xs">Private</Badge>;
    }
    return null;
  };

  const maskName = (name: string) => {
    if (!name) return 'Unknown';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return name;
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getTabCount = (tabValue: string) => {
    if (tabValue === 'all') return applications.length;
    if (tabValue === 'new') return applications.filter(a => ['new', 'submitted'].includes(a.status)).length;
    if (tabValue === 'approved') return applications.filter(a => ['provisionally_approved', 'approved'].includes(a.status)).length;
    if (tabValue === 'declined') return applications.filter(a => ['declined', 'rejected'].includes(a.status)).length;
    if (tabValue === 'under_review') return applications.filter(a => ['under_review', 'ready_for_review'].includes(a.status)).length;
    return applications.filter(a => a.status === tabValue).length;
  };

  if (!residence) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <>
      <SEO 
        title={`Applications Inbox | ${residence.name} | ResKonnect`}
        description="Manage residence applications"
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Applications Inbox</h1>
            <p className="text-muted-foreground">
              {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download ZIP
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <Badge variant="secondary" className="ml-1">
                  {getTabCount(tab.value)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Applications List */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center gap-4">
                  <Checkbox 
                    checked={selectedIds.size === filteredApplications.length && filteredApplications.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm font-medium text-muted-foreground flex-1">
                    Applicant
                  </span>
                  <span className="text-sm font-medium text-muted-foreground hidden md:block w-24">
                    Funding
                  </span>
                  <span className="text-sm font-medium text-muted-foreground hidden lg:block w-28">
                    Applied
                  </span>
                  <span className="text-sm font-medium text-muted-foreground w-28">
                    Status
                  </span>
                  <span className="w-8"></span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading applications...
                  </div>
                ) : filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No applications found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredApplications.map((app) => (
                      <div 
                        key={app.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return;
                          navigate(`/residence/application/${app.id}`);
                        }}
                      >
                        <Checkbox 
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {maskName(app.profiles?.full_name || 'Unknown')}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {app.id.substring(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>

                        <div className="hidden md:block w-24">
                          {getFundingBadge(app.funding_type)}
                        </div>

                        <div className="hidden lg:block w-28 text-sm text-muted-foreground">
                          {getTimeAgo(app.created_at)}
                        </div>

                        <div className="w-28">
                          {getStatusBadge(app.status)}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/residence/application/${app.id}`)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                              Download Documents
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
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

export default ResidenceInbox;
