import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BedDouble,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Images,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import TrustScore from "@/components/TrustScore";
import ReviewCard from "@/components/ReviewCard";
import ReviewForm from "@/components/ReviewForm";
import ResidenceBrandStudioCard from "@/components/findmyres/ResidenceBrandStudioCard";
import ResidenceMapPreview from "@/components/findmyres/ResidenceMapPreview";
import { ReferralBanner } from "@/components/referrals/ReferralBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { captureApplicationReferral } from "@/lib/referrals/referralApi";
import { readReferral, savePendingApplication } from "@/lib/referrals/referralStorage";
import { toast } from "sonner";

type RoomPrice = {
  id: string;
  name: string;
  description?: string | null;
  academic_year?: number | null;
  capacity?: number | null;
  available_beds?: number | null;
  private_price?: number | null;
  nsfas_price?: number | null;
  deposit?: number | null;
  admin_fee?: number | null;
  reservation_fee?: number | null;
  promo_price?: number | null;
  price_verified_at?: string | null;
};

const money = (value: unknown) => {
  const amount = Number(value || 0);
  return amount > 0 ? `R${amount.toLocaleString("en-ZA")}` : null;
};

const normalizeImage = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const candidate = (value as any).url || (value as any).src || (value as any).image_url;
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  }
  return null;
};

const getImages = (residence: any) => {
  const raw = Array.isArray(residence?.images)
    ? residence.images
    : Array.isArray(residence?.gallery_images)
      ? residence.gallery_images
      : [];
  const candidates = [residence?.cover_image_url, ...raw, residence?.image_url, residence?.studio_image_url]
    .map(normalizeImage)
    .filter(Boolean) as string[];
  return Array.from(new Set(candidates));
};

