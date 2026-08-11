import { Link } from "react-router-dom";
import { Info, Sparkles, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { whatsappPrivateRentalRequest } from "@/lib/whatsappLinks";

interface IntentNoticeProps {
  note: string | null;
  privateRentalUnavailable: boolean;
  guideSkipped: boolean;
  onClearIntentFilters: () => void;
  area?: string;
  budget?: number;
}

export const IntentNotice = ({
  note,
  privateRentalUnavailable,
  guideSkipped,
  onClearIntentFilters,
  area,
  budget,
}: IntentNoticeProps) => {
  if (privateRentalUnavailable) {
    return (
      <Card className="border-brand-blue/30 bg-brand-blue/5">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <Home className="w-5 h-5 text-brand-blue shrink-0" />
          <p className="text-sm flex-1">
            Private rental support is being prepared. Submit your area, budget and rental type so
            ResKonnect can assist you.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
              <Link to="/get-started?persona=private_tenant&need=private_rental">Submit request</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={whatsappPrivateRentalRequest(area, budget)} target="_blank" rel="noreferrer">
                WhatsApp us
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (note) {
    return (
      <Card className="border-brand-green/30 bg-brand-green/5">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-green shrink-0" />
          <p className="text-sm flex-1">{note}</p>
          <Button size="sm" variant="ghost" onClick={onClearIntentFilters} className="shrink-0">
            Show everything
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (guideSkipped) {
    return (
      <Card className="border-border bg-muted/40">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Info className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm flex-1 text-muted-foreground">
            Browsing everything. Complete the guide for personalised results.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/get-started">Complete guide</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default IntentNotice;
