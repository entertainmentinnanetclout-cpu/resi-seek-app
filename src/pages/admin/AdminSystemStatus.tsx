import { useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, RefreshCw, Database, Users, Building2, Image, FileText, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HealthCheck {
  name: string;
  icon: React.ElementType;
  status: "pending" | "success" | "error";
  message?: string;
  fix?: string;
}

const AdminSystemStatus = () => {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: "User Roles Table", icon: Users, status: "pending" },
    { name: "Profiles Table", icon: Users, status: "pending" },
    { name: "Residences Table", icon: Building2, status: "pending" },
    { name: "Residences Trusted Columns", icon: Building2, status: "pending" },
    { name: "Applications Table", icon: FileText, status: "pending" },
    { name: "Storage: profile-pictures", icon: Image, status: "pending" },
    { name: "Storage: admin-images", icon: Image, status: "pending" },
    { name: "Bursaries Table", icon: Database, status: "pending" },
  ]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const newChecks: HealthCheck[] = [...checks];

    // Check 1: User Roles Table
    try {
      const { error } = await supabase.from("user_roles").select("id").limit(1);
      newChecks[0] = {
        ...newChecks[0],
        status: error ? "error" : "success",
        message: error ? error.message : "Accessible",
        fix: error ? "Ensure RLS policies allow admin access to user_roles table." : undefined,
      };
    } catch (e: any) {
      newChecks[0] = { ...newChecks[0], status: "error", message: e.message };
    }

    // Check 2: Profiles Table
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      newChecks[1] = {
        ...newChecks[1],
        status: error ? "error" : "success",
        message: error ? error.message : "Accessible",
        fix: error ? "Ensure RLS policies allow admin access to profiles table." : undefined,
      };
    } catch (e: any) {
      newChecks[1] = { ...newChecks[1], status: "error", message: e.message };
    }

    // Check 3: Residences Table
    try {
      const { error } = await supabase.from("residences").select("id").limit(1);
      newChecks[2] = {
        ...newChecks[2],
        status: error ? "error" : "success",
        message: error ? error.message : "Accessible",
        fix: error ? "Check residences table exists and has proper RLS policies." : undefined,
      };
    } catch (e: any) {
      newChecks[2] = { ...newChecks[2], status: "error", message: e.message };
    }

    // Check 4: Residences Trusted Columns
    try {
      const { data, error } = await supabase.from("residences").select("is_trusted, display_order").limit(1);
      if (error) {
        newChecks[3] = {
          ...newChecks[3],
          status: "error",
          message: "Columns is_trusted or display_order missing",
          fix: "Run: ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false; ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;",
        };
      } else {
        newChecks[3] = { ...newChecks[3], status: "success", message: "Columns present" };
      }
    } catch (e: any) {
      newChecks[3] = { ...newChecks[3], status: "error", message: e.message };
    }

    // Check 5: Applications Table
    try {
      const { error } = await supabase.from("applications").select("id").limit(1);
      newChecks[4] = {
        ...newChecks[4],
        status: error ? "error" : "success",
        message: error ? error.message : "Accessible",
        fix: error ? "Ensure admin RLS policies exist for applications table." : undefined,
      };
    } catch (e: any) {
      newChecks[4] = { ...newChecks[4], status: "error", message: e.message };
    }

    // Check 6: Storage profile-pictures
    try {
      const { error } = await supabase.storage.from("profile-pictures").list("", { limit: 1 });
      newChecks[5] = {
        ...newChecks[5],
        status: error ? "error" : "success",
        message: error ? error.message : "Reachable",
        fix: error ? "Ensure storage bucket 'profile-pictures' exists with proper policies." : undefined,
      };
    } catch (e: any) {
      newChecks[5] = { ...newChecks[5], status: "error", message: e.message };
    }

    // Check 7: Storage admin-images
    try {
      const { error } = await supabase.storage.from("admin-images").list("", { limit: 1 });
      newChecks[6] = {
        ...newChecks[6],
        status: error ? "error" : "success",
        message: error ? error.message : "Reachable",
        fix: error ? "Ensure storage bucket 'admin-images' exists with proper policies." : undefined,
      };
    } catch (e: any) {
      newChecks[6] = { ...newChecks[6], status: "error", message: e.message };
    }

    // Check 8: Bursaries Table
    try {
      const { error } = await supabase.from("bursaries").select("id").limit(1);
      newChecks[7] = {
        ...newChecks[7],
        status: error ? "error" : "success",
        message: error ? error.message : "Accessible",
        fix: error ? "Check bursaries table RLS policies." : undefined,
      };
    } catch (e: any) {
      newChecks[7] = { ...newChecks[7], status: "error", message: e.message };
    }

    setChecks(newChecks);
    setRunning(false);
  };

  const successCount = checks.filter((c) => c.status === "success").length;
  const errorCount = checks.filter((c) => c.status === "error").length;
  const pendingCount = checks.filter((c) => c.status === "pending").length;

  return (
    <AdminLayout>
      <SEO title="System Status | Admin" description="Check backend system health and connectivity" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">System Status</h1>
            <p className="text-muted-foreground">Check backend health and connectivity</p>
          </div>
          <Button onClick={runChecks} disabled={running}>
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Run Health Checks
          </Button>
        </div>

        {/* Summary */}
        {pendingCount < checks.length && (
          <div className="flex gap-4">
            <Badge variant="default" className="gap-1">
              <CheckCircle className="w-3 h-3" /> {successCount} Passed
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" /> {errorCount} Failed
              </Badge>
            )}
          </div>
        )}

        <div className="grid gap-4">
          {checks.map((check, index) => (
            <Card key={index} className={check.status === "error" ? "border-destructive/50" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    check.status === "success" ? "bg-success/10" :
                    check.status === "error" ? "bg-destructive/10" : "bg-muted"
                  }`}>
                    <check.icon className={`w-5 h-5 ${
                      check.status === "success" ? "text-success" :
                      check.status === "error" ? "text-destructive" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{check.name}</h3>
                      {check.status === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                      {check.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                      {check.status === "pending" && <span className="text-xs text-muted-foreground">Not tested</span>}
                    </div>
                    {check.message && (
                      <p className={`text-sm ${check.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                        {check.message}
                      </p>
                    )}
                    {check.fix && (
                      <div className="mt-2 p-2 bg-warning/10 rounded text-xs">
                        <div className="flex items-center gap-1 text-warning mb-1">
                          <AlertTriangle className="w-3 h-3" /> Fix
                        </div>
                        <code className="text-foreground break-all">{check.fix}</code>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemStatus;
