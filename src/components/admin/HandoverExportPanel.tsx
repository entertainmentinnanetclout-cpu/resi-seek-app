import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2, FileDown, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadEnhancedCSV } from "@/lib/exportHelpers";

type ValidationResult = {
  ok: boolean;
  residence_id: string | null;
  totals: {
    total_applications: number;
    total_students: number;
    missing_names: number;
    missing_surnames: number;
    missing_student_no: number;
    missing_funding: number;
    invalid_residence: number;
    duplicates_found: number;
  };
  errors: Array<{ code: string; application_id: string; reason: string }>;
  generated_at: string;
};

interface Props {
  residenceId?: string | null;
}

/**
 * Pre-export validation gate for residence handover packs.
 * Reads from `residence_handover_export_v` (single source of truth) and the
 * `validate_handover_pack` RPC. Export is BLOCKED until ok === true.
 */
export default function HandoverExportPanel({ residenceId = null }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runValidation = async () => {
    setRunning(true);
    setResult(null);
    const { data, error } = await supabase.rpc("validate_handover_pack", {
      _residence_id: residenceId,
    });
    setRunning(false);
    if (error) {
      toast.error(`Validation failed: ${error.message}`);
      return;
    }
    setResult(data as unknown as ValidationResult);
  };

  const exportCsv = async () => {
    if (!result?.ok) {
      toast.error("Resolve all integrity errors before exporting.");
      return;
    }
    setExporting(true);
    let q = supabase.from("residence_handover_export_v").select("*");
    if (residenceId) q = q.eq("residence_id", residenceId);
    const { data, error } = await q.order("application_date", { ascending: false });
    setExporting(false);
    if (error || !data) {
      toast.error(`Export failed: ${error?.message ?? "no rows"}`);
      return;
    }
    downloadEnhancedCSV(
      data.map((r: any) => ({
        name: [r.student_name, r.student_surname].filter(Boolean).join(" "),
        phone: r.phone,
        email: r.email,
        campus: r.campus,
        studentNumber: r.student_number,
        residenceApplied: r.residence_name,
        status: r.status,
        applicationDate: r.application_date,
      })),
      `handover-pack-${new Date().toISOString().split("T")[0]}.csv`,
    );
    toast.success(`Exported ${data.length} validated records`);
  };

  const t = result?.totals;

  return (
    <Card className="border-2 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Handover Export — Integrity Gate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={runValidation} disabled={running} className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Run Pre-Export Validation
          </Button>
          <Button
            onClick={exportCsv}
            disabled={!result?.ok || exporting}
            variant="outline"
            className="gap-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download CSV (Validated Only)
          </Button>
        </div>

        {result && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Total Students"    value={t!.total_students} />
              <Stat label="Total Applications" value={t!.total_applications} />
              <Stat label="Duplicates Found"   value={t!.duplicates_found} bad={t!.duplicates_found > 0} />
              <Stat label="Missing Names"      value={t!.missing_names} bad={t!.missing_names > 0} />
              <Stat label="Missing Surnames"   value={t!.missing_surnames} bad={t!.missing_surnames > 0} />
              <Stat label="Missing Student #"  value={t!.missing_student_no} bad={t!.missing_student_no > 0} />
              <Stat label="Missing Funding"    value={t!.missing_funding} bad={t!.missing_funding > 0} />
              <Stat label="Invalid Residence"  value={t!.invalid_residence} bad={t!.invalid_residence > 0} />
            </div>

            {result.ok ? (
              <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 flex items-center gap-2 text-green-800 dark:text-green-200">
                <ShieldCheck className="w-5 h-5" />
                Validation passed — export unlocked.
              </div>
            ) : (
              <div className="rounded-md border border-destructive bg-destructive/10 p-3 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <ShieldAlert className="w-5 h-5" />
                  DATA INTEGRITY ERROR — Export blocked
                </div>
                <ul className="text-sm space-y-1 max-h-64 overflow-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="destructive" className="shrink-0">{e.code}</Badge>
                      <span className="font-mono text-xs">{e.application_id.slice(0, 8)}…</span>
                      <span className="text-muted-foreground">{e.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className={`rounded border p-2 ${bad ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${bad ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}