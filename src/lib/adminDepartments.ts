export const ADMIN_DEPARTMENT_KEYS = [
  "executive",
  "accommodation",
  "student_opportunities",
  "marketing_corporate_affairs",
  "partnerships_engagements",
  "communications_service",
  "operations",
  "finance_admin",
  "intelligence_analytics",
  "technology_systems",
] as const;

export type AdminDepartmentKey = (typeof ADMIN_DEPARTMENT_KEYS)[number];

export type AdminDepartmentDefinition = {
  key: AdminDepartmentKey;
  label: string;
  shortLabel: string;
  path: string;
  description: string;
};

export const ADMIN_DEPARTMENTS: AdminDepartmentDefinition[] = [
  { key: "executive", label: "Executive Office", shortLabel: "Executive", path: "/admin/executive", description: "Strategy, planning, delegation, approvals and company-wide performance." },
  { key: "accommodation", label: "Accommodation Department", shortLabel: "Accommodation", path: "/admin/accommodation", description: "Residences, academic inventory, occupancy, applications, reservations and accommodation delivery." },
  { key: "student_opportunities", label: "Student Services & Opportunities", shortLabel: "Opportunities", path: "/admin/opportunities", description: "Study applications, WIL, bursaries, funding support and student service enquiries." },
  { key: "marketing_corporate_affairs", label: "Marketing & Corporate Affairs", shortLabel: "Corporate Affairs", path: "/admin/corporate-affairs", description: "PR, public content, campaigns, brand publishing, news, events and reputation." },
  { key: "partnerships_engagements", label: "Partnerships & Engagements", shortLabel: "Partnerships", path: "/admin/partnerships", description: "Institutions, landlords, creators, strategic partners, engagements and relationship performance." },
  { key: "communications_service", label: "Communications & Service", shortLabel: "Communications", path: "/admin/communications", description: "WhatsApp, contact directory, service intelligence, templates and customer communication." },
  { key: "operations", label: "Operations Office", shortLabel: "Operations", path: "/admin/operations-office", description: "Cross-company workflows, queues, onboarding, exceptions and execution control." },
  { key: "finance_admin", label: "Finance & Administration", shortLabel: "Finance/Admin", path: "/admin/finance-admin", description: "Revenue administration, commerce, costs, records and administrative control." },
  { key: "intelligence_analytics", label: "Intelligence & Analytics", shortLabel: "Analytics", path: "/admin/intelligence", description: "Demand, social performance, conversion, service and executive analytics." },
  { key: "technology_systems", label: "Technology & Systems", shortLabel: "Technology", path: "/admin/technology", description: "Platform health, integrations, AI controls, backend operations and release governance." },
];

export const DEPARTMENT_BY_KEY = Object.fromEntries(
  ADMIN_DEPARTMENTS.map((department) => [department.key, department]),
) as Record<AdminDepartmentKey, AdminDepartmentDefinition>;
