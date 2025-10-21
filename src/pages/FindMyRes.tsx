import { useState, useEffect } from "react";
import { MapPin, DollarSign, Users, Wifi, Car, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { supabase } from "@/integrations/supabase/client";

const FindMyRes = () => {
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
  const [residences, setResidences] = useState<any[]>([]);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [applicationStep, setApplicationStep] = useState(1);
  const [showApplicationModal, setShowApplicationModal] = useState(false);

  const handleViewMore = (residence: typeof residences[0]) => {
    setSelectedResidence(residence);
  };

  const handleApply = (residence: typeof residences[0]) => {
    setSelectedResidence(residence);
    setApplicationStep(1);
    setShowApplicationModal(true);
  };

  useEffect(() => {
    const fetchResidences = async () => {
      try {
        const { data, error } = await supabase.from('residences').select('*');
        if (error) throw error;
        setResidences(data || []);
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    fetchResidences();
  }, []);

  const handleNextStep = () => {
    if (applicationStep < 3) {
      setApplicationStep(applicationStep + 1);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedResidence || !user) return;
    try {
      const { error } = await supabase.from('applications').insert({
        user_id: user.id,
        residence_id: selectedResidence.id,
        status: 'submitted',
      });
      if (error) throw error;
      toast.success(`Application submitted for ${selectedResidence?.name}!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setShowApplicationModal(false);
      setApplicationStep(1);
    }
  };

  const renderApplicationStep = () => {
    if (!selectedResidence) return null;

    switch (applicationStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Review Your Profile</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
                <div className="flex justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{profile?.email}</span>
                </div>
                <div className="flex justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-muted-foreground">Student Number:</span>
                  <span className="font-medium">{profile?.student_number}</span>
                </div>
                <div className="flex justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-muted-foreground">Campus:</span>
                  <span className="font-medium">{profile?.campus}</span>
                </div>
                <div className="flex justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-muted-foreground">Year of Study:</span>
                  <span className="font-medium">{profile?.year_of_study}</span>
                </div>
              </div>
              <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                  <div>
                    <p className="font-medium text-success">Documents Verified</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ID Copy, Proof of Registration uploaded
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Confirm Residence & Intent</h3>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <p className="font-medium text-lg mb-1">{selectedResidence.name}</p>
                <p className="text-sm text-muted-foreground">{selectedResidence.location}</p>
                <p className="text-lg font-bold text-primary mt-2">{selectedResidence.price}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Preferred Move-in Date
                  </label>
                  <Input type="date" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Additional Notes (Optional)
                  </label>
                  <Textarea 
                    placeholder="Any special requests or information you'd like to share..."
                    rows={4}
                  />
                </div>

                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-1" required />
                    <span className="text-sm">
                      I confirm that I am seriously applying for this residence and understand that 
                      false applications may result in account suspension.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Ready to Submit</h3>
              <p className="text-muted-foreground mb-6">
                Please review your application details before submitting
              </p>

              <div className="text-left space-y-3 bg-secondary/30 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Residence:</span>
                  <span className="font-medium">{selectedResidence.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium">{selectedResidence.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student:</span>
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-6">
                You will receive a confirmation email once your application is submitted. 
                The residence admin will review your application and contact you.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Find My Res</h1>
            <p className="text-muted-foreground">
              Browse available student residences and apply
            </p>
          </div>

          {/* Filters */}
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-4 gap-4">
                <Input placeholder="Search residences..." />
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-3000">Under R3,000</SelectItem>
                    <SelectItem value="3000-4500">R3,000 - R4,500</SelectItem>
                    <SelectItem value="4500-6000">R4,500 - R6,000</SelectItem>
                    <SelectItem value="6000+">Above R6,000</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Distance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1">Within 1km</SelectItem>
                    <SelectItem value="1-2">1-2km</SelectItem>
                    <SelectItem value="2-5">2-5km</SelectItem>
                    <SelectItem value="5+">5km+</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="default">Apply Filters</Button>
              </div>
            </CardContent>
          </Card>

          {/* Residences Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {residences.map((residence) => (
              <Card key={residence.id} className="shadow-card hover:shadow-hover transition-smooth">
                <CardHeader>
                  <CardTitle>{residence.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {residence.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{residence.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {residence.amenities.map((amenity) => (
                      <span 
                        key={amenity}
                        className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold text-primary">{residence.price}</p>
                      <p className="text-xs text-muted-foreground">
                        {residence.available} rooms available
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleViewMore(residence)}
                    >
                      View More
                    </Button>
                    <Button 
                      variant="accent" 
                      className="flex-1"
                      onClick={() => handleApply(residence)}
                    >
                      Apply Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Application Modal */}
      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {selectedResidence?.name}</DialogTitle>
            <DialogDescription>
              Step {applicationStep} of 3
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                    step <= applicationStep 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div 
                    className={`flex-1 h-1 mx-2 ${
                      step < applicationStep ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {renderApplicationStep()}

          <div className="flex gap-3 mt-6">
            {applicationStep > 1 && (
              <Button 
                variant="outline" 
                onClick={() => setApplicationStep(applicationStep - 1)}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {applicationStep < 3 ? (
              <Button 
                variant="default" 
                onClick={handleNextStep}
                className="flex-1"
              >
                Next Step
              </Button>
            ) : (
              <Button 
                variant="accent" 
                onClick={handleSubmitApplication}
                className="flex-1"
              >
                Submit Application
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FindMyRes;
