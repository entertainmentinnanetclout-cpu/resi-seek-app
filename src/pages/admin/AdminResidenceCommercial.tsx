import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Search, Tag, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Residence = {
  id: string; name: string; address: string | null; campus: string | null; image_url: string | null;
  price: number | null; private_price: number | null; nsfas_price: number | null;
  reservations_2027_open: boolean; reservations_2027_note: string | null;
  latitude: number | null; longitude: number | null;
  promo_active: boolean; promo_title: string | null; promo_description: string | null; promo_badge: string | null;
  promo_price: number | null; promo_room_type: string | null; promo_starts_at: string | null; promo_ends_at: string | null;
};

const n = (value: string) => value.trim() === "" ? null : Number(value);
const local = (value: string | null) => value ? new Date(value).toISOString().slice(0,16) : "";
const iso = (value: string) => value ? new Date(value).toISOString() : null;

export const AdminResidenceCommercialContent = () => {
  const [rows, setRows] = useState<Residence[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Residence | null>(null);
  const [saving, setSaving] = useState(false);
  const db = supabase as any;

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("residences").select("id,name,address,campus,image_url,price,private_price,nsfas_price,reservations_2027_open,reservations_2027_note,latitude,longitude,promo_active,promo_title,promo_description,promo_badge,promo_price,promo_room_type,promo_starts_at,promo_ends_at").order("name");
    if (error) toast.error(error.message || "Could not load residence settings");
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => `${r.name} ${r.address || ""} ${r.campus || ""}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const open2027 = rows.filter((r) => r.reservations_2027_open).length;
  const promoCount = rows.filter((r) => r.promo_active).length;
  const coordCount = rows.filter((r) => r.latitude != null && r.longitude != null).length;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      private_price: editing.private_price,
      nsfas_price: editing.nsfas_price,
      reservations_2027_open: editing.reservations_2027_open,
      reservations_2027_note: editing.reservations_2027_note || null,
      latitude: editing.latitude,
      longitude: editing.longitude,
      promo_active: editing.promo_active,
      promo_title: editing.promo_title || null,
      promo_description: editing.promo_description || null,
      promo_badge: editing.promo_badge || null,
      promo_price: editing.promo_price,
      promo_room_type: editing.promo_room_type || null,
      promo_starts_at: editing.promo_starts_at,
      promo_ends_at: editing.promo_ends_at,
    };
    const { error } = await db.from("residences").update(payload).eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message || "Could not save residence settings");
    toast.success("Residence commercial settings saved"); setEditing(null); await load();
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">2027, Pricing, Promotions & Maps</h2><p className="mt-1 text-sm text-muted-foreground">Control private and NSFAS-funded rates separately, open 2027 reservations, run room/price promotions and maintain exact map coordinates.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><CalendarDays className="h-5 w-5 text-primary"/><p className="mt-2 text-2xl font-black">{open2027}</p><p className="text-xs text-muted-foreground">Open for 2027</p></CardContent></Card>
      <Card><CardContent className="p-4"><Tag className="h-5 w-5 text-amber-500"/><p className="mt-2 text-2xl font-black">{promoCount}</p><p className="text-xs text-muted-foreground">Active promo flags</p></CardContent></Card>
      <Card><CardContent className="p-4"><MapPin className="h-5 w-5 text-emerald-500"/><p className="mt-2 text-2xl font-black">{coordCount}/{rows.length}</p><p className="text-xs text-muted-foreground">Exact coordinates saved</p></CardContent></Card>
    </div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search residence, campus or address…"/></div>
    {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading residence controls…</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((r)=><Card key={r.id} className="overflow-hidden"><div className="aspect-[16/7] bg-muted">{r.image_url?<img src={r.image_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-violet/15"><MapPin className="h-8 w-8 text-primary"/></div>}</div><CardContent className="p-4">
        <div className="flex flex-wrap gap-1">{r.reservations_2027_open&&<Badge>2027 OPEN</Badge>}{r.promo_active&&<Badge className="bg-amber-500 text-white">PROMO</Badge>}{r.latitude!=null&&r.longitude!=null&&<Badge variant="outline">PIN SET</Badge>}</div>
        <h3 className="mt-2 font-bold">{r.name}</h3><p className="line-clamp-1 text-xs text-muted-foreground">{r.address || "Address not set"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2 text-xs"><div><span className="font-semibold">Private</span><p>{r.private_price ? `R${Number(r.private_price).toLocaleString()}` : "Not set"}</p></div><div><span className="font-semibold">NSFAS</span><p>{r.nsfas_price ? `R${Number(r.nsfas_price).toLocaleString()}` : "Not set"}</p></div></div>
        <Button variant="outline" className="mt-3 w-full" onClick={()=>setEditing({...r})}>Manage</Button>
      </CardContent></Card>)}
    </div>}

    <Dialog open={Boolean(editing)} onOpenChange={(v)=>{if(!v)setEditing(null)}}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editing?.name}</DialogTitle><DialogDescription>Funding-specific prices, 2027 reservations, promotions and exact map coordinates.</DialogDescription></DialogHeader>{editing&&<div className="space-y-6 py-2">
      <section className="rounded-2xl border p-4"><div className="mb-4 flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary"/><h3 className="font-bold">Funding-specific monthly prices</h3></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Private tenant rate (R/month)</Label><Input type="number" value={editing.private_price ?? ""} onChange={(e)=>setEditing({...editing,private_price:n(e.target.value)})}/></div><div className="space-y-2"><Label>NSFAS-funded rate (R/month)</Label><Input type="number" value={editing.nsfas_price ?? ""} onChange={(e)=>setEditing({...editing,nsfas_price:n(e.target.value)})}/></div></div><p className="mt-3 text-xs text-muted-foreground">These are intentionally separate. Do not use the private rate as the NSFAS rate unless the residence explicitly confirms they are identical.</p></section>
      <section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="font-bold">2027 reservations</h3><p className="text-xs text-muted-foreground">Allow students to reserve interest for the 2027 intake.</p></div><Switch checked={editing.reservations_2027_open} onCheckedChange={(v)=>setEditing({...editing,reservations_2027_open:v})}/></div><div className="mt-3 space-y-2"><Label>Reservation note</Label><Textarea rows={2} value={editing.reservations_2027_note || ""} onChange={(e)=>setEditing({...editing,reservations_2027_note:e.target.value})} placeholder="Optional residence-specific 2027 terms"/></div></section>
      <section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="font-bold">Promotion</h3><p className="text-xs text-muted-foreground">Price promo, room promo or limited campaign.</p></div><Switch checked={editing.promo_active} onCheckedChange={(v)=>setEditing({...editing,promo_active:v})}/></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Promo headline</Label><Input value={editing.promo_title || ""} onChange={(e)=>setEditing({...editing,promo_title:e.target.value})}/></div><div className="space-y-2"><Label>Badge</Label><Input value={editing.promo_badge || ""} onChange={(e)=>setEditing({...editing,promo_badge:e.target.value})} placeholder="PRIVATE PROMO"/></div><div className="space-y-2"><Label>Promo price (R)</Label><Input type="number" value={editing.promo_price ?? ""} onChange={(e)=>setEditing({...editing,promo_price:n(e.target.value)})}/></div><div className="space-y-2"><Label>Promo room type</Label><Input value={editing.promo_room_type || ""} onChange={(e)=>setEditing({...editing,promo_room_type:e.target.value})} placeholder="Single room"/></div><div className="space-y-2 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={editing.promo_description || ""} onChange={(e)=>setEditing({...editing,promo_description:e.target.value})}/></div><div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={local(editing.promo_starts_at)} onChange={(e)=>setEditing({...editing,promo_starts_at:iso(e.target.value)})}/></div><div className="space-y-2"><Label>Ends</Label><Input type="datetime-local" value={local(editing.promo_ends_at)} onChange={(e)=>setEditing({...editing,promo_ends_at:iso(e.target.value)})}/></div></div></section>
      <section className="rounded-2xl border p-4"><div className="mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/><div><h3 className="font-bold">Exact map pin</h3><p className="text-xs text-muted-foreground">Cards already fall back to the address when a pin is missing. Add exact coordinates here for a precise location.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={editing.latitude ?? ""} onChange={(e)=>setEditing({...editing,latitude:n(e.target.value)})}/></div><div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={editing.longitude ?? ""} onChange={(e)=>setEditing({...editing,longitude:n(e.target.value)})}/></div></div></section>
    </div>}<DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving?"Saving…":"Save settings"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
};

export default AdminResidenceCommercialContent;
