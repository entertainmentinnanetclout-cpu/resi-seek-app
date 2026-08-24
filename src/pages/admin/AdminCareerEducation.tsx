import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPartnerShowcase from "@/components/admin/AdminPartnerShowcase";
import SEO from "@/components/SEO";
import AdminCareerEducationContent from "./AdminCareerEducationContent";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED = new Set(["admin", "super_admin", "developer", "owner", "growth_lead"]);
const client = supabase as any;

const AdminCareerEducation = () => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (active) setAuthorized(false);
        return;
      }
      const { data } = await client.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (data || []).some((row: any) => ALLOWED.has(String(row.role)));
      if (active) setAuthorized(ok);
    };
    verify();
    return () => { active = false; };
  }, []);

  if (authorized === null) return <div className="min-h-screen bg-background" />;
  if (!authorized) return <Navigate to="/auth" replace />;

  return (
    <AdminLayout>
      <SEO title="Career, Education & Partner Content | Admin" description="Manage Career & Education collaborators, videos and the public partner showcase." noIndex />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Career, Education & Partnerships</h1>
          <p className="mt-1 text-muted-foreground">Manage Tumelo's collaboration content, contributor videos and the partner/client/institutional logo showcase displayed on the public site.</p>
        </div>
        <AdminPartnerShowcase />
        <AdminCareerEducationContent />
      </div>
    </AdminLayout>
  );
};

export default AdminCareerEducation;
