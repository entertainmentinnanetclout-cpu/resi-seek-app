export type ResidenceApplicationStatus =
  | "submitted"
  | "documents_required"
  | "under_review"
  | "conditionally_approved"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ResidenceApplicationStatusGroup =
  | "all"
  | "new"
  | "documents_required"
  | "under_review"
  | "approved"
  | "closed";

export const RESIDENCE_APPLICATION_STATUS_META: Record<string, { label: string; group: ResidenceApplicationStatusGroup }> = {
  submitted: { label: "New", group: "new" },
  documents_required: { label: "Documents Required", group: "documents_required" },
  under_review: { label: "Under Review", group: "under_review" },
  conditionally_approved: { label: "Conditionally Approved", group: "approved" },
  approved: { label: "Approved", group: "approved" },
  rejected: { label: "Rejected", group: "closed" },
  withdrawn: { label: "Withdrawn", group: "closed" },
};

export const RESIDENCE_APPLICATION_GROUPS: Array<{ value: ResidenceApplicationStatusGroup; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "documents_required", label: "Needs Documents" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "closed", label: "Closed" },
];

export const statusMatchesGroup = (status: string | null | undefined, group: ResidenceApplicationStatusGroup) => {
  if (group === "all") return true;
  return (RESIDENCE_APPLICATION_STATUS_META[status || ""]?.group || "all") === group;
};

export const getResidenceApplicationStatusLabel = (status: string | null | undefined) => {
  if (!status) return "Unknown";
  return RESIDENCE_APPLICATION_STATUS_META[status]?.label || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getResidenceApplicationRef = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

export const RESIDENCE_ATTENTION_STATUSES = ["submitted", "documents_required"] as const;
