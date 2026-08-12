import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  ImagePlus,
  Loader2,
  PhoneCall,
  Plus,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type HubCategory = "university" | "tvet" | "private_college";
type MatcherKey = "tut" | "up" | "unisa" | "";

type InstitutionRow = {
  id: string;
  institution_id: string | null;
  slug: string;
  category: HubCategory;
  short_name: string;
  display_name: string;
  city: string;
  province: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  application_url: string | null;
  official_url: string | null;
  matcher_key: "tut" | "up" | "unisa" | null;
  matcher_enabled: boolean;
  featured: boolean;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type AssistanceRequest = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  institution_type: string;
  preferred_institution: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type InstitutionForm = {
  id?: string;
  institution_id?: string | null;
  slug: string;
  category: HubCategory;
  short_name: string;
  display_name: string;
  city: string;
  province: string;
  description: string;
  logo_url: string;
  cover_image_url: string;
  brand_primary: string;
  brand_secondary: string;
  application_url: string;
  official_url: string;
  matcher_key: MatcherKey;
  matcher_enabled: boolean;
  featured: boolean;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): InstitutionForm => ({
  slug: "",
  category: "private_college",
  short_name: "",
  display_name: "",
  city: "Pretoria",
  province: "Gauteng",
  description: "",
  logo_url: "",
  cover_image_url: "",
  brand_primary: "#4454A6",
  brand_secondary: "#7A84C6",
  application_url: "",
  official_url: "",
  matcher_key: "",
  matcher_enabled: false,
  featured: false,
  is_active: true,
  sort_order: 100,
});

const toForm = (row: InstitutionRow): InstitutionForm => ({
  id: row.id,
  institution_id: row.institution_id,
  slug: row.slug,
  category: row.category,
  short_name: row.short_name,
  display_name: row.display_name,
  city: row.city,
  province: row.province,
  description: row.description ?? "",
  logo_url: row.logo_url ?? "",
  cover_image_url: row.cover_image_url ?? "",
  brand_primary: row.brand_primary ?? "#4454A6",
  brand_secondary: row.brand_secondary ?? "#7A84C6",
  application_url: row.application_url ?? "",
  official_url: row.official_url ?? "",
  matcher_key: row.matcher_key ?? "",
  matcher_enabled: row.matcher_enabled,
  featured: row.featured,
  is_active: row.is_active,
  sort_order: row.sort_order,
});

const AdminApplicationHub = () => {
  const [view, setView] = useState<"institutions" | "requests">("institutions");
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<"logo_url" | "cover_image_url" | null>(null);
  const [form, setForm] = useState<InstitutionForm>(emptyForm());
  const [requestFilter, setRequestFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    const [institutionResult, requestResult] = await Promise.all([
      (supabase as any)
        .from("application_hub_institutions")
        .select("*")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true }),
      (supabase as any)
        .from("application_support_queries")
        .select("id,full_name,phone,whatsapp_number,email,institution_type,preferred_institution,status,admin_notes,created_at,metadata")
        .eq("source_page", "applications_hub")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    if (institutionResult.error) toast.error("Could not load Applications Hub institutions");
    else setInstitutions((institutionResult.data ?? []) as InstitutionRow[]);

    if (requestResult.error) toast.error("Could not load live application requests");
    else setRequests((requestResult.data ?? []) as AssistanceRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution.id === form.id) ?? null,
    [form.id, institutions],
  );

  const filteredRequests = useMemo(
    () => requests.filter((request) => requestFilter === "all" || request.status === requestFilter),
    [requestFilter, requests],
  );

  const patchForm = <K extends keyof InstitutionForm>(key: K, value: InstitutionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveInstitution = async () => {
    if (!form.slug.trim() || !form.short_name.trim() || !form.display_name.trim()) {
      toast.error("Slug, short name and display name are required");
      return;
    }
    if (form.matcher_enabled && !form.matcher_key) {
      toast.error("Select a matcher key before enabling Course Match");
      return;
    }

    setSaving(true);
    const payload = {
      institution_id: form.institution_id ?? null,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      category: form.category,
      short_name: form.short_name.trim(),
      display_name: form.display_name.trim(),
      city: form.city.trim() || "Pretoria",
      province: form.province.trim() || "Gauteng",
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      brand_primary: form.brand_primary || null,
      brand_secondary: form.brand_secondary || null,
      application_url: form.application_url.trim() || null,
      official_url: form.official_url.trim() || null,
      matcher_key: form.matcher_key || null,
      matcher_enabled: form.matcher_enabled,
      featured: form.featured,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 100,
      updated_at: new Date().toISOString(),
    };

    const query = form.id
      ? (supabase as any).from("application_hub_institutions").update(payload).eq("id", form.id)
      : (supabase as any).from("application_hub_institutions").insert(payload);
    const { error } = await query;

    if (error) {
      console.error("Institution save failed", error);
      toast.error(error.message ?? "Could not save institution");
    } else {
      toast.success(form.id ? "Institution updated" : "Institution added");
      await loadData();
      if (!form.id) setForm(emptyForm());
    }
    setSaving(false);
  };

  const uploadBrandAsset = async (file: File, field: "logo_url" | "cover_image_url") => {
    if (!form.slug.trim()) {
      toast.error("Enter an institution slug before uploading an image");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    setUploadingField(field);
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const path = `applications-hub/${form.slug.trim().toLowerCase()}/${field}-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("admin-images").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });

    if (error) {
      console.error("Brand asset upload failed", error);
      toast.error(error.message ?? "Could not upload image");
    } else {
      const { data } = supabase.storage.from("admin-images").getPublicUrl(path);
      patchForm(field, data.publicUrl);
      toast.success(field === "logo_url" ? "Logo uploaded" : "Cover image uploaded");
    }
    setUploadingField(null);
  };

  const updateRequest = async (requestId: string, patch: Record<string, unknown>) => {
    const { error } = await (supabase as any)
      .from("application_support_queries")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) {
      toast.error("Could not update request");
      return;
    }
    setRequests((current) => current.map((request) => (request.id === requestId ? { ...request, ...patch } as AssistanceRequest : request)));
    toast.success("Request updated");
  };

  return (
    <AdminLayout>
      <SEO
        title="Applications Hub | Admin"
        description="Manage institution cards, official application routes, branding and R50 live application guidance requests."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-2">Pretoria v1</Badge>
            <h1 className="text-3xl font-black tracking-tight">Applications Hub</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control the student-facing institution directory, branding, official application links and live application support queue.
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Directory records</p><p className="mt-1 text-2xl font-black">{institutions.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Course Match enabled</p><p className="mt-1 text-2xl font-black">{institutions.filter((item) => item.matcher_enabled).length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Live-call requests</p><p className="mt-1 text-2xl font-black">{requests.length}</p></CardContent></Card>
        </div>

        <div className="flex gap-2 rounded-xl border bg-card p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("institutions")}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "institutions" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Institutions & branding
          </button>
          <button
            type="button"
            onClick={() => setView("requests")}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === "requests" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Live-call queue {requests.length > 0 && <span className="ml-1 opacity-70">({requests.length})</span>}
          </button>
        </div>

        {view === "institutions" ? (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="self-start xl:sticky xl:top-16">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">Directory</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setForm(emptyForm())}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  institutions.map((institution) => (
                    <button
                      key={institution.id}
                      type="button"
                      onClick={() => setForm(toForm(institution))}
                      className={`w-full rounded-xl border p-3 text-left transition hover:border-primary/60 ${form.id === institution.id ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-black text-white"
                          style={{ backgroundColor: institution.brand_primary ?? "#4454A6" }}
                        >
                          {institution.logo_url ? <img src={institution.logo_url} alt="" className="h-full w-full bg-white object-contain p-1" /> : institution.short_name}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{institution.display_name}</p>
                          <p className="text-[11px] text-muted-foreground">{institution.category.replace("_", " ")} • {institution.city}</p>
                        </div>
                        {!institution.is_active && <Badge variant="secondary">Hidden</Badge>}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{form.id ? `Edit ${selectedInstitution?.short_name ?? "institution"}` : "Add institution"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Display name *</label>
                    <Input value={form.display_name} onChange={(event) => patchForm("display_name", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Short name *</label>
                    <Input value={form.short_name} onChange={(event) => patchForm("short_name", event.target.value.toUpperCase())} placeholder="UP" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Slug *</label>
                    <Input value={form.slug} onChange={(event) => patchForm("slug", event.target.value)} placeholder="university-name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Category</label>
                    <select value={form.category} onChange={(event) => patchForm("category", event.target.value as HubCategory)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="university">University</option>
                      <option value="tvet">TVET College</option>
                      <option value="private_college">Private College</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">City</label>
                    <Input value={form.city} onChange={(event) => patchForm("city", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Province</label>
                    <Input value={form.province} onChange={(event) => patchForm("province", event.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold">Student-facing description</label>
                  <Textarea value={form.description} onChange={(event) => patchForm("description", event.target.value)} rows={3} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border p-4">
                    <div className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary" /><p className="font-bold">Logo</p></div>
                    <div className="flex min-h-24 items-center justify-center rounded-xl bg-muted/50 p-3">
                      {form.logo_url ? <img src={form.logo_url} alt="Logo preview" className="max-h-20 max-w-full object-contain" /> : <p className="text-xs text-muted-foreground">No logo uploaded</p>}
                    </div>
                    <Input value={form.logo_url} onChange={(event) => patchForm("logo_url", event.target.value)} placeholder="Logo URL" />
                    <label className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">
                      {uploadingField === "logo_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload logo
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadBrandAsset(event.target.files[0], "logo_url")} />
                    </label>
                  </div>

                  <div className="space-y-3 rounded-2xl border p-4">
                    <div className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary" /><p className="font-bold">Card cover</p></div>
                    <div className="flex min-h-24 items-center justify-center overflow-hidden rounded-xl bg-muted/50">
                      {form.cover_image_url ? <img src={form.cover_image_url} alt="Cover preview" className="h-24 w-full object-cover" /> : <p className="text-xs text-muted-foreground">Uses brand-colour fallback</p>}
                    </div>
                    <Input value={form.cover_image_url} onChange={(event) => patchForm("cover_image_url", event.target.value)} placeholder="Cover image URL" />
                    <label className="flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">
                      {uploadingField === "cover_image_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload cover
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadBrandAsset(event.target.files[0], "cover_image_url")} />
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Brand primary</label>
                    <div className="flex gap-2"><Input type="color" value={form.brand_primary} onChange={(event) => patchForm("brand_primary", event.target.value)} className="w-14 p-1" /><Input value={form.brand_primary} onChange={(event) => patchForm("brand_primary", event.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Brand secondary</label>
                    <div className="flex gap-2"><Input type="color" value={form.brand_secondary} onChange={(event) => patchForm("brand_secondary", event.target.value)} className="w-14 p-1" /><Input value={form.brand_secondary} onChange={(event) => patchForm("brand_secondary", event.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Official application URL</label>
                    <Input value={form.application_url} onChange={(event) => patchForm("application_url", event.target.value)} placeholder="https://…" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Official institution URL</label>
                    <Input value={form.official_url} onChange={(event) => patchForm("official_url", event.target.value)} placeholder="https://…" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Matcher key</label>
                    <select value={form.matcher_key} onChange={(event) => patchForm("matcher_key", event.target.value as MatcherKey)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">No matcher</option>
                      <option value="tut">TUT</option>
                      <option value="up">UP</option>
                      <option value="unisa">UNISA</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Sort order</label>
                    <Input type="number" value={form.sort_order} onChange={(event) => patchForm("sort_order", Number(event.target.value))} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-xl border p-3"><Checkbox checked={form.is_active} onCheckedChange={(checked) => patchForm("is_active", checked === true)} /><span className="text-sm font-semibold">Visible to students</span></label>
                  <label className="flex items-center gap-3 rounded-xl border p-3"><Checkbox checked={form.featured} onCheckedChange={(checked) => patchForm("featured", checked === true)} /><span className="text-sm font-semibold">Featured</span></label>
                  <label className="flex items-center gap-3 rounded-xl border p-3"><Checkbox checked={form.matcher_enabled} onCheckedChange={(checked) => patchForm("matcher_enabled", checked === true)} /><span className="text-sm font-semibold">Course Match enabled</span></label>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Student card preview</p>
                  <div className="max-w-lg overflow-hidden rounded-2xl border bg-card">
                    <div className="flex h-24 items-center justify-between px-5 text-white" style={{ background: `linear-gradient(120deg, ${form.brand_primary}, ${form.brand_secondary})` }}>
                      <span className="text-3xl font-black">{form.short_name || "NEW"}</span>
                      <GraduationCap className="h-10 w-10 opacity-30" />
                    </div>
                    <div className="p-4">
                      <p className="font-bold">{form.display_name || "Institution name"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{form.description || "Institution description will appear here."}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="lg" onClick={saveInstitution} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {form.id ? "Save changes" : "Add to directory"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black">R50 live application guidance queue</h2>
                    <p className="mt-1 text-xs text-muted-foreground">The R50 fee applies to the live assisted call only; Course Match remains free.</p>
                  </div>
                  <select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="all">All statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filteredRequests.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredRequests.map((request) => {
                  const metadata = request.metadata ?? {};
                  const preferredDate = metadata.preferred_call_date ? String(metadata.preferred_call_date) : "Any date";
                  const preferredTime = metadata.preferred_call_time ? String(metadata.preferred_call_time) : "Any time";
                  const fee = Number(metadata.service_fee_zar ?? 50);
                  return (
                    <Card key={request.id}>
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{request.full_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{request.preferred_institution || "Institution not specified"}</p>
                          </div>
                          <Badge>{`R${fee}`}</Badge>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <a href={`tel:${request.phone ?? request.whatsapp_number ?? ""}`} className="flex items-center gap-2 rounded-xl border p-3 hover:bg-muted">
                            <PhoneCall className="h-4 w-4 text-primary" /><span>{request.phone || request.whatsapp_number || "No phone"}</span>
                          </a>
                          <div className="flex items-center gap-2 rounded-xl border p-3">
                            <CalendarClock className="h-4 w-4 text-primary" /><span>{preferredDate} • {preferredTime}</span>
                          </div>
                        </div>
                        {request.email && <p className="text-xs text-muted-foreground">Email: {request.email}</p>}

                        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold">Status</label>
                            <select
                              value={request.status}
                              onChange={(event) => updateRequest(request.id, { status: event.target.value })}
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="in_progress">In progress</option>
                              <option value="completed">Completed</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold">Internal notes</label>
                            <div className="flex gap-2">
                              <Input
                                defaultValue={request.admin_notes ?? ""}
                                placeholder="Callback outcome / payment note…"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") updateRequest(request.id, { admin_notes: event.currentTarget.value });
                                }}
                              />
                              <Button variant="outline" onClick={(event) => {
                                const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                                updateRequest(request.id, { admin_notes: input?.value ?? "" });
                              }}>Save</Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
                          <span>Requested {new Date(request.created_at).toLocaleString()}</span>
                          <Badge variant="outline">{request.institution_type.replace("_", " ")}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed"><CardContent className="p-10 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-bold">No requests in this view</p></CardContent></Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminApplicationHub;