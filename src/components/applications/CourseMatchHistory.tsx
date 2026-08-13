import { useEffect, useState } from "react";
import { Clock3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { loadMyProgrammeCheckHistory } from "@/lib/courseMatchHistory";

const CourseMatchHistory = ({ userId, refreshKey = 0 }: { userId:string; refreshKey?:number }) => {
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    setLoading(true);
    loadMyProgrammeCheckHistory(userId,6)
      .then((data)=>{if(active)setRows(data);})
      .catch((error)=>console.warn("Could not load programme-check history",error))
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[userId,refreshKey]);

  return <Card>
    <CardContent className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Saved to your account</p>
          <h2 className="mt-1 text-xl font-black">My recent programme checks</h2>
        </div>
        <Clock3 className="h-5 w-5 text-muted-foreground" />
      </div>
      {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading saved checks…</div> : rows.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((row)=>{
            const scope=Array.isArray(row.metadata?.institution_scope)?row.metadata.institution_scope:[];
            return <div key={row.id} className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{row.institution_type === "tvet" ? "TVET" : "University"}</Badge>
                <span className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{scope.length ? scope.join(" • ") : "Programme comparison"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.highest_grade || "Grade 12 / NSC"}{row.estimated_aps != null ? ` • APS ${row.estimated_aps}` : ""}</p>
              {row.summary && <p className="mt-3 text-xs leading-5 text-muted-foreground">{row.summary}</p>}
            </div>;
          })}
        </div>
      ) : <p className="mt-4 text-sm text-muted-foreground">Your completed checks will appear here after you run your first signed-in programme comparison.</p>}
    </CardContent>
  </Card>;
};

export default CourseMatchHistory;
