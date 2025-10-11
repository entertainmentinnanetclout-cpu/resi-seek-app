import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [uploadedDocs, setUploadedDocs] = useState({
    id: false,
    registration: false,
    funding: false
  });

  const progress = Object.values(uploadedDocs).filter(Boolean).length * 33.33;

  const handleFileUpload = (docType: keyof typeof uploadedDocs) => {
    // TODO: Implement actual file upload
    setUploadedDocs(prev => ({ ...prev, [docType]: true }));
    toast.success("Document uploaded successfully!");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!uploadedDocs.id || !uploadedDocs.registration) {
      toast.error("Please upload all required documents");
      return;
    }

    toast.success("Profile completed! You can now apply for residences.");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">ResKonnect</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Progress Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground mb-4">
              Upload required documents to unlock residence applications
            </p>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Provide your student details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="text-sm font-medium mb-2 block">
                      Full Name
                    </label>
                    <Input id="fullName" name="fullName" required placeholder="John Doe" />
                  </div>
                  <div>
                    <label htmlFor="studentNumber" className="text-sm font-medium mb-2 block">
                      Student Number
                    </label>
                    <Input id="studentNumber" name="studentNumber" required placeholder="u12345678" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="text-sm font-medium mb-2 block">
                      Email Address
                    </label>
                    <Input id="email" name="email" type="email" required placeholder="john@student.ac.za" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="text-sm font-medium mb-2 block">
                      Phone Number
                    </label>
                    <Input id="phone" name="phone" type="tel" required placeholder="+27 12 345 6789" />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="campus" className="text-sm font-medium mb-2 block">
                      Campus
                    </label>
                    <Select name="campus" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatfield">Hatfield Campus</SelectItem>
                        <SelectItem value="mamelodi">Mamelodi Campus</SelectItem>
                        <SelectItem value="sunnyside">Sunnyside Campus</SelectItem>
                        <SelectItem value="groenkloof">Groenkloof Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="course" className="text-sm font-medium mb-2 block">
                      Course
                    </label>
                    <Input id="course" name="course" required placeholder="Computer Science" />
                  </div>
                  <div>
                    <label htmlFor="year" className="text-sm font-medium mb-2 block">
                      Year of Study
                    </label>
                    <Select name="year" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                        <SelectItem value="postgrad">Postgraduate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Uploads */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Required Documents</CardTitle>
                <CardDescription>Upload these documents to complete your profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ID Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">ID Copy</h4>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload a clear copy of your ID (PDF or JPEG)
                      </p>
                    </div>
                    {uploadedDocs.id && <CheckCircle2 className="w-5 h-5 text-success" />}
                  </div>
                  <Button 
                    type="button"
                    variant={uploadedDocs.id ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleFileUpload("id")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadedDocs.id ? "Re-upload" : "Upload ID"}
                  </Button>
                </div>

                {/* Registration Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Proof of Registration</h4>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current year registration certificate (PDF or JPEG)
                      </p>
                    </div>
                    {uploadedDocs.registration && <CheckCircle2 className="w-5 h-5 text-success" />}
                  </div>
                  <Button 
                    type="button"
                    variant={uploadedDocs.registration ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleFileUpload("registration")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadedDocs.registration ? "Re-upload" : "Upload Registration"}
                  </Button>
                </div>

                {/* Funding Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Proof of Funding</h4>
                        <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">Optional</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Bursary letter or financial proof (if applicable)
                      </p>
                    </div>
                    {uploadedDocs.funding && <CheckCircle2 className="w-5 h-5 text-success" />}
                  </div>
                  <Button 
                    type="button"
                    variant={uploadedDocs.funding ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleFileUpload("funding")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadedDocs.funding ? "Re-upload" : "Upload Funding Proof"}
                  </Button>
                </div>

                {(!uploadedDocs.id || !uploadedDocs.registration) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>You must upload ID and Registration documents before applying for residences.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/dashboard")}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button 
                type="submit" 
                variant="accent" 
                className="flex-1"
                disabled={!uploadedDocs.id || !uploadedDocs.registration}
              >
                Complete Profile
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
