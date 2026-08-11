import React, { useState } from "react";
import type { Persona, Need } from "@/lib/onboarding/onboardingTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { COMPLIANCE_STATEMENTS } from "@/lib/onboarding/complianceCopy";

interface OnboardingFormProps {
  persona: Persona;
  need: Need;
  onSubmit: (data: {
    full_name: string;
    phone: string;
    whatsapp_number: string;
    email: string;
    consent_to_be_contacted: boolean;
    popia_consent: boolean;
    details: Record<string, string | number | boolean | undefined>;
  }) => void;
  onBack: () => void;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({
  persona,
  need,
  onSubmit,
  onBack,
}) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consentContact, setConsentContact] = useState(true);
  const [popiaConsent, setPopiaConsent] = useState(false);

  // Dynamic state for custom fields
  const [details, setDetails] = useState<Record<string, string | number | boolean | undefined>>({});

  const updateDetail = (key: string, value: string | number | boolean | undefined) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!popiaConsent) return;
    onSubmit({
      full_name: fullName,
      phone,
      whatsapp_number: whatsapp,
      email,
      consent_to_be_contacted: consentContact,
      popia_consent: popiaConsent,
      details,
    });
  };

  // Render adaptive fields based on persona
  const renderAdaptiveFields = () => {
    switch (persona) {
      case "student":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institution">Institution / Campus</Label>
              <Input
                id="institution"
                placeholder="e.g. TUT Soshanguve, UP Hatfield"
                value={(details.institution as string) || ""}
                onChange={(e) => updateDetail("institution", e.target.value)}
              />
            </div>
            {need === "accommodation" && (
              <div className="space-y-2">
                <Label htmlFor="preferred_room_type">Preferred Room Type</Label>
                <select
                  id="preferred_room_type"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={(details.preferred_room_type as string) || ""}
                  onChange={(e) => updateDetail("preferred_room_type", e.target.value)}
                >
                  <option value="">Select Room Type</option>
                  <option value="single">Single Room</option>
                  <option value="sharing">Sharing Room</option>
                  <option value="bachelor">Bachelor Apartment</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="student_number">Student Number (Optional)</Label>
              <Input
                id="student_number"
                placeholder="Enter your student number if registered"
                value={(details.student_number as string) || ""}
                onChange={(e) => updateDetail("student_number", e.target.value)}
              />
            </div>
          </div>
        );

      case "parent_guardian":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student_full_name">Student's Full Name</Label>
              <Input
                id="student_full_name"
                required
                placeholder="Full name of your child/ward"
                value={(details.student_full_name as string) || ""}
                onChange={(e) => updateDetail("student_full_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship_to_student">Relationship to Student</Label>
              <Input
                id="relationship_to_student"
                placeholder="e.g. Father, Mother, Aunt"
                value={(details.relationship_to_student as string) || ""}
                onChange={(e) => updateDetail("relationship_to_student", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_institution">Preferred Institution</Label>
              <Input
                id="preferred_institution"
                placeholder="e.g. TUT, Wits, UJ"
                value={(details.preferred_institution as string) || ""}
                onChange={(e) => updateDetail("preferred_institution", e.target.value)}
              />
            </div>
          </div>
        );

      case "private_tenant":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Monthly Budget Range (ZAR)</Label>
              <Input
                id="budget"
                placeholder="e.g. R3000 - R5000"
                value={(details.budget as string) || ""}
                onChange={(e) => updateDetail("budget", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_area">Preferred Area / Suburb</Label>
              <Input
                id="preferred_area"
                placeholder="e.g. Pretoria CBD, Hatfield, Soshanguve"
                value={(details.preferred_area as string) || ""}
                onChange={(e) => updateDetail("preferred_area", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="move_in_date">Preferred Move-In Date</Label>
              <Input
                id="move_in_date"
                type="date"
                value={(details.move_in_date as string) || ""}
                onChange={(e) => updateDetail("move_in_date", e.target.value)}
              />
            </div>
          </div>
        );

      case "applicant":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institution_type">Institution Type of Interest</Label>
              <select
                id="institution_type"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={(details.institution_type as string) || ""}
                onChange={(e) => updateDetail("institution_type", e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="tvet">TVET College</option>
                <option value="university">University</option>
                <option value="private_college">Private College</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="field_of_study">Field of Study / Course Interest</Label>
              <Input
                id="field_of_study"
                placeholder="e.g. Engineering, Business, IT"
                value={(details.field_of_study as string) || ""}
                onChange={(e) => updateDetail("field_of_study", e.target.value)}
              />
            </div>
          </div>
        );

      case "wil_applicant":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course">Course of Study (e.g. N6 Management)</Label>
              <Input
                id="course"
                required
                placeholder="e.g. Public Management N6, Electrical Engineering"
                value={(details.course as string) || ""}
                onChange={(e) => updateDetail("course", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution_wil">Institution</Label>
              <Input
                id="institution_wil"
                placeholder="e.g. Tshwane South TVET College"
                value={(details.institution_wil as string) || ""}
                onChange={(e) => updateDetail("institution_wil", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_needed">WIL Duration Needed (Months)</Label>
              <Input
                id="duration_needed"
                type="number"
                placeholder="e.g. 18"
                value={(details.duration_needed as string) || ""}
                onChange={(e) => updateDetail("duration_needed", e.target.value)}
              />
            </div>
          </div>
        );

      case "landlord":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property_name">Property Name / Description</Label>
              <Input
                id="property_name"
                required
                placeholder="e.g. ResKonnect Plaza, Sunset Student Rooms"
                value={(details.property_name as string) || ""}
                onChange={(e) => updateDetail("property_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property_address">Property Address</Label>
              <Input
                id="property_address"
                placeholder="Street address, Suburb, City"
                value={(details.property_address as string) || ""}
                onChange={(e) => updateDetail("property_address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number_of_rooms">Number of Units/Rooms</Label>
              <Input
                id="number_of_rooms"
                type="number"
                placeholder="e.g. 10"
                value={(details.number_of_rooms as string) || ""}
                onChange={(e) => updateDetail("number_of_rooms", e.target.value)}
              />
            </div>
          </div>
        );

      case "institution_business":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org_name">Organization/Institution Name</Label>
              <Input
                id="org_name"
                required
                placeholder="e.g. South Tech TVET, Peak Accom Ltd"
                value={(details.org_name as string) || ""}
                onChange={(e) => updateDetail("org_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner_interest">Area of Partnership Interest</Label>
              <select
                id="partner_interest"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={(details.partner_interest as string) || ""}
                onChange={(e) => updateDetail("partner_interest", e.target.value)}
              >
                <option value="">Select Option</option>
                <option value="accommodation">Student Accommodation Hosting</option>
                <option value="wil_placements">WIL Placements & Internships</option>
                <option value="portal_solutions">Student Portal & IT Solutions</option>
                <option value="campaigns">Marketing & Campus Campaigns</option>
              </select>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="additional_message">Tell us more about how we can assist you</Label>
              <Textarea
                id="additional_message"
                placeholder="Explain what guidance or assistance you need..."
                value={(details.message as string) || ""}
                onChange={(e) => updateDetail("message", e.target.value)}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Contact Details</h3>
        <p className="text-xs text-muted-foreground">
          Let us know how to reach you to assist with your request.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
              placeholder="e.g. Lawrence Dube"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="e.g. reskonnect@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              required
              placeholder="e.g. 0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp Number (Optional)</Label>
            <Input
              id="whatsapp"
              placeholder="e.g. 0712345678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h3 className="text-lg font-bold">Specific Information</h3>
        {renderAdaptiveFields()}
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="consent_contact"
            checked={consentContact}
            onCheckedChange={(checked) => setConsentContact(!!checked)}
          />
          <Label htmlFor="consent_contact" className="text-xs text-muted-foreground leading-normal">
            I consent to ResKonnect contacting me via Email, Phone, or WhatsApp to process this request.
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="popia_consent"
            required
            checked={popiaConsent}
            onCheckedChange={(checked) => setPopiaConsent(!!checked)}
          />
          <Label htmlFor="popia_consent" className="text-xs text-muted-foreground leading-normal font-semibold">
            I agree to the ResKonnect Privacy Policy and consent to POPIA data processing.
          </Label>
        </div>
      </div>

      <Card className="bg-muted/40 border-border">
        <CardContent className="p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold block text-foreground">Compliance Disclaimer</span>
          {COMPLIANCE_STATEMENTS.map((stmt, idx) => (
            <p key={idx}>{stmt}</p>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={!popiaConsent} className="bg-primary text-primary-foreground">
          Submit Request
        </Button>
      </div>
    </form>
  );
};

export default OnboardingForm;