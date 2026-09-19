import SEO from "@/components/SEO";
import { Link, useLocation } from "react-router-dom";
import PublicPartnerProfile from "@/pages/partners/PublicPartnerProfile";
import PartnerStaffRoleManager from "@/components/partners/PartnerStaffRoleManager";
import PartnerApprovalConsole from "@/components/partners/PartnerApprovalConsole";
import PartnerIdentityPanel from "@/components/partners/PartnerIdentityPanel";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminRoute } from "@/components/AdminRoute";

export default function NotFound() {
  const { pathname } = useLocation();
  // The current app router sends new partner routes through the wildcard. Keep
  // operational approval data protected by the scoped server-side AAL2 checks.
  if (pathname === '/admin/partner-roles') return <AdminRoute><DashboardLayout><SEO noIndex title="Partner staff role management | ResKonnect" description="Assign operational partner-administration roles."/><main className="mx-auto max-w-6xl space-y-6 p-4 py-8"><PartnerStaffRoleManager/><nav className="flex flex-wrap gap-3 text-sm"><Link className="underline" to="/admin/application-partners">Applications Admin approvals</Link><Link className="underline" to="/admin/residence-partners">Residence Admin approvals</Link></nav></main></DashboardLayout></AdminRoute>;
  if (pathname === '/admin/application-partners' || pathname === '/admin/residence-partners') {
    const kind=pathname==='/admin/application-partners'?'application':'residence';
    return <DashboardLayout><SEO noIndex title={`${kind==='application'?'Applications':'Residence'} Admin approvals | ResKonnect`} description="Review partners and their approved assignments."/><main className="mx-auto max-w-6xl space-y-4 p-4 py-8"><nav className="flex flex-wrap gap-3 text-sm"><Link className="underline" to="/admin/application-partners">Applications approvals</Link><Link className="underline" to="/admin/residence-partners">Residence approvals</Link><Link className="underline" to="/admin/partner-roles">Manage staff roles (God Mode)</Link></nav><PartnerApprovalConsole kind={kind}/></main></DashboardLayout>;
  }
  if (pathname === '/partners/onboarding') return <DashboardLayout><SEO noIndex title="Partner onboarding | ResKonnect" description="Set up your application or residence recruitment profile."/><main className="mx-auto max-w-5xl space-y-5 p-4 py-8"><h1 className="text-3xl font-black">Partner onboarding</h1><p className="text-sm text-muted-foreground">Register for application assistance or residence recruitment first, then select your institutions, campuses and residences for administrator approval.</p><PartnerIdentityPanel kind="application"/><PartnerIdentityPanel kind="residence"/></main></DashboardLayout>;
  if (/^\/partners\/[a-z0-9][a-z0-9-]{2,79}\/?$/.test(pathname)) return <PublicPartnerProfile />;
  return <><SEO noIndex title="404 - Page Not Found | ResKonnect" description="The page you are looking for does not exist." /><div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">ResKonnect · Living • AI • Opportunity</p><h1 className="mt-3 text-5xl font-black">404</h1><p className="mt-3 text-lg font-bold">Page not found</p><p className="mt-2 text-sm text-muted-foreground">We could not find <span className="font-mono">{pathname}</span>.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/" className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">ResKonnect home</Link><Link to="/get-started" className="rounded-full border px-5 py-3 text-sm font-bold">Get started</Link></div></div></div></>;
}
