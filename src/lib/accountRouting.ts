import { DEPARTMENT_BY_KEY, type AdminDepartmentKey } from "./adminDepartments";
import { GOD_MODE_ROLES, RESIDENCE_ADMIN_ROLES } from "./constants/roles";

export const ACCOUNT_PORTALS = [
  { label: "Students & applicants", login: "/auth", dashboard: "/dashboard" },
  { label: "Landlords & residences", login: "/residence/login", dashboard: "/residence" },
  { label: "Recruiters", login: "/recruit/auth", dashboard: "/recruit/dashboard" },
  { label: "Creator partners", login: "/auth?returnTo=/creator-partners", dashboard: "/creator-partners" },
  { label: "Education partners", login: "/auth?returnTo=/partner/tumelo/os", dashboard: "/partner/tumelo/os" },
  { label: "Staff & administration", login: "/auth", dashboard: "/admin" },
] as const;

export const isNativeApp = () => typeof window !== "undefined" && Boolean(
  (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(),
);

export function accountHome(access: {
  staffRole?: string | null;
  adminDepartments?: AdminDepartmentKey[];
  isTumeloPartner?: boolean;
  isRecruiter?: boolean;
  isPendingRecruiter?: boolean;
}) {
  const role = access.staffRole;
  if (role && (GOD_MODE_ROLES as readonly string[]).includes(role)) return "/admin";
  if (role && (RESIDENCE_ADMIN_ROLES as readonly string[]).includes(role)) return "/residence";
  if (role === "tvet_lead") return "/tvet-dashboard";
  const department = access.adminDepartments?.find(key => DEPARTMENT_BY_KEY[key]);
  if (department) return DEPARTMENT_BY_KEY[department].path;
  if (role === "commerce_lead") return "/commerce";
  if (role === "growth_lead") return "/media";
  // Unassigned staff must not bounce between /dashboard and /admin.
  if (role) return "/portals";
  if (access.isTumeloPartner) return "/partner/tumelo/os";
  if (access.isRecruiter) return "/recruit/dashboard";
  if (access.isPendingRecruiter) return "/recruit/apply";
  return "/dashboard";
}
