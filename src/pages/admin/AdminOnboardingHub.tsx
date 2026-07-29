import React from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { AdminOnboardingHub } from "@/components/admin/onboarding/AdminOnboardingHubContent";

export const AdminOnboardingPage: React.FC = () => {
  return (
    <AdminLayout>
      <SEO
        title="Onboarding Hub | Admin"
        description="Operational dashboard tracking adaptive public onboarding requests, parents guidance assistance, private rentals leads, and WIL placements."
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Onboarding Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate, allocate staff, log actions, and route dynamic support inquiries from the public ecosystem.
          </p>
        </div>

        <AdminOnboardingHub />
      </div>
    </AdminLayout>
  );
};

export default AdminOnboardingPage;