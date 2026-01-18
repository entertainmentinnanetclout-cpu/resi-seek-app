import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/exportHelpers";

interface WhatsAppTemplate {
  id: string;
  template_key: string;
  template_name: string;
  template_text: string;
}

interface WhatsAppTemplateSelectorProps {
  student: {
    name: string;
    phone: string | null;
    residenceApplied?: string | null;
  };
  onSend?: () => void;
  showButton?: boolean;
  className?: string;
}

const WhatsAppTemplateSelector = ({ 
  student, 
  onSend,
  showButton = true,
  className 
}: WhatsAppTemplateSelectorProps) => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("is_active", true)
        .order("template_name");

      if (error) throw error;
      setTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplate(data[0].template_key);
        setCustomMessage(processTemplate(data[0].template_text));
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const processTemplate = (text: string) => {
    let processed = text;
    processed = processed.replace(/{name}/g, student.name || "Student");
    processed = processed.replace(/{residence}/g, student.residenceApplied || "your selected residence");
    processed = processed.replace(/{residence_text}/g, student.residenceApplied ? ` for ${student.residenceApplied}` : "");
    return processed;
  };

  const handleTemplateChange = (key: string) => {
    setSelectedTemplate(key);
    const template = templates.find(t => t.template_key === key);
    if (template) {
      setCustomMessage(processTemplate(template.template_text));
    }
  };

  const handleSend = () => {
    if (!student.phone) {
      toast.error("Student has no phone number");
      return;
    }

    const phone = formatPhoneNumber(student.phone);
    const message = encodeURIComponent(customMessage);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
    setShowPreview(false);
    onSend?.();
  };

  if (!student.phone) {
    return null;
  }

  if (!showButton) {
    return (
      <div className="space-y-3">
        <Select value={selectedTemplate} onValueChange={handleTemplateChange} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Select template..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map(template => (
              <SelectItem key={template.template_key} value={template.template_key}>
                {template.template_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={4}
          placeholder="Message preview..."
        />
        <Button onClick={handleSend} className="w-full bg-green-600 hover:bg-green-700">
          <Send className="w-4 h-4 mr-2" />
          Send via WhatsApp
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className={`text-green-600 hover:text-green-700 ${className}`}
        onClick={() => setShowPreview(true)}
        title="WhatsApp with template"
      >
        <MessageSquare className="w-4 h-4" />
      </Button>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Send WhatsApp Message
            </DialogTitle>
            <DialogDescription>
              Select a template or customize your message to {student.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Template</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.template_key} value={template.template_key}>
                      {template.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Message Preview (editable)
              </label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className="bg-muted/50"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSend} className="flex-1 bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppTemplateSelector;
