import { useState } from "react";
import { Building2, Users, FileText, Home, Settings, LogOut, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Admin = () => {
  const navigate = useNavigate();
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Mock data
  const stats = {
    totalApplications: 45,
    pendingReview: 12,
    approved: 28,
    rejected: 5,
    totalResidences: 8,
    totalStudents: 150
  };

  const applications = [
    {
      id: 1,
      studentName: "John Doe",
      studentNumber: "u12345678",
      residence: "Campus Heights",
      status: "pending",
      date: "2025-10-08",
      email: "john@student.ac.za",
      phone: "+27 12 345 6789"
    },
    {
      id: 2,
      studentName: "Jane Smith",
      studentNumber: "u87654321",
      residence: "Student Village",
      status: "pending",
      date: "2025-10-07",
      email: "jane@student.ac.za",
      phone: "+27 12 345 6788"
    },
    {
      id: 3,
      studentName: "Mike Johnson",
      studentNumber: "u11223344",
      residence: "Brooklyn Residence",
      status: "approved",
      date: "2025-10-05",
      email: "mike@student.ac.za",
      phone: "+27 12 345 6787"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case "approved":
        return <Badge className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      default:
        return null;
    }
  };

  const handleViewApplication = (application: any) => {
    setSelectedApplication(application);
  };

  const handleStatusChange = (newStatus: string) => {
    // TODO: Update status in backend
    setSelectedApplication(null);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold">ResKonnect</span>
            </div>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Button variant="default" className="w-full justify-start">
              <Home className="w-5 h-5 mr-3" />
              Overview
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <FileText className="w-5 h-5 mr-3" />
              Applications
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Building2 className="w-5 h-5 mr-3" />
              Residences
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Users className="w-5 h-5 mr-3" />
              Students
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </Button>
          </nav>

          <div className="p-4 border-t">
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => navigate("/")}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Manage applications, residences, and student accounts
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {stats.totalApplications}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-warning mb-1">
                      {stats.pendingReview}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {stats.totalResidences}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Residences</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {stats.totalStudents}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Applications</CardTitle>
                    <CardDescription>Latest student applications for residences</CardDescription>
                  </div>
                  <Input placeholder="Search applications..." className="max-w-xs" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((application) => (
                    <div 
                      key={application.id}
                      className="p-4 border rounded-lg hover:bg-secondary/30 transition-smooth"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold">{application.studentName}</h4>
                            {getStatusBadge(application.status)}
                          </div>
                          <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Student #:</span> {application.studentNumber}
                            </div>
                            <div>
                              <span className="font-medium">Residence:</span> {application.residence}
                            </div>
                            <div>
                              <span className="font-medium">Date:</span> {new Date(application.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewApplication(application)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Application Detail Modal */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review and manage student application
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Student Name</p>
                    <p className="font-medium">{selectedApplication.studentName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Student Number</p>
                    <p className="font-medium">{selectedApplication.studentNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="font-medium">{selectedApplication.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <p className="font-medium">{selectedApplication.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Residence</p>
                    <p className="font-medium">{selectedApplication.residence}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Application Date</p>
                    <p className="font-medium">{new Date(selectedApplication.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Documents</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm">ID Copy</span>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm">Proof of Registration</span>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm">Proof of Funding</span>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => handleStatusChange("rejected")}
                >
                  Reject
                </Button>
                <Button 
                  variant="accent" 
                  className="flex-1"
                  onClick={() => handleStatusChange("approved")}
                >
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
