import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BedDouble, CheckCircle2, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ResidencePortalContext } from "./ResidenceLayout";

const emptyRoom = { name: "", academic_year: 2027, capacity: 0, available_beds: 0, private_price: "", nsfas_price: "", deposit: "", admin_fee: "", reservation_fee: "", promo_price: "" };
const money = (value: any) => value === null || value === undefined || value === "" ? "—" : `R${Number(value).toLocaleString("en-ZA")}`;

const ResidenceInventory = () => {
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [rooms, setRooms] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(emptyRoom);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("residence_room_types").select("*").eq("residence_id", residence.id).order("academic_year", { ascending: false }).order("name");
    if (!error) setRooms(data || []);
    setLoading(false);
  }, [residence?.id]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    capacity: rooms.filter((r) => r.is_active !== false).reduce((n, r) => n + Number(r.capacity || 0), 0),
    available: rooms.filter((r) => r.is_active !== false).reduce((n, r) => n + Number(r.available_beds || 0), 0),
    verified: rooms.filter((r) => Boolean(r.price_verified_at)).length,
  }), [rooms]);

  const numeric = (value: any) => value === "" || value === null || value === undefined ? null : Number(value);

  const createRoom = async () => {
    if (!residence?.id || !draft.name.trim()) return toast.error("Enter a room type name");
    setSaving("new");
    const { error } = await (supabase as any).from("residence_room_types").insert({
      residence_id: residence.id,
      name: draft.name.trim(),
      academic_year: Number(draft.academic_year || 2027),
      capacity: Number(draft.capacity || 0),
      available_beds: Number(draft.available_beds || 0),
      private_price: numeric(draft.private_price), nsfas_price: numeric(draft.nsfas_price),
      deposit: numeric(draft.deposit), admin_fee: numeric(draft.admin_fee), reservation_fee: numeric(draft.reservation_fee), promo_price: numeric(draft.promo_price),
      is_active: true,
    });
    setSaving(null);
    if (error) return toast.error(error.message || "Could not add room type");
    setDraft(emptyRoom); toast.success("Room type added"); void load();
  };

  const updateRoom = async (room: any, patch: Record<string, any>) => {
    setSaving(room.id);
    const { error } = await (supabase as any).from("residence_room_types").update(patch).eq("id", room.id);
    setSaving(null);
    if (error) return toast.error(error.message || "Could not save pricing");
    toast.success("Room pricing saved"); void load();
  };

  const verifyRoom = async (room: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await updateRoom(room, { price_verified_at: new Date().toISOString(), price_verified_by: user.id });
  };

  const removeRoom = async (room: any) => {
    const { error } = await (supabase as any).from("residence_room_types").update({ is_active: false }).eq("id", room.id);
    if (error) return toast.error(error.message);
    toast.success("Room type archived"); void load();
  };

  if (!residence) return <div className="py-16 text-center text-sm text-muted-foreground">Loading residence inventory…</div>;

  return <>
    <SEO noIndex title={`Inventory & Pricing | ${residence.name} | ResKonnect`} description={`Room inventory and verified pricing for ${residence.name}.`} />
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-primary">Landlord Portal 2.0</p><h1 className="mt-1 text-3xl font-black">Room inventory & pricing</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage availability and keep private, NSFAS-funded and promotional prices separate for every room type.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Configured capacity</p><p className="mt-2 text-3xl font-black">{totals.capacity}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Available beds</p><p className="mt-2 text-3xl font-black text-primary">{totals.available}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Verified price sets</p><p className="mt-2 text-3xl font-black">{totals.verified}/{rooms.filter((r) => r.is_active !== false).length}</p></CardContent></Card>
      </div>

      <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />Add a room type</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Room type","name","Single / Sharing / Bachelor","text"], ["Academic year","academic_year","2027","number"], ["Capacity","capacity","0","number"], ["Available beds","available_beds","0","number"],
          ["Private monthly rate","private_price","e.g. 3000","number"], ["NSFAS-funded rate","nsfas_price","Funded rate","number"], ["Deposit","deposit","Optional","number"], ["Admin fee","admin_fee","Optional","number"], ["Reservation fee","reservation_fee","Optional","number"], ["Promo price","promo_price","Optional","number"],
        ].map(([label,key,placeholder,type]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input type={type} value={draft[key]} placeholder={placeholder} onChange={(e) => setDraft((d: any) => ({ ...d, [key]: e.target.value }))} /></div>)}
        <div className="flex items-end sm:col-span-2"><Button className="w-full" onClick={() => void createRoom()} disabled={saving === "new"}><Plus className="mr-2 h-4 w-4" />Add room type</Button></div>
      </CardContent></Card>

      {loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading room inventory…</CardContent></Card> : rooms.filter((r) => r.is_active !== false).length === 0 ? <Card><CardContent className="py-16 text-center"><BedDouble className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-bold">No room-level inventory configured yet</p><p className="mt-1 text-sm text-muted-foreground">Add your real room types above. ResKonnect will never invent a rate on your behalf.</p></CardContent></Card> : <div className="space-y-4">
        {rooms.filter((r) => r.is_active !== false).map((room) => <Card key={room.id}><CardContent className="p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{room.name}</h2><Badge variant="outline">{room.academic_year}</Badge>{room.price_verified_at ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Price verified</Badge> : <Badge variant="secondary">Verification needed</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Private {money(room.private_price)} · NSFAS {money(room.nsfas_price)} · {room.available_beds}/{room.capacity} beds available</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void verifyRoom(room)}><ShieldCheck className="mr-1.5 h-4 w-4" />Verify</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeRoom(room)}><Trash2 className="h-4 w-4" /></Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[["Capacity","capacity"],["Available","available_beds"],["Private rate","private_price"],["NSFAS rate","nsfas_price"],["Promo price","promo_price"],["Deposit","deposit"],["Admin fee","admin_fee"],["Reservation fee","reservation_fee"]].map(([label,key]) => <div key={key} className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type="number" defaultValue={room[key] ?? ""} onBlur={(e) => { const val = e.target.value === "" ? null : Number(e.target.value); if (val !== room[key]) void updateRoom(room, { [key]: val }); }} /></div>)}
            <div className="flex items-end lg:col-span-2"><Button variant="outline" className="w-full" disabled={saving === room.id} onClick={() => toast.info("Fields save automatically when you leave them.")}><Save className="mr-2 h-4 w-4" />Autosave enabled</Button></div>
          </div>
        </CardContent></Card>)}
      </div>}
    </div>
  </>;
};

export default ResidenceInventory;
