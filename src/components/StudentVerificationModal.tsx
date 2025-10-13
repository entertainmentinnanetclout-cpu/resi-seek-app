import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StudentVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  currentProfile: {
    full_name?: string;
    student_number?: string;
    campus?: string;
  } | null;
}

export function StudentVerificationModal({ 
  open, 
  onClose, 
  onVerified,
  currentProfile 
}: StudentVerificationModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: currentProfile?.full_name || "",
    studentNumber: currentProfile?.student_number || "",
    institution: currentProfile?.campus || ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          student_number: formData.studentNumber,
          campus: formData.institution
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Student Information Updated",
        description: "You can now create listings on the marketplace."
      });

      onVerified();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Complete Student Verification</DialogTitle>
            <DialogDescription>
              Please provide your student information to create marketplace listings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="studentNumber">Student Number</Label>
              <Input
                id="studentNumber"
                value={formData.studentNumber}
                onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="institution">Institution</Label>
              <Select 
                value={formData.institution} 
                onValueChange={(value) => setFormData({ ...formData, institution: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cape Town">Cape Town</SelectItem>
                  <SelectItem value="Durban">Durban</SelectItem>
                  <SelectItem value="Johannesburg">Johannesburg</SelectItem>
                  <SelectItem value="Pretoria">Pretoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Information"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
