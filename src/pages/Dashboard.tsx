import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import MyResKonnectCommandCentre from "@/components/MyResKonnectCommandCentre";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const Dashboard = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;

  return (
    <DashboardLayout>
      <SEO
        title="My ResKonnect | Living • AI • Opportunity"
        description="Your connected ResKonnect command centre for Living, AI guidance, applications, opportunities, next-best actions and verified account updates."
      />
      <MyResKonnectCommandCentre />
    </DashboardLayout>
  );
};

export default Dashboard;
