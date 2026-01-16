import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Phone, MessageSquare, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onSuccess?: () => void;
}

const CallLogDialog = ({ open, onOpenChange, studentId, studentName, onSuccess }: CallLogDialogProps) => {
  const [callType, setCallType] = useState<string>("phone");
  const [outcome, setOutcome] = useState<string>("answered");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("call_logs").insert({
        student_id: studentId,
        admin_id: user.id,
        call_type: callType,
        outcome,
        notes: notes.trim() || null,
        follow_up_date: followUpDate || null,
      });

      if (error) throw error;

      toast.success("Call logged successfully");
      onOpenChange(false);
      setNotes("");
      setFollowUpDate("");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error logging call:", error);
      toast.error(error.message || "Failed to log call");
    } finally {
      setSaving(false);
    }
  };

  const callTypes = [
    { value: "phone", label: "Phone Call", icon: Phone },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { value: "email", label: "Email", icon: Mail },
  ];

  const outcomes = [
    { value: "answered", label: "Answered" },
    { value: "no_answer", label: "No Answer" },
    { value: "voicemail", label: "Voicemail" },
    { value: "busy", label: "Busy" },
    { value: "wrong_number", label: "Wrong Number" },
    { value: "callback_requested", label: "Callback Requested" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Contact Attempt</DialogTitle>
          <DialogDescription>
            Recording contact with <strong>{studentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Contact Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {callTypes.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={callType === type.value ? "default" : "outline"}
                  className="flex flex-col h-auto py-3"
                  onClick={() => setCallType(type.value)}
                >
                  <type.icon className="w-4 h-4 mb-1" />
                  <span className="text-xs">{type.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {outcomes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed? Any important details?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Follow-up Date (optional)</Label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallLogDialog;
