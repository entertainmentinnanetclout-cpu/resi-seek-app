import React from "react";
import type { OnboardingRequest } from "@/lib/onboarding/onboardingTypes";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Phone, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { routeForRequest } from "./OnboardingResultRouter";

interface OnboardingSummaryCardProps {
  record: OnboardingRequest;
}

export const OnboardingSummaryCard: React.FC<OnboardingSummaryCardProps> = ({ record }) => {
  const target = routeForRequest(record);

  // Format ResKonnect official WhatsApp/Phone values
  const RESKONNECT_PHONE = "011 987 6543"; // Sample fallback, or imported if needed
  const RESKONNECT_WHATSAPP_LINK = "https://wa.me/27119876543";

  return (
    <Card className="max-w-xl mx-auto border-2 border-primary/20 bg-card/60 backdrop-blur-md">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-2">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Request Received!</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Thank you, <span className="font-semibold text-foreground">{record.full_name}</span>. Your onboarding request has been submitted successfully.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Reference ID:</span>
            <span className="font-semibold text-mono text-xs">{record.id}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Persona Type:</span>
            <span className="font-semibold capitalize">{record.persona.replace("_", " ")}</span>
          </div>
          <div className="flex justify-between pb-1">
            <span className="text-muted-foreground">Assistance Need:</span>
            <span className="font-semibold capitalize">{record.need.replace("_", " ")}</span>
          </div>
        </div>

        <div className="space-y-2 text-center text-xs text-muted-foreground">
          <p>
            An operator or support specialist has been notified. We will review your request and reach out soon via Phone, Email, or WhatsApp.
          </p>
          <p className="font-semibold text-primary">
            Need urgent assistance? Connect with our support desk right now:
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" size="sm" asChild className="w-full">
            <a href={`tel:${RESKONNECT_PHONE.replace(/\s/g, "")}`} className="flex items-center gap-2 justify-center">
              <Phone className="h-4 w-4" />
              <span>Call Us</span>
            </a>
          </Button>

          <Button variant="outline" size="sm" asChild className="w-full border-green-500/30 hover:bg-green-500/5">
            <a href={RESKONNECT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 justify-center text-green-600">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp</span>
            </a>
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-4 border-t">
        <Button asChild className="w-full bg-primary text-primary-foreground font-semibold py-5">
          <Link to={target.path}>{target.label}</Link>
        </Button>

        <p className="text-[10px] text-center text-muted-foreground leading-normal mt-2">
          Disclaimer: This is a guidance readiness check request. This submission is NOT an official institution admission registration and does not guarantee placement.
        </p>
      </CardFooter>
    </Card>
  );
};

export default OnboardingSummaryCard;