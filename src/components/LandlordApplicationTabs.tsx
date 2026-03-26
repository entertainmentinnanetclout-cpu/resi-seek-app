import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Shield, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TUT_CAMPUSES } from "@/lib/campuses";

interface FormData {
  application_type: string;
  property_name: string;
  address: string;
  nearest_campus: string;
  room_type: string;
  price: string;
  capacity: string;
  description: string;
  province: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  company_name: string;
  registration_number: string;
  nsfas_accredited: boolean;
  years_operating: string;
  total_properties: string;
}

const initialForm: FormData = {
  application_type: "listing",
  property_name: "",
  address: "",
  nearest_campus: "",
  room_type: "",
  price: "",
  capacity: "",
  description: "",
  province: "Gauteng",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  company_name: "",
  registration_number: "",
  nsfas_accredited: false,
  years_operating: "",
  total_properties: "1",
};

const LandlordApplicationTabs = () => {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refId, setRefId] = useState("");
  const [activeTab, setActiveTab] = useState("listing");

  const update = (key: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent, type: string) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        application_type: type,
        property_name: form.property_name,
        address: form.address,
        nearest_campus: form.nearest_campus || null,
        room_type: form.room_type || null,
        price: form.price ? Number(form.price) : null,
        capacity: form.capacity ? Number(form.capacity) : null,
        description: form.description || null,
        province: form.province,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        company_name: form.company_name || null,
      };
      if (type === "accreditation" || type === "both") {
        payload.registration_number = form.registration_number || null;
        payload.nsfas_accredited = form.nsfas_accredited;
        payload.years_operating = form.years_operating ? Number(form.years_operating) : null;
        payload.total_properties = form.total_properties ? Number(form.total_properties) : 1;
      }

      const { data, error } = await supabase
        .from("landlord_applications" as never)
        .insert(payload as never)
        .select("id")
        .single();

      if (error) throw error;
      const id = (data as { id: string })?.id || "";
      setRefId(id.slice(0, 8).toUpperCase());
      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h3 className="text-2xl font-bold">Application Submitted!</h3>
          <p className="text-muted-foreground">
            Your reference number is <strong className="text-primary">{refId}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Our team will review your application and contact you within 2-3 business days.
          </p>
          <Button onClick={() => { setSubmitted(false); setForm(initialForm); }}>
            Submit Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ContactFields = () => (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Your Contact Details</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="contact_name">Full Name *</Label>
          <Input id="contact_name" required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} placeholder="John Doe" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="company_name">Company Name</Label>
          <Input id="company_name" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact_phone">Phone *</Label>
          <Input id="contact_phone" required value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} placeholder="063 000 0000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact_email">Email *</Label>
          <Input id="contact_email" type="email" required value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="you@example.com" />
        </div>
      </div>
    </div>
  );

  const PropertyFields = () => (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Property Details</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="property_name">Property Name *</Label>
          <Input id="property_name" required value={form.property_name} onChange={(e) => update("property_name", e.target.value)} placeholder="Sunrise Student Res" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="address">Address *</Label>
          <Input id="address" required value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main St, Pretoria" />
        </div>
        <div className="space-y-1">
          <Label>Nearest Campus</Label>
          <Select value={form.nearest_campus} onValueChange={(v) => update("nearest_campus", v)}>
            <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
            <SelectContent>
              {CAMPUSES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Room Type</Label>
          <Select value={form.room_type} onValueChange={(v) => update("room_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="sharing">Sharing</SelectItem>
              <SelectItem value="bachelor">Bachelor</SelectItem>
              <SelectItem value="commune">Commune</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="price">Monthly Price (R)</Label>
          <Input id="price" type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="3500" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="capacity">Total Beds</Label>
          <Input id="capacity" type="number" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} placeholder="20" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Tell students about your property..." rows={3} />
      </div>
    </div>
  );

  const AccreditationFields = () => (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Accreditation Details</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="registration_number">Registration / CSD Number</Label>
          <Input id="registration_number" value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} placeholder="REG-XXXXX" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="years_operating">Years Operating</Label>
          <Input id="years_operating" type="number" value={form.years_operating} onChange={(e) => update("years_operating", e.target.value)} placeholder="5" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="total_properties">Total Properties</Label>
          <Input id="total_properties" type="number" value={form.total_properties} onChange={(e) => update("total_properties", e.target.value)} placeholder="1" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Checkbox id="nsfas" checked={form.nsfas_accredited} onCheckedChange={(v) => update("nsfas_accredited", !!v)} />
          <Label htmlFor="nsfas" className="cursor-pointer">Currently NSFAS Accredited</Label>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-center">Apply to List or Get Accredited</CardTitle>
        <p className="text-sm text-center text-muted-foreground">Choose what you need and complete the form below</p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="listing" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="w-4 h-4" /> List Property
            </TabsTrigger>
            <TabsTrigger value="accreditation" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="w-4 h-4" /> Accreditation
            </TabsTrigger>
            <TabsTrigger value="both" className="gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4" /> Both
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listing">
            <form onSubmit={(e) => handleSubmit(e, "listing")} className="space-y-4 mt-4">
              <PropertyFields />
              <ContactFields />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Listing Application"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="accreditation">
            <form onSubmit={(e) => handleSubmit(e, "accreditation")} className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="prop_name_acc">Property / Company Name *</Label>
                    <Input id="prop_name_acc" required value={form.property_name} onChange={(e) => update("property_name", e.target.value)} placeholder="Sunrise Student Res" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="addr_acc">Address *</Label>
                    <Input id="addr_acc" required value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main St, Pretoria" />
                  </div>
                </div>
              </div>
              <AccreditationFields />
              <ContactFields />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Accreditation Application"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="both">
            <form onSubmit={(e) => handleSubmit(e, "both")} className="space-y-4 mt-4">
              <PropertyFields />
              <AccreditationFields />
              <ContactFields />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Full Application"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LandlordApplicationTabs;
