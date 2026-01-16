import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Mail, User, Building2, FileText, Clock, ClipboardList } from "lucide-react";
import { formatPhoneNumber } from "@/lib/exportHelpers";
import CallLogDialog from "./CallLogDialog";

interface StudentContactCardProps {
  student: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    campus?: string | null;
    studentNumber?: string | null;
    residenceApplied?: string | null;
    status?: string | null;
    applicationDate?: string | null;
    documentsCount?: number;
    daysSinceApplication?: number;
    priority?: 'urgent' | 'high' | 'normal';
    reason?: string;
  };
  onLogSuccess?: () => void;
}

const StudentContactCard = ({ student, onLogSuccess }: StudentContactCardProps) => {
  const [showCallLog, setShowCallLog] = useState(false);
  const formattedPhone = formatPhoneNumber(student.phone);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'high': return 'bg-warning/20 text-warning border-warning/30';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-success/20 text-success';
      case 'rejected': return 'bg-destructive/20 text-destructive';
      case 'documents_required': return 'bg-warning/20 text-warning';
      case 'submitted':
      case 'pending': return 'bg-blue-500/20 text-blue-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hi ${student.name}, this is ResKonnect following up on your accommodation application${student.residenceApplied ? ` for ${student.residenceApplied}` : ''}. How can we assist you today?`
    );
    window.open(`https://wa.me/${formattedPhone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    window.open(`tel:${formattedPhone}`, '_self');
  };

  const handleEmail = () => {
    if (student.email) {
      window.open(`mailto:${student.email}?subject=ResKonnect Accommodation Update&body=Hi ${student.name},`, '_blank');
    }
  };

  return (
    <>
      <Card className={student.priority === 'urgent' ? 'border-destructive/50' : student.priority === 'high' ? 'border-warning/50' : ''}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Student Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium truncate">{student.name}</span>
                {student.priority && (
                  <Badge className={getPriorityColor(student.priority)} variant="outline">
                    {student.priority}
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {student.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span className="truncate">{formattedPhone}</span>
                  </div>
                )}
                {student.campus && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{student.campus}</span>
                  </div>
                )}
                {student.residenceApplied && (
                  <div className="flex items-center gap-1 col-span-2">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">Applied: {student.residenceApplied}</span>
                  </div>
                )}
                {student.documentsCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{student.documentsCount} docs</span>
                  </div>
                )}
                {student.daysSinceApplication !== undefined && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{student.daysSinceApplication} days ago</span>
                  </div>
                )}
              </div>

              {student.reason && (
                <p className="text-xs mt-2 text-warning">{student.reason}</p>
              )}

              {student.status && (
                <Badge className={`mt-2 ${getStatusColor(student.status)}`}>
                  {student.status.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 shrink-0">
              {student.phone && (
                <>
                  <Button size="sm" variant="outline" onClick={handleCall} title="Call">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={handleWhatsApp} title="WhatsApp">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </>
              )}
              {student.email && (
                <Button size="sm" variant="outline" onClick={handleEmail} title="Email">
                  <Mail className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="default" onClick={() => setShowCallLog(true)} title="Log Contact">
                <ClipboardList className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CallLogDialog
        open={showCallLog}
        onOpenChange={setShowCallLog}
        studentId={student.id}
        studentName={student.name}
        onSuccess={onLogSuccess}
      />
    </>
  );
};

export default StudentContactCard;
