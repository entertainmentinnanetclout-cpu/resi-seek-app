import { Badge } from "@/components/ui/badge";
import { ShieldCheck, WalletCards } from "lucide-react";

export interface AccreditationStatus {
  accepts_nsfas?: boolean | null;
  accreditation_verified?: boolean | null;
  accreditation_status?: string | null;
  accreditation_authority?: string | null;
  accreditation_reference?: string | null;
  accreditation_valid_until?: string | null;
  official_grade?: string | null;
  grade_valid_until?: string | null;
  verified_at?: string | null;
}

export const isCurrentOfficialAccreditation = (status?: AccreditationStatus | null) => {
  if (!status?.accreditation_verified || status.accreditation_status !== "accredited_active") return false;
  if (!status.accreditation_valid_until) return false;
  return status.accreditation_valid_until >= new Date().toISOString().slice(0, 10);
};

const AccreditationStatusBadge = ({ status, compact = false }: { status?: AccreditationStatus | null; compact?: boolean }) => {
  if (isCurrentOfficialAccreditation(status)) {
    return (
      <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600" title={`Verified official evidence${status?.accreditation_valid_until ? ` · valid to ${status.accreditation_valid_until}` : ""}`}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {compact ? "Accredited" : "Official accreditation verified"}
        {!compact && status?.official_grade ? ` · Grade ${status.official_grade}` : ""}
      </Badge>
    );
  }

  if (status?.accepts_nsfas) {
    return (
      <Badge variant="secondary" className="gap-1" title="Funding acceptance is not the same as verified official accreditation.">
        <WalletCards className="h-3.5 w-3.5" />
        Accepts NSFAS-funded students
      </Badge>
    );
  }

  return null;
};

export default AccreditationStatusBadge;
