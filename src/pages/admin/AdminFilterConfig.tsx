import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, ArrowUp, ArrowDown, Filter, Star, Eye, EyeOff } from "lucide-react";

interface FilterRow {
  id: string;
  key: string;
  label: string;
  filter_group: string;
  display_order: number;
  is_visible: boolean;
  is_featured: boolean;
  is_multiselect: boolean;
  control_type: string;
}

export const AdminFilterConfigContent = () => {
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("filter_config" as any)
      .select("*")
      .order("filter_group", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = async (id: string, patch: Partial<FilterRow>) => {
    setSaving(id);
    const { error } = await supabase.from("filter_config" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      toast.success("Filter updated");
    }
    setSaving(null);
  };

  const move = async (row: FilterRow, dir: -1 | 1) => {
    const groupRows = rows.filter((r) => r.filter_group === row.filter_group);
    const idx = groupRows.findIndex((r) => r.id === row.id);
    const swap = groupRows[idx + dir];
    if (!swap) return;
    await Promise.all([
      patch(row.id, { display_order: swap.display_order }),
      patch(swap.id, { display_order: row.display_order }),
    ]);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  const groups = Array.from(new Set(rows.map((r) => r.filter_group)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Filter className="w-6 h-6" /> Filter Management</h2>
        <p className="text-muted-foreground text-sm">Control which filters appear on Find My Res, their order, labels, and featured status.</p>
      </div>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{group} Filters</CardTitle>
            <CardDescription>Drag-style controls for the {group} group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.filter((r) => r.filter_group === group).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-card">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(row, -1)}><ArrowUp className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(row, 1)}><ArrowDown className="w-3 h-3" /></Button>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Input value={row.label} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, label: e.target.value } : r))} onBlur={(e) => patch(row.id, { label: e.target.value })} className="h-8 text-sm" />
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{row.key}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{row.control_type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={row.is_visible} onCheckedChange={(v) => patch(row.id, { is_visible: v })} />
                  <Label className="text-xs">{row.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={row.is_featured} onCheckedChange={(v) => patch(row.id, { is_featured: v })} />
                  <Label className="text-xs flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Featured</Label>
                </div>
                {saving === row.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const AdminFilterConfig = () => <AdminFilterConfigContent />;
export default AdminFilterConfig;