const ResidenceDetail = () => {
  const params = useParams<{ id?: string; slug?: string }>();
  const routeKey = params.id || params.slug;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [residence, setResidence] = useState<any>(null);
  const [roomPrices, setRoomPrices] = useState<RoomPrice[]>([]);
  const [related, setRelated] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [institutionType, setInstitutionType] = useState("university");
  const [applicationNotes, setApplicationNotes] = useState("");
  const [fundingType, setFundingType] = useState("undecided");
  const [roomPreference, setRoomPreference] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const residenceId = residence?.id as string | undefined;
  const images = useMemo(() => getImages(residence), [residence]);
  const heroImage = images[0] || null;
  const privatePrice = money(residence?.promo_active && residence?.promo_price ? residence.promo_price : residence?.private_price || residence?.price);
  const nsfasPrice = money(residence?.nsfas_price);
  const available = Number(residence?.available_spots || 0);
  const capacity = Number(residence?.capacity || 0);
  const is2027Open = Boolean(residence?.reservations_2027_open);
  const locationLabel = residence?.place_label || residence?.campus || residence?.city || "Student accommodation";
  const amenities = Array.isArray(residence?.amenities) ? residence.amenities : [];
  const roomTypes = Array.isArray(residence?.room_types) && residence.room_types.length
    ? residence.room_types
    : residence?.room_type ? [residence.room_type] : [];

  useEffect(() => {
    const load = async () => {
      if (!routeKey) return setLoading(false);
      setLoading(true);
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeKey);
        const primary = isUuid
          ? await supabase.from("residences").select("*").eq("id", routeKey).maybeSingle()
          : await supabase.from("residences").select("*").eq("slug", routeKey).maybeSingle();
        let row = primary.data as any;
        if (!row) {
          const fallback = isUuid
            ? await supabase.from("residences").select("*").eq("slug", routeKey).maybeSingle()
            : await supabase.from("residences").select("*").eq("id", routeKey).maybeSingle();
          row = fallback.data as any;
        }
        setResidence(row || null);
        if (!row) return;

        const [pricingResult, relatedResult, reviewResult] = await Promise.all([
          (supabase as any).from("residence_room_pricing_public_v").select("*").eq("residence_id", row.id).order("academic_year", { ascending: false }).order("name"),
          supabase.from("residences").select("*").eq("campus", row.campus).neq("id", row.id).eq("is_visible", true).limit(4),
          supabase.from("reviews").select("*, user:profiles(full_name)").eq("residence_id", row.id).order("created_at", { ascending: false }),
        ]);
        setRoomPrices(pricingResult.data || []);
        setRelated(relatedResult.data || []);
        setReviews(reviewResult.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Could not load this residence.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [routeKey]);

  useEffect(() => {
    if (!user || !residenceId) return setHasApplied(false);
    void (async () => {
      const { data } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("residence_id", residenceId).maybeSingle();
      setHasApplied(Boolean(data));
    })();
  }, [user, residenceId]);

  const ensureProfileReady = async () => {
    if (!user) {
      const ref = readReferral();
      savePendingApplication({
        residence_id: residenceId!,
        residence_name: residence?.name,
        current_route: window.location.pathname,
        referral_code: ref?.code || null,
        referral_session_id: ref?.sessionId || null,
        timestamp: new Date().toISOString(),
      });
      navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return false;
    }
    const { data: profile } = await supabase.from("profiles").select("full_name,phone,phone_number,student_number,identity_number,campus").eq("id", user.id).maybeSingle();
    const phone = (profile as any)?.phone || (profile as any)?.phone_number;
    const identity = (profile as any)?.student_number || (profile as any)?.identity_number;
    if (!(profile as any)?.full_name || !phone || !identity || !(profile as any)?.campus) {
      toast.info("Complete your contact and identity details before continuing.");
      navigate(`/setup-profile?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return false;
    }
    return true;
  };

  const openApply = async () => {
    if (hasApplied) return toast.info("You already have an application for this residence.");
    if (available <= 0) return toast.error("Current applications are closed because this residence is full. You can still reserve for 2027 when reservations are open.");
    if (await ensureProfileReady()) setShowApply(true);
  };

  const openReserve = async () => {
    if (!is2027Open) return toast.info("2027 reservations are not open for this residence yet.");
    if (await ensureProfileReady()) setShowReserve(true);
  };

  const submitApplication = async () => {
    if (!user || !residenceId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("applications").insert({
        user_id: user.id,
        residence_id: residenceId,
        status: "submitted",
        notes: applicationNotes.trim() || null,
        institution_type: institutionType,
      } as any).select("id").single();
      if (error) throw error;
      const ref = readReferral();
      if (data?.id && (ref?.code || ref?.sessionId)) {
        await captureApplicationReferral(data.id, ref?.code || null, ref?.sessionId || null, ref?.programKey || null);
      }
      setHasApplied(true);
      setShowApply(false);
      setApplicationNotes("");
      toast.success("Application submitted successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Could not submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReservation = async () => {
    if (!user || !residenceId) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("accommodation_reservations").upsert({
        user_id: user.id,
        residence_id: residenceId,
        academic_year: 2027,
        funding_type: fundingType,
        room_preference: roomPreference.trim() || null,
        notes: reservationNotes.trim() || null,
        status: "reserved",
        source: "residence_detail",
      }, { onConflict: "user_id,residence_id,academic_year" });
      if (error) throw error;
      setShowReserve(false);
      setReservationNotes("");
      toast.success("Your 2027 reservation interest has been recorded.");
    } catch (error: any) {
      toast.error(error?.message || "Could not reserve this residence.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="mx-auto max-w-7xl p-6"><div className="h-80 animate-pulse rounded-3xl bg-muted" /></div></DashboardLayout>;
  if (!residence) return <DashboardLayout><div className="mx-auto max-w-xl px-6 py-24 text-center"><Building2 className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="mt-4 text-2xl font-black">Residence not found</h1><Button asChild className="mt-5"><Link to="/find">Back to accommodation</Link></Button></div></DashboardLayout>;

  const averageRating = reviews.length ? reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length : 0;
  const schemaImage = heroImage || residence.image_url || undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: residence.name,
    description: residence.description,
    image: images,
    address: { "@type": "PostalAddress", streetAddress: residence.address, addressLocality: residence.city || "Pretoria", addressRegion: residence.province || "Gauteng", addressCountry: "ZA" },
    amenityFeature: amenities.map((name: string) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    url: `https://www.reskonnect.org/res/${residence.id}`,
  };

  return (
    <DashboardLayout>
      <SEO title={`${residence.name} | Student Accommodation | ResKonnect`} description={residence.description || `View pricing, rooms, photos and 2027 reservations for ${residence.name}.`} imageUrl={schemaImage} jsonLd={jsonLd} />
      <div className="min-w-0 max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <ReferralBanner />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link><span>/</span><Link to="/find" className="hover:text-foreground">Accommodation</Link><span>/</span><span className="max-w-[55vw] truncate font-semibold text-foreground">{residence.name}</span>
          </div>

          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#000F2F] text-white shadow-2xl">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#000F2F_0%,#000F2F_52%,#06285a_100%)]" />
            <div className="absolute -right-[10%] top-0 h-full w-[55%] bg-[#082f68]/65 [clip-path:polygon(32%_0,100%_0,100%_100%,0_100%)]" />
            <div className="absolute -right-[5%] bottom-0 h-[36%] w-[48%] bg-[#E09008] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
            <div className="relative z-10 grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr,.85fr] lg:p-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[#000F2F] shadow-lg"><img src={BRAND.logos.icon} alt="" className="h-8 w-8 object-contain" /><span className="font-black">ResKonnect</span></div>
                  <Badge className="bg-[#E09008] font-black text-[#00102f] hover:bg-[#E09008]">{residence.brand_badge || "RESKONNECT LIVING"}</Badge>
                  {is2027Open && <Badge className="border border-white/20 bg-white/10 text-white hover:bg-white/10">2027 RESERVATIONS OPEN</Badge>}
                  {residence.promo_active && <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">{residence.promo_badge || "PROMO"}</Badge>}
                </div>

                <div className="mt-7 max-w-3xl">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2AE28]">{locationLabel}</p>
                  <h1 className="mt-2 break-words text-4xl font-black uppercase leading-[.94] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{residence.brand_headline || residence.name}</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">{residence.brand_subheadline || residence.description || "Student accommodation, connected."}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {residence.is_trusted || residence.trusted ? <Badge className="bg-white/10 text-white hover:bg-white/10"><ShieldCheck className="mr-1 h-3.5 w-3.5 text-[#F2AE28]" />Trusted listing</Badge> : null}
                    {residence.is_tut_accredited && <Badge className="bg-white/10 text-white hover:bg-white/10"><GraduationCap className="mr-1 h-3.5 w-3.5 text-[#F2AE28]" />TUT accredited</Badge>}
                    {residence.accepts_nsfas && <Badge className="bg-white/10 text-white hover:bg-white/10">NSFAS context</Badge>}
                    {residence.gender && <Badge className="bg-white/10 text-white hover:bg-white/10">{residence.gender}</Badge>}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-2">
                  <Button onClick={() => void openReserve()} disabled={!is2027Open} className="bg-[#E09008] font-black text-[#00102f] hover:bg-[#F2AE28]"><Sparkles className="mr-2 h-4 w-4" />Reserve for 2027</Button>
                  <Button onClick={() => void openApply()} disabled={hasApplied || available <= 0} variant="secondary">{hasApplied ? <><CheckCircle2 className="mr-2 h-4 w-4" />Already applied</> : available <= 0 ? "Currently full" : "Apply now"}</Button>
                  <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="full" />
                  <FavoriteButton residenceId={residence.id} />
                  <ShareButton title={`${residence.name} - Student Accommodation`} text={`View ${residence.name} on ResKonnect. ${residence.address || locationLabel}`} imageUrl={schemaImage} variant="icon" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] border border-white/15 bg-[#041a40] shadow-2xl" onClick={() => heroImage && setShowLightbox(true)}>
                  {heroImage ? <img src={heroImage} alt={`${residence.name} accommodation`} className="h-full w-full cursor-zoom-in object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_65%_25%,rgba(224,144,8,.24),transparent_35%),linear-gradient(135deg,#06285a,#00102f)]"><Building2 className="h-20 w-20 text-white/20" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#00102f]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#00102f]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]"><Camera className="h-3.5 w-3.5 text-[#E09008]" />{images.length ? `${images.length} ${images.length === 1 ? "photo" : "photos"}` : "Photos pending"}</div>
                  <div className="absolute bottom-3 right-3 rounded-full bg-[#E09008] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#00102f]">Property preview</div>
                </div>
                {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{images.slice(0, 6).map((src, index) => <button key={src} onClick={() => { setLightboxIndex(index); setShowLightbox(true); }} className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#041a40]"><img src={src} alt="" className="h-full w-full object-cover" /></button>)}</div>}
              </div>
            </div>
          </section>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr),360px]">
            <div className="min-w-0 space-y-5">
              {residence.promo_active && <Card className="overflow-hidden border-[#E09008]/30 bg-[#E09008]/[0.06]"><CardContent className="p-5"><div className="flex items-start gap-3"><Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#E09008]" /><div><p className="font-black">{residence.promo_title || "Residence promotion"}</p><p className="mt-1 text-sm text-muted-foreground">{residence.promo_description || "A promotional accommodation offer is currently available."}</p>{residence.promo_room_type && <Badge variant="outline" className="mt-3">{residence.promo_room_type}</Badge>}</div></div></CardContent></Card>}

              <Card><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">About this residence</p><h2 className="mt-1 text-2xl font-black">Living details</h2></div><TrustScore verificationLevel={residence.verification_level || "basic"} averageRating={averageRating} reviewCount={reviews.length} /></div><p className="mt-4 text-sm leading-7 text-muted-foreground">{residence.description || "Property information is being completed by the residence through the ResKonnect Property OS."}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Info icon={MapPin} label="Location" value={residence.address || locationLabel} /><Info icon={Users} label="Available spots" value={capacity > 0 ? `${available} / ${capacity}` : `${available}`} /><Info icon={BedDouble} label="Room types" value={roomTypes.length ? roomTypes.join(", ") : "Contact ResKonnect"} /><Info icon={Clock3} label="Distance" value={residence.distance_from_campus || "Map available"} /></div></CardContent></Card>

              {roomPrices.length > 0 && <Card><CardContent className="p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">Room-level pricing</p><h2 className="mt-1 text-2xl font-black">Choose the right room</h2><p className="mt-1 text-sm text-muted-foreground">Private and NSFAS-funded prices are stored separately and are never assumed to be equal.</p></div><div className="mt-5 grid gap-3 md:grid-cols-2">{roomPrices.map((room) => <div key={room.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{room.name}</p><p className="mt-1 text-xs text-muted-foreground">{room.academic_year || 2027} pricing · {room.available_beds ?? 0} bed(s) available</p></div>{room.price_verified_at && <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">Verified</Badge>}</div><div className="mt-4 grid grid-cols-2 gap-2"><PriceTile label="Private" value={money(room.promo_price || room.private_price) || "Not listed"} /><PriceTile label="NSFAS" value={money(room.nsfas_price) || "Funded rate separate"} /></div>{(room.deposit || room.admin_fee || room.reservation_fee) && <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><MiniFee label="Deposit" value={money(room.deposit)} /><MiniFee label="Admin" value={money(room.admin_fee)} /><MiniFee label="Reserve" value={money(room.reservation_fee)} /></div>}{room.description && <p className="mt-3 text-xs leading-5 text-muted-foreground">{room.description}</p>}</div>)}</div></CardContent></Card>}

              <Card><CardContent className="p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">What you get</p><h2 className="mt-1 text-2xl font-black">Amenities</h2></div>{amenities.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2 md:grid-cols-3">{amenities.map((amenity: string) => <div key={amenity} className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-3 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />{amenity}</div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Amenities are being completed by the residence.</p>}</CardContent></Card>

              <Card><CardContent className="p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">Location</p><h2 className="mt-1 text-2xl font-black">Find the residence</h2></div><div className="mt-4"><ResidenceMapPreview name={residence.name} address={residence.address} latitude={residence.latitude} longitude={residence.longitude} compact={false} /></div></CardContent></Card>

              <Card><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">Student experience</p><h2 className="mt-1 text-2xl font-black">Reviews</h2></div>{user && <Button variant="outline" onClick={() => setShowReview(!showReview)}>Write a review</Button>}</div>{showReview && user && <div className="mt-5"><ReviewForm residenceId={residence.id} onReviewSubmitted={() => { setShowReview(false); window.location.reload(); }} /></div>}<div className="mt-5 space-y-3">{reviews.length ? reviews.map((review) => <ReviewCard key={review.id} review={review} onHelpful={async (reviewId) => { const current = reviews.find((r) => r.id === reviewId); await supabase.from("reviews").update({ helpful_count: Number(current?.helpful_count || 0) + 1 }).eq("id", reviewId); setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, helpful_count: Number(r.helpful_count || 0) + 1 } : r)); }} />) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No reviews yet.</div>}</div></CardContent></Card>
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              <Card className="overflow-hidden border-0 shadow-xl ring-1 ring-border"><div className="bg-[#000F2F] px-5 py-4 text-white"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E09008]">Pricing & availability</p><p className="mt-1 text-lg font-black">{residence.name}</p></div><img src={BRAND.logos.icon} alt="" className="h-9 w-9 rounded-lg bg-white p-1" /></div></div><CardContent className="space-y-4 p-5"><div className="grid grid-cols-2 gap-2"><PriceTile label="Private" value={privatePrice || "Not listed"} /><PriceTile label="NSFAS" value={nsfasPrice || "Separate funded rate"} /></div>{residence.price_verified_at && <div className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.07] px-3 py-2 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" />Pricing verified {new Date(residence.price_verified_at).toLocaleDateString("en-ZA")}</div>}<div className="grid gap-2"><Info icon={Users} label="Available now" value={capacity ? `${available} of ${capacity} beds` : `${available} beds`} /><Info icon={WalletCards} label="2027 reservations" value={is2027Open ? "Open" : "Not open yet"} /><Info icon={BedDouble} label="Room type" value={roomTypes.length ? roomTypes.join(", ") : "To be confirmed"} /></div>{is2027Open && <div className="rounded-2xl border border-[#E09008]/30 bg-[#E09008]/[0.06] p-4"><p className="font-black">2027 intake</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{residence.reservations_2027_note || "Reserve your interest for the 2027 intake. A reservation is not a final lease or placement confirmation."}</p></div>}<Button onClick={() => void openReserve()} disabled={!is2027Open} className="w-full bg-[#E09008] font-black text-[#00102f] hover:bg-[#F2AE28]">Reserve for 2027</Button><Button onClick={() => void openApply()} disabled={hasApplied || available <= 0} variant="outline" className="w-full">{hasApplied ? "Already applied" : available <= 0 ? "Currently full" : "Apply for current intake"}</Button><WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="full" /></CardContent></Card>
            </aside>
          </div>

          {related.length > 0 && <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#E09008]">Explore nearby</p><h2 className="mt-1 text-2xl font-black">Similar accommodation</h2></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{related.map((item) => <Link key={item.id} to={`/res/${item.id}`} className="block min-w-0"><ResidenceBrandStudioCard residence={item} className="transition-transform duration-300 hover:-translate-y-1" /></Link>)}</div></section>}
        </div>
      </div>

      <Dialog open={showApply} onOpenChange={setShowApply}><DialogContent><DialogHeader><DialogTitle>Apply to {residence.name}</DialogTitle><DialogDescription>Submit one application for this residence. ResKonnect prevents duplicate applications to the same property.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Applicant type</Label><Select value={institutionType} onValueChange={setInstitutionType}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="university">University student</SelectItem><SelectItem value="tvet">TVET / college</SelectItem><SelectItem value="private">Private applicant / tenant</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label>Application note</Label><Textarea className="mt-1.5 min-h-[110px]" value={applicationNotes} onChange={(e) => setApplicationNotes(e.target.value)} placeholder="Room preference, move-in timing or anything ResKonnect should know." /></div><Button onClick={() => void submitApplication()} disabled={submitting} className="w-full">{submitting ? "Submitting..." : "Submit application"}</Button></div></DialogContent></Dialog>

      <Dialog open={showReserve} onOpenChange={setShowReserve}><DialogContent><DialogHeader><DialogTitle>Reserve interest for 2027</DialogTitle><DialogDescription>This records your 2027 accommodation interest with ResKonnect. It is not a final lease or guaranteed placement.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Expected funding</Label><Select value={fundingType} onValueChange={setFundingType}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="undecided">Undecided</SelectItem><SelectItem value="private">Private / self-funded</SelectItem><SelectItem value="nsfas">NSFAS-funded</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label>Room preference</Label><Input className="mt-1.5" value={roomPreference} onChange={(e) => setRoomPreference(e.target.value)} placeholder={roomTypes[0] || "Single, sharing, bachelor..."} /></div><div><Label>Notes</Label><Textarea className="mt-1.5 min-h-[100px]" value={reservationNotes} onChange={(e) => setReservationNotes(e.target.value)} placeholder="Move-in month, room preference or anything else." /></div><Button onClick={() => void submitReservation()} disabled={submitting} className="w-full bg-[#E09008] font-black text-[#00102f] hover:bg-[#F2AE28]">{submitting ? "Saving..." : "Reserve 2027 interest"}</Button></div></DialogContent></Dialog>

      {showLightbox && images.length > 0 && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-3" onClick={() => setShowLightbox(false)}><button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" onClick={() => setShowLightbox(false)}><X className="h-6 w-6" /></button>{images.length > 1 && <><button className="absolute left-3 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}><ChevronLeft className="h-7 w-7" /></button><button className="absolute right-3 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}><ChevronRight className="h-7 w-7" /></button></>}<img src={images[lightboxIndex]} alt={`${residence.name} photo ${lightboxIndex + 1}`} className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} /><div className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"><Images className="mr-1.5 inline h-3.5 w-3.5" />{lightboxIndex + 1} / {images.length}</div></div>}
    </DashboardLayout>
  );
};

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border bg-muted/20 p-3"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0 text-[#E09008]" />{label}</div><p className="mt-1 break-words text-sm font-black">{value || "—"}</p></div>;
}

function PriceTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#000F2F] p-3 text-white"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E09008]">{label}</p><p className="mt-1 text-lg font-black leading-tight">{value}</p><p className="text-[10px] text-white/55">per month where applicable</p></div>;
}

function MiniFee({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg bg-muted/40 px-2 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-bold">{value || "—"}</p></div>;
}

export default ResidenceDetail;
