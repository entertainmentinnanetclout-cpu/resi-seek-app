import { AlertCircle } from "lucide-react";
import { COMPLIANCE_STATEMENTS } from "@/lib/onboarding/complianceCopy";

export const ComplianceDisclaimer = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 md:p-5 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="space-y-2">
          {(compact ? COMPLIANCE_STATEMENTS.slice(0, 1) : COMPLIANCE_STATEMENTS).map((line) => (
            <p key={line} className="leading-relaxed">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDisclaimer;