import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { 
  ArrowLeft, User, Calendar, FileText, MessageSquare, Clock,
  CheckCircle, XCircle, AlertCircle, Download, Send, Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  student_profile: any;
  profiles: { 
    full_name: string; 
    email: string; 
    phone: string | null;
    student_number: string | null;
    campus: string | null;
    course: string | null;
  } | null;
}

interface Message {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action_type: string;
  actor_type: string;
  metadata: any;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'docs_required', label: 'Request Documents', icon: FileText },
  { value: 'under_review', label: 'Under Review', icon: Clock },
  { value: 'provisionally_approved', label: 'Provisionally Approve', icon: CheckCircle },
  { value: 'declined', label: 'Decline', icon: XCircle },
];

const MESSAGE_TEMPLATES = [
  { 
    label: 'Request Missing Documents', 
    message: 'Dear Applicant,\n\nThank you for your application. To proceed with your application, we require the following documents:\n\n- [List documents]\n\nPlease upload these at your earliest convenience.\n\nRegards,\nThe Residence Team' 
  },
  { 
    label: 'Under Review Notice', 
    message: 'Dear Applicant,\n\nYour application is now under review. We will notify you once a decision has been made.\n\nThank you for your patience.\n\nRegards,\nThe Residence Team' 
  },
  { 
    label: 'Provisional Approval', 
    message: 'Dear Applicant,\n\nCongratulations! Your application has been provisionally approved.\n\nPlease ensure you bring the following original documents when you arrive:\n- South African ID\n- Proof of Registration\n- NSFAS Confirmation (if applicable)\n\nWe look forward to welcoming you.\n\nRegards,\nThe Residence Team' 
  },
  { 
    label: 'Decline Notice', 
    message: 'Dear Applicant,\n\nThank you for your interest in our residence. After careful consideration, we regret to inform you that we are unable to accommodate your application at this time.\n\nWe encourage you to explore other accommodation options.\n\nRegards,\nThe Residence Team' 
  },
];

const ResidenceApplicationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidenceContext>();
  
  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const [newMessage, setNewMessage] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [statusNotes, setStatusNotes] = useState("");

  useEffect(() => {
    if (!id || !residence?.id) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch application
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('id, status, funding_type, created_at, updated_at, desired_move_in, notes, student_profile, user_id')
          .eq('id', id)
          .eq('residence_id', residence.id)
          .single();

        if (appError) throw appError;
        
        // Fetch profile separately
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, student_number, campus, course')
          .eq('id', appData.user_id)
          .single();
        
        setApplication({ ...appData, profiles: profile } as Application);

        // Log view activity
        await supabase.from('application_activity_log').insert({
          application_id: id,
          residence_id: residence.id,
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          actor_type: 'residence',
          action_type: 'viewed',
          metadata: {}
        });

        // Fetch messages
        const { data: msgData } = await supabase
          .from('application_messages')
          .select('*')
          .eq('application_id', id)
          .order('created_at', { ascending: true });
        setMessages(msgData || []);

        // Fetch activity log
        const { data: logData } = await supabase
          .from('application_activity_log')
          .select('*')
          .eq('application_id', id)
          .order('created_at', { ascending: false })
          .limit(20);
        setActivityLog(logData || []);

      } catch (err) {
        console.error('Error fetching application:', err);
        toast.error('Failed to load application');
        navigate('/residence/inbox');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to message changes
    const channel = supabase
      .channel(`application-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'application_messages', filter: `application_id=eq.${id}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, residence?.id, navigate]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !application) return;
    
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('application_messages').insert({
        application_id: application.id,
        residence_id: residence!.id,
        sender_type: 'residence',
        sender_user_id: user?.id,
        message: newMessage.trim()
      });

      if (error) throw error;
      
      setNewMessage("");
      toast.success('Message sent');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus || !application) return;
    
    setIsUpdatingStatus(true);
    try {
      const { invokeEdgeFunction } = await import('@/lib/lovableFunctions');
      const response = await invokeEdgeFunction<{ referral_claim_created?: boolean }>('update-application-status', {
        application_id: application.id,
        new_status: selectedStatus,
        notes: statusNotes || undefined,
      });
      if (response.error) throw new Error(response.error.message);

      toast.success(`Application ${selectedStatus.replace('_', ' ')}`);
      
      // Refresh application data
      const { data } = await supabase
        .from('applications')
        .select('id, status, funding_type, created_at, updated_at, desired_move_in, notes, student_profile, user_id')
        .eq('id', application.id)
        .single();
      
      if (data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, student_number, campus, course')
          .eq('id', data.user_id)
          .single();
        setApplication({ ...data, profiles: profile } as Application);
      }
      
      setShowStatusDialog(false);
      setSelectedStatus("");
      setStatusNotes("");
      
      // Show referral claim notice if applicable
      if (response.data?.referral_claim_created) {
        toast.info('NSFAS referral claim has been created and will be tracked by ResKonnect.');
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error(err.message || 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'new': { label: 'New', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      'submitted': { label: 'Submitted', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      'docs_required': { label: 'Docs Required', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      'under_review': { label: 'Under Review', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      'provisionally_approved': { label: 'Provisionally Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      'declined': { label: 'Declined', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={`${config.className} text-sm px-3 py-1`}>{config.label}</Badge>;
  };

  const getRefCode = (id: string) => id.replace(/-/g, '').substring(0, 8).toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Application not found</p>
        <Button variant="link" onClick={() => navigate('/residence/inbox')}>
          Back to Inbox
        </Button>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`Application ${getRefCode(application.id)} | ResKonnect`}
        description="Review and manage application"
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/residence/inbox')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{application.profiles?.full_name || 'Unknown Applicant'}</h1>
                {getStatusBadge(application.status)}
              </div>
              <p className="text-muted-foreground">
                Ref: {getRefCode(application.id)} • Applied {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <Button onClick={() => setShowStatusDialog(true)}>
            Update Status
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Applicant Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Applicant Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{application.profiles?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{application.profiles?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{application.profiles?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Student Number</p>
                  <p className="font-medium">{application.profiles?.student_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Campus</p>
                  <p className="font-medium">{application.profiles?.campus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Course</p>
                  <p className="font-medium">{application.profiles?.course || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Funding Type</p>
                  <Badge variant="outline" className="mt-1">
                    {application.funding_type?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Desired Move-in</p>
                  <p className="font-medium">
                    {application.desired_move_in 
                      ? new Date(application.desired_move_in).toLocaleDateString()
                      : 'Not specified'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Messaging */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messages
                </CardTitle>
                <CardDescription>
                  Communicate with the applicant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Message Thread */}
                <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-muted/30 rounded-lg">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No messages yet
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`p-3 rounded-lg max-w-[85%] ${
                          msg.sender_type === 'residence' 
                            ? 'bg-primary text-primary-foreground ml-auto' 
                            : msg.sender_type === 'system'
                            ? 'bg-muted mx-auto text-center text-sm'
                            : 'bg-card border'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_type === 'residence' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {msg.sender_type === 'system' ? 'System' : msg.sender_type === 'residence' ? 'You' : 'Applicant'} • {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Template Selector */}
                <Select onValueChange={(val) => setNewMessage(MESSAGE_TEMPLATES.find(t => t.label === val)?.message || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Use a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TEMPLATES.map((template) => (
                      <SelectItem key={template.label} value={template.label}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Message Input */}
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() || isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {STATUS_OPTIONS.map((option) => (
                  <Button 
                    key={option.value}
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedStatus(option.value);
                      setShowStatusDialog(true);
                    }}
                    disabled={application.status === option.value}
                  >
                    <option.icon className="mr-2 h-4 w-4" />
                    {option.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {activityLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  ) : (
                    activityLog.map((log) => (
                      <div key={log.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium capitalize">
                            {log.action_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {log.actor_type} • {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* NSFAS Warning */}
            {application.funding_type === 'nsfas' && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-purple-600 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-purple-900 dark:text-purple-100">NSFAS Funded Application</p>
                      <p className="text-purple-700 dark:text-purple-300 mt-1">
                        Approving this application will create a referral claim tracked by ResKonnect for NSFAS billing.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Application Status</DialogTitle>
            <DialogDescription>
              {selectedStatus === 'provisionally_approved' && application.funding_type === 'nsfas' 
                ? 'This will create an NSFAS referral claim that will be tracked by ResKonnect.'
                : 'Change the status of this application. The applicant will be notified.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Add notes (optional)"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
            />

            {selectedStatus === 'provisionally_approved' && application.funding_type === 'nsfas' && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  ⚠️ NSFAS Referral Claim Notice
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  A referral claim will be automatically created and tracked. Payment will be processed when NSFAS releases funds.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange} 
              disabled={!selectedStatus || isUpdatingStatus}
            >
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResidenceApplicationDetail;
