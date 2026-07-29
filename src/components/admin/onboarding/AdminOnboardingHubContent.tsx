import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Mail, MessageSquare, UserCheck, ShieldCheck, Download, Trash, Search, ArrowRight } from "lucide-react";
import type { OnboardingRequest, OnboardingStatus, Persona, Need } from "@/lib/onboarding/onboardingTypes";
import { getOnboardingRequests, updateOnboardingRequestStatus, exportRequestsToCsv } from "@/lib/onboarding/onboardingAdapter";
import { PERSONA_LABELS, NEED_LABELS, STATUS_LABELS } from "@/lib/onboarding/onboardingTypes";

export const AdminOnboardingHub: React.FC = () => {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const list = await getOnboardingRequests();
    setRequests(list);
  };

  const handleUpdateStatus = async (id: string, nextStatus: OnboardingStatus) => {
    const updated = await updateOnboardingRequestStatus(id, nextStatus);
    if (updated) {
      toast.success(`Request status updated to: ${STATUS_LABELS[nextStatus]}`);
      loadRequests();
      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
    } else {
      toast.error("Failed to update request status.");
    }
  };

  const handleAssignStaff = async (id: string, staffName: string) => {
    const updated = await updateOnboardingRequestStatus(id, "in_review", { assigned_staff: staffName });
    if (updated) {
      toast.success(`Assigned request to ${staffName}`);
      loadRequests();
      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
    }
  };

  const handleAddNotes = async (id: string, notesText: string) => {
    const updated = await updateOnboardingRequestStatus(id, "in_review", { notes: notesText });
    if (updated) {
      toast.success("Notes saved.");
      loadRequests();
      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
    }
  };

  const handleExportCsv = () => {
    const csvContent = exportRequestsToCsv(filteredRequests);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `onboarding_requests_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file exported successfully.");
  };

  // Derivative metrics
  const totalRequests = requests.length;
  const newRequests = requests.filter((r) => r.status === "new").length;
  const inReviewRequests = requests.filter((r) => r.status === "in_review").length;
  const contactedRequests = requests.filter((r) => r.status === "contacted").length;
  const unassignedRequests = requests.filter((r) => !r.assigned_staff).length;
  const unclearRequests = requests.filter((r) => r.persona === "unsure").length;

  const parentsCount = requests.filter((r) => r.persona === "parent_guardian").length;
  const tenantsCount = requests.filter((r) => r.persona === "private_tenant").length;
  const appCount = requests.filter((r) => r.persona === "applicant" || r.need === "application_support").length;
  const wilCount = requests.filter((r) => r.persona === "wil_applicant" || r.need === "wil_support").length;
  const landlordCount = requests.filter((r) => r.persona === "landlord").length;
  const instCount = requests.filter((r) => r.persona === "institution_business").length;

  // Filter logic
  const filteredRequests = requests.filter((r) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      r.full_name.toLowerCase().includes(query) ||
      (r.phone || "").includes(query) ||
      (r.email || "").toLowerCase().includes(query);

    if (activeTab === "overview") return matchesSearch;
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "students") return matchesSearch && r.persona === "student";
    if (activeTab === "parents") return matchesSearch && r.persona === "parent_guardian";
    if (activeTab === "tenants") return matchesSearch && r.persona === "private_tenant";
    if (activeTab === "applications") return matchesSearch && (r.persona === "applicant" || r.need === "application_support");
    if (activeTab === "wil") return matchesSearch && (r.persona === "wil_applicant" || r.need === "wil_support");
    if (activeTab === "landlords") return matchesSearch && r.persona === "landlord";
    if (activeTab === "institutions") return matchesSearch && r.persona === "institution_business";
    if (activeTab === "unclear") return matchesSearch && r.persona === "unsure";

    return matchesSearch;
  });

  return (
    <div className="space-y-8 bg-slate-50/40 p-1 md:p-4 rounded-xl">
      {/* Metrics Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-800">Onboarding Intelligence</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Requests</span>
              <p className="text-2xl font-black text-slate-700">{totalRequests}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">New Requests</span>
              <p className="text-2xl font-black text-blue-600">{newRequests}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">Parents / Guardians</span>
              <p className="text-2xl font-black text-indigo-600">{parentsCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">Private Tenants</span>
              <p className="text-2xl font-black text-sky-600">{tenantsCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">App Support</span>
              <p className="text-2xl font-black text-emerald-600">{appCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">WIL Support</span>
              <p className="text-2xl font-black text-amber-600">{wilCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Needs Attention Alert metrics */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-800">Needs Attention</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-red-50/40 border-red-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-bold text-red-500 uppercase">Unassigned Requests</span>
              <p className="text-2xl font-black text-red-600">{unassignedRequests}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50/40 border-amber-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-bold text-amber-500 uppercase">Awaiting Contact</span>
              <p className="text-2xl font-black text-amber-600">{newRequests}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50/40 border-orange-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-bold text-orange-500 uppercase">Unclear / Needs Routing</span>
              <p className="text-2xl font-black text-orange-600">{unclearRequests}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50/40 border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Documents Pending</span>
              <p className="text-2xl font-black text-slate-600">0</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operations Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 border-slate-200 bg-white"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={handleExportCsv} variant="outline" size="sm" className="w-full sm:w-auto bg-white">
                <Download className="h-4 w-4 mr-2" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>

          {/* Quick Filter tabs layout */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: "overview", label: "Overview" },
              { id: "all", label: "All Requests" },
              { id: "students", label: "Students" },
              { id: "parents", label: "Parents" },
              { id: "tenants", label: "Private Tenants" },
              { id: "applications", label: "Applications" },
              { id: "wil", label: "WIL Support" },
              { id: "landlords", label: "Landlords" },
              { id: "institutions", label: "Institutions" },
              { id: "unclear", label: "Needs Routing" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedRequest(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === tab.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-500">Name</TableHead>
                  <TableHead className="font-semibold text-slate-500">Persona</TableHead>
                  <TableHead className="font-semibold text-slate-500">Need</TableHead>
                  <TableHead className="font-semibold text-slate-500">Contact</TableHead>
                  <TableHead className="font-semibold text-slate-500">Status</TableHead>
                  <TableHead className="font-semibold text-slate-500">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={() => setSelectedRequest(r)}
                      className={`cursor-pointer transition-colors ${selectedRequest?.id === r.id ? "bg-slate-50/80" : "hover:bg-slate-50/40"}`}
                    >
                      <TableCell className="font-bold text-slate-700">{r.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {PERSONA_LABELS[r.persona]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-slate-600">
                        {NEED_LABELS[r.need]}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {r.phone || r.email || "No details"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-semibold ${r.status === "new" ? "bg-blue-50 text-blue-600 border-blue-200" : r.status === "in_review" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                        >
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-slate-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center p-8 text-slate-400 font-semibold">
                      No onboarding requests found matching filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Action Detail Card */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Quick Actions</h2>
          {selectedRequest ? (
            <Card className="bg-white border-slate-100 shadow-sm sticky top-24">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-lg font-black text-slate-700">
                  {selectedRequest.full_name}
                </CardTitle>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge variant="outline" className="font-bold uppercase text-[9px] bg-slate-50 text-slate-600">
                    {PERSONA_LABELS[selectedRequest.persona]}
                  </Badge>
                  <Badge variant="outline" className="font-bold uppercase text-[9px] bg-slate-50 text-slate-600">
                    {NEED_LABELS[selectedRequest.need]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-sm">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Details</span>
                  <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1.5 text-slate-600 font-medium">
                    <div><strong>Email:</strong> {selectedRequest.email || "N/A"}</div>
                    <div><strong>Phone:</strong> {selectedRequest.phone || "N/A"}</div>
                    <div><strong>WhatsApp:</strong> {selectedRequest.whatsapp_number || "N/A"}</div>
                    <div>
                      <strong>POPIA Consent:</strong> {selectedRequest.popia_consent ? "Granted" : "No"}
                    </div>
                    {Object.entries(selectedRequest.details || {}).map(([key, val]) => (
                      <div key={key} className="capitalize">
                        <strong>{key.replace(/_/g, " ")}:</strong> {String(val)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Staff Assignment</span>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter staff name..."
                      id="staff-name-input"
                      defaultValue={selectedRequest.assigned_staff || ""}
                      className="h-8 text-xs border-slate-200"
                    />
                    <Button
                      onClick={() => {
                        const el = document.getElementById("staff-name-input") as HTMLInputElement;
                        if (el) handleAssignStaff(selectedRequest.id, el.value);
                      }}
                      size="sm"
                      className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
                    >
                      Assign
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Staff Notes</span>
                  <textarea
                    placeholder="Add operational notes..."
                    id="staff-notes-input"
                    defaultValue={selectedRequest.notes || ""}
                    className="w-full text-xs border border-slate-200 rounded-md p-2 bg-slate-50/50"
                    rows={3}
                  />
                  <Button
                    onClick={() => {
                      const el = document.getElementById("staff-notes-input") as HTMLTextAreaElement;
                      if (el) handleAddNotes(selectedRequest.id, el.value);
                    }}
                    size="sm"
                    className="w-full text-xs font-semibold"
                  >
                    Save Notes
                  </Button>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Status Tracking</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button onClick={() => handleUpdateStatus(selectedRequest.id, "in_review")} size="sm" variant="outline" className="text-xs">
                      In Review
                    </Button>
                    <Button onClick={() => handleUpdateStatus(selectedRequest.id, "contacted")} size="sm" variant="outline" className="text-xs">
                      Contacted
                    </Button>
                    <Button onClick={() => handleUpdateStatus(selectedRequest.id, "routed")} size="sm" variant="outline" className="text-xs">
                      Routed
                    </Button>
                    <Button onClick={() => handleUpdateStatus(selectedRequest.id, "closed")} size="sm" variant="outline" className="text-xs">
                      Closed
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Outbound Communications</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={`tel:${selectedRequest.phone}`} className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-blue-500" />
                        <span>Call</span>
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={`https://wa.me/${selectedRequest.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3 text-green-500" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={`mailto:${selectedRequest.email}`} className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-500" />
                        <span>Email</span>
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-50/50 border-dashed border-2 border-slate-200">
              <CardContent className="p-8 text-center text-slate-400 font-semibold space-y-2">
                <p>No Request Selected</p>
                <p className="text-xs font-medium text-slate-400/80 max-w-xs mx-auto leading-normal">
                  Click on any request record row from the left table to open detailed profiles, notes recorders, assign staff, and trigger communication channels.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOnboardingHub;