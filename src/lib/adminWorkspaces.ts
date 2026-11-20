/**
 * One visible owner per administrative function.
 * The old URLs stay valid and keep their individual authorization boundaries;
 * this is a navigation consolidation, never a destructive route migration.
 */
export const ADMIN_PRIMARY_WORKSPACES = [
 {id:"overview",label:"Overview",path:"/admin",description:"Today's priorities and verified service intelligence",
  match:["/admin","/admin/brain"]},
 {id:"people",label:"People",path:"/admin/users",description:"Student 360, accounts and document journeys",
  match:["/admin/users","/admin/students/"]},
 {id:"accommodation",label:"Accommodation",path:"/admin/accommodation?tab=applications-reservations&view=reservations",
  description:"One residence view: inventory, intake, cases and email follow-up",
  match:["/admin/accommodation","/admin/operations","/admin/applications","/admin/residences","/admin/residence-portals"]},
 {id:"communications",label:"Communications",path:"/admin/communications?tab=email",
  description:"The single Gmail and WhatsApp workspace",
  match:["/admin/communications","/admin/whatsapp-templates"]},
 {id:"decisions",label:"Work Queue",path:"/admin/golden-cycle",
  description:"Service exceptions, approvals and human decisions",
  match:["/admin/golden-cycle","/admin/cases","/admin/follow-up"]},
 {id:"opportunities",label:"Opportunities",path:"/admin/opportunities",
  description:"Education, WIL, funding and student support",
  match:["/admin/opportunities","/admin/wil","/admin/tvet","/admin/student-care"]},
 {id:"growth",label:"Content & Growth",path:"/admin/corporate-affairs",
  description:"Publishing, campaigns and visual editing",
  match:["/admin/corporate-affairs","/admin/studio","/admin/media","/admin/news","/admin/slides","/admin/events"]},
 {id:"technology",label:"Technology",path:"/admin/technology",
  description:"Platform status, integrations and system governance",
  match:["/admin/technology","/admin/system","/admin/system-status","/admin/settings"]},
] as const;

export const ADMIN_ADVANCED_TOOLS = [
 {label:"Case approvals",path:"/admin/cases",function:"Work Queue"},
 {label:"Student documents",path:"/admin/documents",function:"People"},
 {label:"Visual Studio",path:"/admin/studio",function:"Content & Growth"},
 {label:"Finance & billing",path:"/admin/finance-admin",function:"Finance"},
 {label:"Business analytics",path:"/admin/intelligence",function:"Analytics"},
] as const;

/** Each department-specific workspace remains accessible exactly once in 'More offices'. */
export const ADMIN_PRIMARY_DEPARTMENT_KEYS = [
 "accommodation","student_opportunities","marketing_corporate_affairs",
 "communications_service","technology_systems","finance_admin","intelligence_analytics",
] as const;
