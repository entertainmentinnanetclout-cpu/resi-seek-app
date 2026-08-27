import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, ImagePlus, MapPin, RefreshCw, Save, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResidenceBrandStudioCard from "@/components/findmyres/ResidenceBrandStudioCard";
import type { ResidencePortalContext } from "./ResidenceLayout";

const EDITABLE = [
  "name","address","place_label","city","campus","province","description","cover_image_url","studio_image_url","image_url","capacity","available_spots","price","private_price","nsfas_price","brand_badge","brand_headline","brand_subheadline","brand_primary_color","brand_accent_color","reservations_2027_open","reservations_2027_note","accepts_nsfas","accepts_private","accepts_tvet","accepts_university","has_wifi","has_parking","is_furnished","utilities_included","public_brand_card_enabled"
] as const;

type FieldKey = (typeof EDITABLE)[number];
const boolFields = new Set<FieldKey>(["reservations_2027_open","accepts_nsfas","accepts_private","accepts_tvet","accepts_university","has_wifi","has_parking","is_furnished","utilities_included","public_brand_card_enabled"]);
const numberFields = new Set<FieldKey>(["capacity","available_spots","price","private_price","nsfas_price"]);

const qualityLabel: Record<string,string> = { needs_data:"Needs data", ready:"Ready", strong:"Strong", excellent:"Excellent" };
const prettyMissing = (value: string) => value.replace(/_/g," ").replace(/\b\w/g,(m)=>m.toUpperCase());

export default function ResidenceListingProfile() {
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [record,setRecord] = useState<any>(null);
  const [draft,setDraft] = useState<any>({});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    const { data,error } = await (supabase as any).from("residences").select("*").eq("id",residence.id).single();
    if (error) toast.error(error.message || "Could not load listing");
    else { setRecord(data); setDraft(data || {}); }
    setLoading(false);
  },[residence?.id]);

  useEffect(()=>{ void load(); },[load]);

  const changed = useMemo(() => {
    if (!record) return {};
    const patch: Record<string,unknown> = {};
    EDITABLE.forEach((key) => {
      const before = record[key] ?? null;
      let after = draft[key] ?? null;
      if (numberFields.has(key) && after !== "" && after !== null) after = Number(after);
      if (JSON.stringify(before) !== JSON.stringify(after)) patch[key] = after;
    });
    return patch;
  },[record,draft]);

  const save = async () => {
    if (!residence?.id || Object.keys(changed).length===0) return toast.info("No changes to save");
    setSaving(true);
    const { error } = await (supabase as any).rpc("residence_portal_update_profile",{ p_residence_id: residence.id,p_patch:changed });
    setSaving(false);
    if (error) return toast.error(error.message || "Could not save listing");
    toast.success("Public listing and brand studio updated");
    await load();
  };

  const upload = async (kind: "cover" | "studio",file?: File | null) => {
    if (!file || !residence?.id) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    setUploading(kind);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${residence.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("residence-assets").upload(path,file,{ upsert:false,contentType:file.type });
    if (error) { setUploading(null); return toast.error(error.message || "Upload failed"); }
    const { data } = supabase.storage.from("residence-assets").getPublicUrl(path);
    setDraft((d:any)=>({ ...d,[kind === "cover" ? "cover_image_url" : "studio_image_url"]:data.publicUrl, ...(kind === "cover" && !d.image_url ? { image_url:data.publicUrl } : {}) }));
    setUploading(null);
    toast.success(`${kind === "cover" ? "Cover" : "Studio"} image uploaded — save to publish it`);
  };

  if (!residence || loading || !record) return <div className="py-16 text-center text-sm text-muted-foreground">Loading listing studio…</div>;
  const missing: string[] = Array.isArray(record.data_quality_missing) ? record.data_quality_missing : [];

  return <>
    <SEO noIndex title={`Listing Studio | ${residence.name} | ResKonnect`} description="Manage your public residence information and branded accommodation card." />
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-semibold text-primary">Landlord Portal · Property Data Quality</p><h1 className="mt-1 text-3xl font-black">Listing & Brand Studio</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Control the public place, pricing baseline, cover/studio imagery and poster-style ResKonnect card for this residence. Trust, accreditation and platform verification remain ResKonnect-controlled.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button><Button onClick={()=>void save()} disabled={saving || Object.keys(changed).length===0}><Save className="mr-2 h-4 w-4"/>{saving?"Saving…":"Publish changes"}</Button></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center justify-between gap-2"><span>Data quality</span><Badge>{record.data_quality_score || 0}% · {qualityLabel[record.data_quality_status] || record.data_quality_status}</Badge></CardTitle></CardHeader><CardContent><Progress value={record.data_quality_score || 0} className="h-3"/><div className="mt-4 flex flex-wrap gap-2">{missing.length ? missing.map((x)=><Badge key={x} variant="outline">{prettyMissing(x)}</Badge>) : <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4"/>Listing data is complete</span>}</div></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/>Place & public information</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            {[["Residence name","name"],["Street address","address"],["Public place label","place_label"],["City / Town","city"],["Nearest campus","campus"],["Province","province"]].map(([label,key])=><div key={key} className="space-y-1.5"><Label>{label}</Label><Input value={draft[key] || ""} onChange={(e)=>setDraft((d:any)=>({...d,[key]:e.target.value}))}/></div>)}
            <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={5} value={draft.description || ""} onChange={(e)=>setDraft((d:any)=>({...d,description:e.target.value}))} placeholder="Describe the residence, room experience, location and key facilities."/><p className="text-xs text-muted-foreground">Aim for at least 120 useful characters for a stronger listing score.</p></div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-primary"/>Cover & studio imagery</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            {(["cover","studio"] as const).map((kind)=><div key={kind} className="rounded-2xl border p-4"><p className="font-bold capitalize">{kind} image</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{kind === "studio" ? "Best: transparent PNG or clean subject/property cut-out for the branded poster card." : "Best: high-quality exterior/interior cover photo."}</p><label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-5 text-sm font-semibold hover:bg-muted"><UploadCloud className="mr-2 h-4 w-4"/>{uploading===kind?"Uploading…":"Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={Boolean(uploading)} onChange={(e)=>void upload(kind,e.target.files?.[0])}/></label><Input className="mt-3" value={draft[kind === "cover" ? "cover_image_url" : "studio_image_url"] || ""} onChange={(e)=>setDraft((d:any)=>({...d,[kind === "cover" ? "cover_image_url" : "studio_image_url"]:e.target.value}))} placeholder="Or paste an approved image URL"/></div>)}
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>Brand card copy</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Gold strap / badge</Label><Input value={draft.brand_badge || ""} onChange={(e)=>setDraft((d:any)=>({...d,brand_badge:e.target.value}))} placeholder="RESKONNECT LIVING"/></div>
            <div className="space-y-1.5"><Label>Headline</Label><Input value={draft.brand_headline || ""} onChange={(e)=>setDraft((d:any)=>({...d,brand_headline:e.target.value}))} placeholder={draft.name}/></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Subheadline</Label><Input value={draft.brand_subheadline || ""} onChange={(e)=>setDraft((d:any)=>({...d,brand_subheadline:e.target.value}))} placeholder="STUDENT ACCOMMODATION, CONNECTED"/></div>
            <div className="space-y-1.5"><Label>Primary navy</Label><Input type="color" value={draft.brand_primary_color || "#000F2F"} onChange={(e)=>setDraft((d:any)=>({...d,brand_primary_color:e.target.value}))}/></div>
            <div className="space-y-1.5"><Label>Accent gold</Label><Input type="color" value={draft.brand_accent_color || "#E09008"} onChange={(e)=>setDraft((d:any)=>({...d,brand_accent_color:e.target.value}))}/></div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Pricing, availability & audiences</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">
            {[["Capacity","capacity"],["Available spots","available_spots"],["Published baseline","price"],["Private rate","private_price"],["NSFAS rate","nsfas_price"]].map(([label,key])=><div key={key} className="space-y-1.5"><Label>{label}</Label><Input type="number" min="0" value={draft[key] ?? ""} onChange={(e)=>setDraft((d:any)=>({...d,[key]:e.target.value}))}/></div>)}
            <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Accept private","accepts_private"],["Accept NSFAS context","accepts_nsfas"],["Accept TVET","accepts_tvet"],["Accept university","accepts_university"],["Wi-Fi","has_wifi"],["Parking","has_parking"],["Furnished","is_furnished"],["Utilities included","utilities_included"],["2027 reservations open","reservations_2027_open"],["Use branded public card","public_brand_card_enabled"]].map(([label,key])=><div key={key} className="flex items-center justify-between rounded-xl border p-3"><Label>{label}</Label><Switch checked={Boolean(draft[key])} onCheckedChange={(v)=>setDraft((d:any)=>({...d,[key]:v}))}/></div>)}</div>
            <div className="space-y-1.5 sm:col-span-3"><Label>2027 reservation note</Label><Textarea value={draft.reservations_2027_note || ""} onChange={(e)=>setDraft((d:any)=>({...d,reservations_2027_note:e.target.value}))} rows={3}/></div>
          </CardContent></Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start"><Card className="overflow-hidden"><CardHeader><CardTitle className="text-base">Live branded card preview</CardTitle></CardHeader><CardContent className="p-3"><ResidenceBrandStudioCard residence={{...record,...draft}}/><p className="mt-3 text-xs leading-5 text-muted-foreground">Preview follows the same deep-navy, gold strap, bold white headline and studio/cover-image system used for ResKonnect strategic collaboration visuals.</p></CardContent></Card><Card><CardContent className="p-4 text-xs leading-5 text-muted-foreground"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><p>Residence users can edit property facts and marketing presentation, but cannot self-assign trust, accreditation or verified-price status.</p></div></CardContent></Card></div>
      </div>
    </div>
  </>;
}
