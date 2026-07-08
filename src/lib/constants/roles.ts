export const GOD_MODE_ROLES = ["admin", "super_admin", "developer", "owner"] as const;

export const SCOPED_STAFF_ROLES = [
  "tvet_lead",
  "operations_lead",
  "commerce_lead",
  "growth_lead",
  "system_operator",
  "support_agent"
] as const;

export const RESIDENCE_ADMIN_ROLES = ["residence_admin", "building_admin", "office_admin"] as const;

export type GodModeRole = (typeof GOD_MODE_ROLES)[number];
export type ScopedStaffRole = (typeof SCOPED_STAFF_ROLES)[number];
export type ResidenceAdminRole = (typeof RESIDENCE_ADMIN_ROLES)[number];

export type AppStaffRole = GodModeRole | ScopedStaffRole | ResidenceAdminRole;
