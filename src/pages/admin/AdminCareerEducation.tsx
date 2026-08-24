import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
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
      <SEO title="Career & Education Content | Admin" description="Manage Career & Education providers, partner videos and transcripts." noIndex />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Career & Education Content</h1>
          <p className="mt-1 text-muted-foreground">Add new partner videos, exact TikTok/YouTube URLs, transcripts and choose the featured video shown on public pages.</p>
        </div>
        <AdminCareerEducationContent />
      </div>
    </AdminLayout>
  );
};

export default AdminCareerEducation;
