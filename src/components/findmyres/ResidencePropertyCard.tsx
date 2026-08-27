import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Bed, CalendarDays, Car, MapPin, Sofa, Sparkles, Tag, Users, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import FavoriteButton from "@/components/FavoriteButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import ResidenceMapPreview from "./ResidenceMapPreview";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { StatusBadge, residenceStatus } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CATEGORY_ACCENT: Record<string, string> = {
  flats: "from-violet to-pink",
  communes: "from-coral to-amber",
  student_residences: "from-sky to-primary",
  private_rentals: "from-mint to-sky",
};

interface ResidencePropertyCardProps { residence: any; onApply: (residence: any) => void; matchScore?: number; }
const money = (value: number) => `R${Number(value || 0).toLocaleString("en-ZA")}`;
const feeText = (value: any) => Number(value) > 0 ? money(Number(value)) : null;

export function ResidencePropertyCard({ residence, onApply, matchScore }: ResidencePropertyCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reservationOpen, setReservationOpen] = useState(false);
  const [fundingType, setFundingType] = useState("undecided");
  const [roomPreference, setRoomPreference] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [reserving, setReserving] = useState(false);

  const spots = Number(residence.available_spots) || 0;
  const isFull = spots === 0;
  const basePrice = Number(residence.price) || 0;
  const privatePrice = Number(residence.private_price) || (residence.accepts_private ? basePrice : 0);
  const nsfasPrice = Number(residence.nsfas_price) || 0;
  const promoPrice = Number(residence.promo_price) || 0;
  const distance = Number(residence.distance_from_campus) || 0;
  const status = residenceStatus(residence);
  const slug = residence.slug || residence.id;
  const accent = CATEGORY_ACCENT[residence.category as string] || "from-primary to-violet";
  const isSpotlight = residence.is_spotlight === true;
  const reservations2027 = residence.reservations_2027_open === true;
  const roomPricing = Array.isArray(residence.room_pricing) ? residence.room_pricing.filter((r: any) => r?.is_active !== false) : [];
  const configuredRoomTypes = roomPricing.map((r: any) => r.name).filter(Boolean);
  const roomTypes = Array.from(new Set([...(configuredRoomTypes || []), ...((residence.room_types || [residence.room_type]).filter(Boolean) as string[])]));
  const hasSingles = roomTypes.some((t: string) => t.toLowerCase().includes("single"));
  const singlesAvailable = Number(residence.singles_available) || 0;
  const verifiedPricing = Boolean(residence.price_verified_at) || roomPricing.some((r: any) => Boolean(r.price_verified_at));
  const contactPhone = residence.whatsapp_phone || residence.contact_phone || RESKONNECT_WHATSAPP;

  const promoLive = useMemo(() => {
    if (residence.promo_active !== true) return false;
    const now = Date.now();
    const starts = residence.promo_starts_at ? new Date(residence.promo_starts_at).getTime() : null;
    const ends = residence.promo_ends_at ? new Date(residence.promo_ends_at).getTime() : null;
    return (!starts || starts <= now) && (!ends || ends >= now);
  }, [residence.promo_active, residence.promo_starts_at, residence.promo_ends_at]);

  const pricedRooms = roomPricing.slice().sort((a: any, b: any) => Number(a.private_price || a.nsfas_price || 999999) - Number(b.private_price || b.nsfas_price || 999999));
  const cheapestPrivate = pricedRooms.map((r: any) => Number(r.promo_price || r.private_price || 0)).filter((n: number) => n > 0).sort((a: number,b: number) => a-b)[0];
  const displayPrivate = cheapestPrivate || (promoLive && promoPrice > 0 ? promoPrice : (privatePrice || basePrice));

  const openReservation = (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (!user) { toast.info("Sign in to reserve for the 2027 intake."); navigate(`/auth?returnTo=${encodeURIComponent(`/find?reserve=2027&residence=${slug}`)}`); return; }
    setReservationOpen(true);
  };

  const submitReservation = async () => {
    if (!user) return;
    setReserving(true);
    try {
      const { error } = await (supabase as any).from("accommodation_reservations").upsert({
        user_id: user.id, residence_id: residence.id, academic_year: 2027, funding_type: fundingType,
        room_preference: roomPreference || null, notes: reservationNotes || null, status: "reserved", source: "find_my_res_card",
      }, { onConflict: "user_id,residence_id,academic_year" });
      if (error) throw error;
      toast.success(`2027 reservation saved for ${residence.name}`); setReservationOpen(false);
    } catch (error: any) { toast.error(error?.message || "Could not save your 2027 reservation."); }
    finally { setReserving(false); }
  };

  return <>
    <Card role="link" tabIndex={0} onClick={() => navigate(`/find-my-res/${slug}`)} onKeyDown={(e) => { if (e.key === "Enter") navigate(`/find-my-res/${slug}`); }} className={cn("group cursor-pointer overflow-hidden rounded-2xl border-border/50 transition-all duration-300","hover:-translate-y-1 hover:border-transparent hover:shadow-premium")}>
      <div className={cn("h-1.5 w-full bg-gradient-to-r", accent)} />
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img src={residence.image_url || "/placeholder.svg"} alt={`${residence.name} student accommodation${residence.address ? ` in ${residence.address}` : ""} listed on ResKonnect`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }} />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <StatusBadge variant={status} label={status === "limited" ? `${spots} LEFT` : undefined} />
          {reservations2027 && <Badge className="border-0 bg-primary text-primary-foreground shadow-md"><CalendarDays className="mr-1 h-3 w-3" />2027 OPEN</Badge>}
          {promoLive && <Badge className="border-0 bg-amber-500 text-white shadow-md"><Tag className="mr-1 h-3 w-3" />{residence.promo_badge || "PROMO"}</Badge>}
          {verifiedPricing && <Badge className="border-0 bg-emerald-600 text-white shadow-md"><BadgeCheck className="mr-1 h-3 w-3" />PRICE VERIFIED</Badge>}
          {isSpotlight && <Badge className="border-0 bg-gradient-spotlight text-white shadow-md"><Sparkles className="mr-1 h-3 w-3" />Spotlight</Badge>}
        </div>
        {matchScore !== undefined && matchScore > 0 && <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-vibrant text-xs font-bold text-white shadow-lg">{matchScore}%</div>}
        <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}><FavoriteButton residenceId={residence.id} variant="icon" className="h-8 w-8 bg-background/85 backdrop-blur-sm" /><WhatsAppButton phone={contactPhone} residenceName={residence.name} variant="icon" className="h-8 w-8 bg-background/85 backdrop-blur-sm" /></div>
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-2"><span className="inline-flex items-baseline gap-0.5 rounded-full bg-gradient-price px-3 py-1 text-white shadow-sm"><span className="text-lg font-bold">{money(displayPrivate)}</span><span className="text-xs opacity-90">/mo</span></span></div><p className="mt-1 text-[10px] font-medium text-muted-foreground">{roomPricing.length ? "From verified room-level pricing" : residence.accepts_private ? "Private tenant rate" : "Published residence rate"}</p></div><div className="flex shrink-0 flex-wrap justify-end gap-1">{residence.accepts_nsfas && <Badge className="border border-mint/40 bg-mint/15 text-[10px] text-mint">NSFAS</Badge>}{residence.is_tut_accredited && <Badge className="border border-sky/40 bg-sky/15 text-[10px] text-sky">TUT ✓</Badge>}{residence.accepts_tvet && <Badge className="border border-amber/40 bg-amber/15 text-[10px] text-amber">TVET</Badge>}{residence.accepts_private && <Badge className="border border-violet/40 bg-violet/15 text-[10px] text-violet">Private</Badge>}</div></div>

        {roomPricing.length > 0 ? <div className="space-y-2 rounded-xl border bg-muted/25 p-2.5"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wide">Room options</p><span className="text-[10px] text-muted-foreground">2027 pricing</span></div>{pricedRooms.slice(0,3).map((room: any) => <div key={room.id || room.name} className="grid grid-cols-[1fr,auto] gap-2 rounded-lg bg-background p-2 text-xs"><div><p className="font-semibold">{room.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{Number(room.available_beds || 0)} beds available{feeText(room.deposit) ? ` · Deposit ${feeText(room.deposit)}` : ""}</p></div><div className="text-right"><p className="font-bold">Private {Number(room.promo_price || room.private_price || 0) > 0 ? money(Number(room.promo_price || room.private_price)) : "—"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">NSFAS {Number(room.nsfas_price || 0) > 0 ? money(Number(room.nsfas_price)) : "funded rate"}</p></div></div>)}</div> : (residence.accepts_nsfas || residence.accepts_private) && <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-2.5 text-xs"><div><p className="font-semibold">Private</p><p className="mt-0.5 text-muted-foreground">{privatePrice > 0 ? `${money(privatePrice)}/mo` : "Ask residence"}</p></div><div className="border-l pl-2"><p className="font-semibold">NSFAS-funded</p><p className="mt-0.5 text-muted-foreground">{nsfasPrice > 0 ? `${money(nsfasPrice)}/mo` : "Separate funded rate"}</p></div><p className="col-span-2 text-[10px] leading-relaxed text-muted-foreground">Private and NSFAS-funded rates are separate commercial arrangements.</p></div>}

        {promoLive && <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><div className="flex items-center gap-2 text-xs font-bold"><Tag className="h-3.5 w-3.5" />{residence.promo_title || "Accommodation promotion"}</div>{residence.promo_description && <p className="mt-1 text-[11px] leading-relaxed opacity-80">{residence.promo_description}</p>}</div>}

        <h3 className="line-clamp-1 text-base font-semibold">{residence.name}</h3>
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="line-clamp-1">{residence.address}</span>{distance > 0 && <span className="ml-auto shrink-0 text-xs font-medium text-coral">{distance}km</span>}</div>
        <div onClick={(e) => e.stopPropagation()}><ResidenceMapPreview name={residence.name} address={residence.address} latitude={residence.latitude} longitude={residence.longitude} /></div>
        <div className="flex flex-wrap gap-1.5">{roomTypes.slice(0,4).map((type: string) => <Badge key={type} className="border border-violet/30 bg-violet/10 text-xs capitalize text-violet"><Bed className="mr-1 h-3 w-3" />{type}</Badge>)}{(singlesAvailable > 0 || hasSingles) && <Badge className="border border-mint/40 bg-mint/15 text-xs text-mint">{singlesAvailable > 0 ? `${singlesAvailable} Singles` : "Singles"}</Badge>}{residence.gender && <Badge className="border border-pink/30 bg-pink/10 text-xs capitalize text-pink">{residence.gender}</Badge>}</div>
        {(residence.is_furnished || residence.has_wifi || residence.has_parking) && <div className="flex items-center gap-3 text-xs text-muted-foreground">{residence.is_furnished && <span className="flex items-center gap-1"><Sofa className="h-3.5 w-3.5" />Furnished</span>}{residence.has_wifi && <span className="flex items-center gap-1"><Wifi className="h-3.5 w-3.5" />WiFi</span>}{residence.has_parking && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />Parking</span>}</div>}
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /><span>{roomPricing.length ? `${roomPricing.reduce((n: number,r: any) => n + Number(r.available_beds || 0),0)} configured beds available` : `${spots} / ${residence.capacity || "—"} current spots`}</span></div>

        {reservations2027 && <div className="rounded-xl border border-primary/25 bg-primary/5 p-3"><div className="flex items-center gap-2 text-xs font-bold"><CalendarDays className="h-4 w-4 text-primary" />2027 reservations now open</div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Reserve your interest now. A reservation is not a final lease until confirmed.</p><Button className="mt-2 w-full" size="sm" onClick={openReservation}>Reserve for 2027</Button></div>}

        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/find-my-res/${slug}`); }}>View Residence</Button><Button className={!isFull ? "bg-gradient-vibrant text-white" : ""} variant={isFull ? "outline" : "default"} disabled={isFull} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isFull) onApply(residence); }}>{isFull ? "Currently Full" : "Apply Now"}</Button></div>
        <Button variant="outline" className="w-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`https://wa.me/${String(contactPhone).replace(/\s/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(`Hi, I would like to request a viewing for ${residence.name}.`)}`, "_blank", "noopener"); }}>Request Viewing / WhatsApp</Button>
      </CardContent>
    </Card>

    <Dialog open={reservationOpen} onOpenChange={setReservationOpen}><DialogContent onClick={(e) => e.stopPropagation()}><DialogHeader><DialogTitle>Reserve {residence.name} for 2027</DialogTitle><DialogDescription>Tell us how you expect the accommodation to be funded. Private and NSFAS-funded rates are handled separately.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Expected funding</Label><Select value={fundingType} onValueChange={setFundingType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="undecided">Not sure yet</SelectItem><SelectItem value="private">Private / self-funded</SelectItem><SelectItem value="nsfas">NSFAS-funded</SelectItem><SelectItem value="other">Other funding</SelectItem></SelectContent></Select></div>{roomTypes.length > 0 && <div className="space-y-2"><Label>Room preference</Label><Select value={roomPreference} onValueChange={setRoomPreference}><SelectTrigger><SelectValue placeholder="Choose a room type" /></SelectTrigger><SelectContent>{roomTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2"><Label>Notes (optional)</Label><Textarea value={reservationNotes} onChange={(e) => setReservationNotes(e.target.value)} placeholder="Move-in month, room preference or anything the residence should know." /></div><div className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">A reservation records your 2027 interest and puts you into the residence follow-up flow. Final placement remains subject to room availability, funding status, documents and residence confirmation.</div></div><DialogFooter><Button variant="outline" onClick={() => setReservationOpen(false)}>Not now</Button><Button onClick={submitReservation} disabled={reserving}>{reserving ? "Saving..." : "Save 2027 reservation"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
