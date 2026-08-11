import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageOff, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { firstResidenceImage, type CategoryCardConfig, type ResidenceLite } from "@/hooks/useCategoryCardConfigs";

const AUTO = "__auto__";

export const AdminCategoryCardsContent = () => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<CategoryCardConfig>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin_category_card_configs"],
    queryFn: async (): Promise<CategoryCardConfig[]> => {
      const { data, error } = await (supabase as any)
        .from("category_card_configs")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CategoryCardConfig[];
    },
  });

  const { data: residences } = useQuery({
    queryKey: ["admin_category_card_residences"],
    queryFn: async (): Promise<ResidenceLite[]> => {
      const { data, error } = await supabase
        .from("residences")
        .select("id,name,campus,address,price,available_spots,image_url,images,accepts_university,accepts_tvet,accepts_private,accepts_nsfas,institution_tags")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ResidenceLite[];
    },
  });

  const residenceById = useMemo(() => {
    const map = new Map<string, ResidenceLite>();
    (residences || []).forEach((r) => map.set(r.id, r));
    return map;
  }, [residences]);

  const valueOf = (cfg: CategoryCardConfig, key: keyof CategoryCardConfig) => {
    const draft = drafts[cfg.id];
    return draft && key in draft ? (draft as any)[key] : (cfg as any)[key];
  };

  const setDraft = (id: string, patch: Partial<CategoryCardConfig>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async (cfg: CategoryCardConfig) => {
    setSavingId(cfg.id);
    try {
      const payload = {
        selected_residence_id: valueOf(cfg, "selected_residence_id") || null,
        selected_image_url: (valueOf(cfg, "selected_image_url") as string) || null,
        fallback_strategy: valueOf(cfg, "fallback_strategy") || "residence_pool",
        image_alt: (valueOf(cfg, "image_alt") as string) || null,
        display_order: Number(valueOf(cfg, "display_order")) || 0,
        is_active: !!valueOf(cfg, "is_active"),
      };
      const { error } = await (supabase as any)
        .from("category_card_configs")
        .update(payload)
        .eq("id", cfg.id);
      if (error) throw error;
      toast.success(`${cfg.title} updated`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[cfg.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin_category_card_configs"] });
      queryClient.invalidateQueries({ queryKey: ["category_card_configs"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not save category card");
    } finally {
      setSavingId(null);
    }
  };

  const resetToAuto = (cfg: CategoryCardConfig) =>
    setDraft(cfg.id, { selected_residence_id: null, selected_image_url: null, fallback_strategy: "residence_pool" });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Category card images always come from real residences or real private rental listings. Leave a card on
        “Auto-pick from matching residences” to rotate real images automatically.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {(configs || []).map((cfg) => {
          const selectedId = (valueOf(cfg, "selected_residence_id") as string) || "";
          const customUrl = (valueOf(cfg, "selected_image_url") as string) || "";
          const preview = customUrl || firstResidenceImage(residenceById.get(selectedId)) || null;
          const dirty = !!drafts[cfg.id];

          return (
            <Card key={cfg.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>{cfg.title}</span>
                  <Badge variant="outline" className="text-[10px]">{cfg.card_key}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
                  {preview ? (
                    <img src={preview} alt={(valueOf(cfg, "image_alt") as string) || cfg.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageOff className="h-6 w-6" />
                      <span className="text-xs">Auto-pick from matching residences</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Use image from residence — Selected residence</Label>
                  <Select
                    value={selectedId || AUTO}
                    onValueChange={(v) => setDraft(cfg.id, { selected_residence_id: v === AUTO ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Auto-pick from matching residences" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={AUTO}>Auto-pick from matching residences</SelectItem>
                      {(residences || []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                          {r.campus ? ` · ${r.campus}` : ""}
                          {r.price ? ` · R${Number(r.price).toLocaleString("en-ZA")}` : ""}
                          {typeof r.available_spots === "number" ? ` · ${r.available_spots} spots` : ""}
                          {firstResidenceImage(r) ? "" : " · no image"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Custom image URL (optional)</Label>
                  <Input
                    value={customUrl}
                    placeholder="https://…"
                    onChange={(e) => setDraft(cfg.id, { selected_image_url: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fallback strategy</Label>
                    <Select
                      value={(valueOf(cfg, "fallback_strategy") as string) || "residence_pool"}
                      onValueChange={(v) => setDraft(cfg.id, { fallback_strategy: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residence_pool">Auto-pick from matching residences</SelectItem>
                        <SelectItem value="selected_residence">Selected residence only</SelectItem>
                        <SelectItem value="custom_url">Custom image URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display order</Label>
                    <Input
                      type="number"
                      value={String(valueOf(cfg, "display_order") ?? 0)}
                      onChange={(e) => setDraft(cfg.id, { display_order: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Category card image alt text</Label>
                  <Input
                    value={(valueOf(cfg, "image_alt") as string) || ""}
                    onChange={(e) => setDraft(cfg.id, { image_alt: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!valueOf(cfg, "is_active")}
                      onCheckedChange={(v) => setDraft(cfg.id, { is_active: v })}
                    />
                    <Label className="text-xs">Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => resetToAuto(cfg)}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                    </Button>
                    <Button size="sm" disabled={!dirty || savingId === cfg.id} onClick={() => save(cfg)}>
                      <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const AdminCategoryCards = () => (
  <AdminLayout>
    <SEO title="Category Cards | Admin" description="Manage Living category card images" />
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Category Cards</h1>
        <p className="text-muted-foreground">Control the Living page category card images and ordering</p>
      </div>
      <AdminCategoryCardsContent />
    </div>
  </AdminLayout>
);

export default AdminCategoryCards;
