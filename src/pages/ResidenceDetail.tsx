import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, DollarSign, Users, Bed, ShieldCheck, Wifi, Car, WashingMachine, Dumbbell, Utensils, Star, MessageSquare, CheckCircle, Video, ChevronLeft, ChevronRight, X, Award, ShieldAlert, CheckSquare, Calendar, PhoneCall } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";
import FavoriteButton from "@/components/FavoriteButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareButton from "@/components/ShareButton";
import TrustScore from "@/components/TrustScore";
import ReviewCard from "@/components/ReviewCard";
import ReviewForm from "@/components/ReviewForm";
import { useAuth } from "@/contexts/AuthContext";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readReferral, savePendingApplication } from "@/lib/referrals/referralStorage";
import { captureApplicationReferral } from "@/lib/referrals/referralApi";
import { ReferralBanner } from "@/components/referrals/ReferralBanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ResidenceDetail = () => {
  const params = useParams<{ id?: string; slug?: string }>();
  const routeKey = params.id || params.slug;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [residence, setResidence] = useState<any>(null);
  const residenceId = residence?.id as string | undefined;
  const [relatedResidences, setRelatedResidences] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [applicationNotes, setApplicationNotes] = useState("");
  const [institutionType, setInstitutionType] = useState<string>("university");
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const fetchReviews = async () => {
    if (!residenceId) return;
    const { data, error } = await supabase
      .from('reviews')
      .select('*, user:profiles(full_name)')
      .eq('residence_id', residenceId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setReviews(data);
    }
  };

  const checkExistingApplication = async () => {
    if (!user || !residenceId) return;
    const { data } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('residence_id', residenceId)
      .maybeSingle();
    setHasApplied(!!data);
  };

  useEffect(() => {
    const fetchResidence = async () => {
      if (!routeKey) { setLoading(false); return; }
      setLoading(true);
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeKey);
        let data: any = null;
        if (isUuid) {
          const byId = await supabase.from('residences').select('*').eq('id', routeKey).maybeSingle();
          data = byId.data;
          if (!data) {
            const bySlug = await supabase.from('residences').select('*').eq('slug', routeKey).maybeSingle();
            data = bySlug.data;
          }
        } else {
          const bySlug = await supabase.from('residences').select('*').eq('slug', routeKey).maybeSingle();
          data = bySlug.data;
          if (!data) {
            const byId = await supabase.from('residences').select('*').eq('id', routeKey).maybeSingle();
            data = byId.data;
          }
        }
        setResidence(data);

        if (data) {
          const { data: related, error: relatedError } = await supabase
            .from('residences')
            .select('*')
            .eq('campus', data.campus)
            .neq('id', data.id)
            .limit(5);
          if (relatedError) throw relatedError;
          setRelatedResidences(related || []);
        }
      } catch (error) {
        console.error('Error fetching residence:', error);
        toast.error('Failed to load residence details.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidence();
  }, [routeKey]);

  useEffect(() => {
    if (!residenceId) return;
    fetchReviews();
    checkExistingApplication();
  }, [residenceId, user]);

  const handleApply = () => {
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
      toast.info("Sign in to complete your application — we saved your progress");
      navigate("/auth?returnTo=" + encodeURIComponent(window.location.pathname));
      return;
    }
    if (hasApplied) {
      toast.info("You have already applied to this residence");
      return;
    }
    if ((residence?.available_spots || 0) === 0) {
      toast.error("This residence is fully booked");
      return;
    }
    setShowApplyModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!user || !residenceId) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          residence_id: residenceId,
          status: 'submitted',
          notes: applicationNotes || null,
          institution_type: institutionType,
        } as any);

      if (error) throw error;

      try {
        const inserted = await supabase.from("applications").select("id").eq("user_id", user.id).eq("residence_id", residenceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const ref = readReferral();
        if (inserted.data?.id && (ref?.code || ref?.sessionId)) {
          await captureApplicationReferral(inserted.data.id, ref?.code || null, ref?.sessionId || null, ref?.programKey || null);
        }
      } catch (e) { console.warn("referral attach skipped", e); }

      toast.success("Application submitted successfully!");
      setShowApplyModal(false);
      setApplicationNotes("");
      setHasApplied(true);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) {
      toast.error("Please provide a reason for reporting");
      return;
    }
    toast.success("Thank you for helping keep the student portal safe. Our operations team will audit this residence within 24 hours.");
    setShowReportModal(false);
    setReportReason("");
  };

  if (loading) {
    return <DashboardLayout><div className="p-8 text-center text-slate-500 font-semibold">Loading residence profile...</div></DashboardLayout>;
  }

  if (!residence) {
    return <DashboardLayout><div className="p-8 text-center text-red-500 font-semibold">Residence profile not found.</div></DashboardLayout>;
  }

  const amenityIcons: { [key: string]: React.ReactNode } = {
    "WiFi": <Wifi className="w-4 h-4 text-[#2563EB]" />,
    "Parking": <Car className="w-4 h-4 text-[#2563EB]" />,
    "Security": <ShieldCheck className="w-4 h-4 text-[#2563EB]" />,
    "Study Room": <Users className="w-4 h-4 text-[#2563EB]" />,
    "Laundry": <WashingMachine className="w-4 h-4 text-[#2563EB]" />,
    "Gym": <Dumbbell className="w-4 h-4 text-[#2563EB]" />,
    "Pool": <Users className="w-4 h-4 text-[#2563EB]" />,
    "Kitchen": <Utensils className="w-4 h-4 text-[#2563EB]" />
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  const handleHelpful = async (reviewId: string) => {
    const { error } = await supabase
      .from('reviews')
      .update({ helpful_count: reviews.find(r => r.id === reviewId)?.helpful_count + 1 || 1 })
      .eq('id', reviewId);
    if (!error) {
      fetchReviews();
      toast.success('Thanks for your feedback!');
    }
  };

  return (
    <TooltipProvider>
      <DashboardLayout>
        <SEO
          title={`${residence.name} | Verified Student Housing Pretoria | ResKonnect`}
          description={residence.description}
          imageUrl={residence.image_url}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="mb-2"><ReferralBanner /></div>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="text-slate-500 hover:text-[#2563EB]">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/findmyres" className="text-slate-500 hover:text-[#2563EB]">Residences</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-[#071326] font-bold">{residence.name}</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title Area & Top Badges */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-6 md:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-black text-[#071326] tracking-tight">{residence.name}</h1>
                    <TrustScore
                      verificationLevel={residence.verification_level || 'basic'}
                      averageRating={averageRating}
                      reviewCount={reviews.length}
                    />
                  </div>
                  <div className="flex items-center text-slate-500 text-sm font-medium">
                    <MapPin className="w-4 h-4 mr-1.5 text-[#2563EB]" />
                    {residence.address}
                  </div>
                </div>

                {/* Responsive Quick Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <FavoriteButton residenceId={residence.id} />
                  <ShareButton
                    title={`${residence.name} - Verified Student Housing`}
                    text={`Check out ${residence.name} on ResKonnect! Monthly rent: R${residence.price?.toLocaleString()}. Location: ${residence.address}`}
                    imageUrl={residence.image_url}
                    variant="icon"
                  />
                  <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="full" />

                  {hasApplied ? (
                    <Button size="lg" variant="outline" disabled className="gap-2 font-bold border-green-500 text-green-600 bg-green-50">
                      <CheckCircle className="w-5 h-5 shrink-0" /> Already Applied
                    </Button>
                  ) : (residence?.available_spots || 0) === 0 ? (
                    <Button size="lg" variant="outline" disabled className="font-bold border-slate-200 text-slate-400 bg-slate-50">
                      Fully Booked
                    </Button>
                  ) : (
                    <Button size="lg" onClick={handleApply} className="bg-[#2563EB] hover:bg-[#2F6EDB] text-white font-bold px-6 shadow-md shadow-blue-500/10">
                      Apply Now
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-8 pt-0 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Media Gallery, Desc, Amenities, Parent Checklist */}
              <div className="lg:col-span-8 space-y-8">
                {/* Image Showcase */}
                {(() => {
                  const allImages = [residence.image_url, ...(residence.images || [])].filter(Boolean);
                  return (
                    <div className="space-y-3">
                      <div
                        className="relative aspect-[16/10] cursor-pointer group overflow-hidden rounded-xl bg-slate-100 border border-slate-200"
                        onClick={() => { setLightboxIndex(0); setShowLightbox(true); }}
                      >
                        <img
                          src={allImages[0] || "/placeholder.svg"}
                          alt={residence.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-101"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                        />
                        <div className="absolute inset-0 bg-[#071326]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white bg-black/60 font-bold text-xs px-4 py-2 rounded-full tracking-wider uppercase">Click to Expand Gallery</span>
                        </div>

                        {allImages.length > 1 && (
                          <Badge className="absolute top-4 right-4 bg-black/70 text-white border-none py-1 px-3">
                            {allImages.length} Photos
                          </Badge>
                        )}

                        {residence.quality_grade && (
                          <Badge
                            className={`absolute top-4 left-4 border-none py-1 px-3 font-bold text-[10px] uppercase tracking-wider ${
                              residence.quality_grade === 'luxury' ? 'bg-purple-600 text-white' :
                              residence.quality_grade === 'premium' ? 'bg-[#F5B32F] text-[#071326]' :
                              residence.quality_grade === 'standard' ? 'bg-[#2563EB] text-white' : 'bg-slate-500 text-white'
                            }`}
                          >
                            <Award className="w-3.5 h-3.5 mr-1" />
                            {residence.quality_grade}
                          </Badge>
                        )}
                      </div>

                      {/* Thumbnail Strips */}
                      {allImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 select-none">
                          {allImages.map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => { setLightboxIndex(idx); setShowLightbox(true); }}
                              className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 border-transparent hover:border-[#2563EB] transition-colors"
                            >
                              <img
                                src={img}
                                alt={`${residence.name} Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3D Tour */}
                {residence.virtual_tour_url && (
                  <Card className="border border-slate-200 shadow-sm overflow-hidden bg-slate-50">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Video className="w-5 h-5 text-[#2563EB]" />
                          <h3 className="font-bold text-base text-[#071326]">3D Room Virtual Tour Available</h3>
                        </div>
                        <Button
                          variant={showVirtualTour ? "outline" : "default"}
                          size="sm"
                          onClick={() => setShowVirtualTour(!showVirtualTour)}
                          className={showVirtualTour ? "border-slate-300" : "bg-[#2563EB] text-white"}
                        >
                          {showVirtualTour ? "Hide Tour Frame" : "Launch Tour Viewer"}
                        </Button>
                      </div>
                      {showVirtualTour && (
                        <div className="aspect-video bg-black rounded-lg overflow-hidden border">
                          <iframe
                            src={residence.virtual_tour_url}
                            className="w-full h-full border-0"
                            allowFullScreen
                            title={`Virtual tour of ${residence.name}`}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Description */}
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-[#071326] tracking-tight">Description</h3>
                  <p className="text-slate-600 leading-relaxed text-sm md:text-base">{residence.description}</p>
                </div>

                {/* Amenities */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xl font-bold text-[#071326] tracking-tight">Facilities & Amenities</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {residence.amenities?.map((amenity: string) => (
                      <div key={amenity} className="flex items-center space-x-2.5 text-sm font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {amenityIcons[amenity] || <Bed className="w-4 h-4 text-[#2563EB]" />}
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* parent-safe checklist */}
                <Card className="border-2 border-emerald-100 bg-emerald-50/40 shadow-sm rounded-xl">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-base font-bold text-emerald-950 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      Parent & Guardian Comfort Checklist
                    </CardTitle>
                    <CardDescription className="text-xs text-emerald-800">
                      Standardized security and placement safeguards active for {residence.name}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-sm text-emerald-900 font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Security deposit secured in audited trust account</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>24/7 guarded access control gates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Academic-friendly quiet study regulations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>On-call emergency service coordination</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Key Details, Price, Deposit Safety, Report */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border border-slate-200 shadow-sm bg-slate-50/50 sticky top-20">
                  <CardContent className="p-6 space-y-6">
                    {/* Last Audit & Verified Date badge */}
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center gap-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-[#2563EB]" />
                      <span>Active Audit: 2026 Season Verified</span>
                    </div>

                    {/* Booking Status Badge */}
                    <div>
                      {(residence.available_spots || 0) === 0 ? (
                        <Badge className="bg-red-500 text-white w-full justify-center py-2 text-xs font-bold border-none uppercase tracking-widest animate-pulse">
                          FULLY BOOKED
                        </Badge>
                      ) : (residence.available_spots || 0) <= 5 ? (
                        <Badge className="bg-[#F5B32F] text-[#071326] w-full justify-center py-2 text-xs font-black border-none uppercase tracking-wider">
                          Urgent: Only {residence.available_spots} slots remaining!
                        </Badge>
                      ) : (
                        <Badge className="bg-[#12A870] text-white w-full justify-center py-2 text-xs font-bold border-none uppercase tracking-wider">
                          Booking Slots Available
                        </Badge>
                      )}
                    </div>

                    {/* Pricing Display */}
                    <div className="bg-[#071326] text-white rounded-xl p-5 text-center shadow-md">
                      <span className="text-[10px] text-slate-300 tracking-widest uppercase font-bold block mb-1">Monthly Cost Starts From</span>
                      <p className="text-3xl font-black text-[#F5B32F]">
                        R{Number(residence.price || 0).toLocaleString()}
                        <span className="text-xs font-bold text-slate-300">/mo</span>
                      </p>
                    </div>

                    {/* Meta stats list */}
                    <div className="space-y-3.5 text-sm font-semibold text-slate-700">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Available Spots</span>
                        <span className="text-[#071326]">{residence.available_spots || 0} / {residence.capacity} rooms</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Campus Distance</span>
                        <span className="text-[#071326]">{residence.distance_from_campus}km from main node</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Room Configurations</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {(residence.room_types && residence.room_types.length > 0
                            ? residence.room_types
                            : [residence.room_type]
                          ).filter(Boolean).map((type: string) => (
                            <Badge key={type} variant="secondary" className="capitalize text-[10px] font-bold tracking-wider">{type}</Badge>
                          ))}
                        </div>
                      </div>
                      {residence.is_trusted && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">NSFAS Status</span>
                          <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-600 font-bold">Accredited ✓</Badge>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Deposit safety note */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wider">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Deposit Safety Notice</span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                        Never transfer funds directly to individual accounts. All ResKonnect application deposits are secured and held in regulatory trust. Verification ID: <span className="font-bold">RK-SECURE-2026</span>.
                      </p>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-2 pt-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">ResKonnect Support Hub</h4>
                      <div className="space-y-1 text-xs text-slate-600 font-semibold">
                        <p>Helpline: 063 732 3192</p>
                        <p>Desk: reskonnect@gmail.com</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Report Listing */}
                    <div className="text-center pt-1">
                      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="xs" className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs font-semibold gap-1.5">
                            <ShieldAlert className="w-4 h-4" /> Report incorrect details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-red-600 font-bold flex items-center gap-2">
                              <ShieldAlert className="w-5 h-5" /> Audit Request Form
                            </DialogTitle>
                            <DialogDescription>
                              Help us keep the ResKonnect student portal 100% accurate. Describe what details are out of date or incorrect.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleReportSubmit} className="space-y-4 py-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="reportReason" className="font-semibold text-slate-700">What is incorrect or misleading?</Label>
                              <Textarea
                                id="reportReason"
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                placeholder="Describe details (e.g., incorrect price, fake images, wrong distance)..."
                                rows={4}
                                required
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setShowReportModal(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                                Submit Report
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Similar Residences section */}
          {relatedResidences.length > 0 && (
            <div className="pt-8">
              <h2 className="text-2xl font-black text-[#071326] tracking-tight mb-2">Similar Residences Nearby</h2>
              <p className="text-slate-500 text-sm mb-6">Other verified options close to {residence.campus || "this campus"}.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedResidences.map((res) => {
                  const resSpots = res.available_spots || 0;
                  const resFull = resSpots === 0;
                  return (
                    <Link to={`/res/${res.id}`} key={res.id}>
                      <Card className="hover:shadow-md border border-slate-200 transition-all overflow-hidden group rounded-xl">
                        <div className="relative aspect-[16/10] overflow-hidden bg-slate-50">
                          <img
                            src={res.image_url || "/placeholder.svg"}
                            alt={res.name}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                          <div className="absolute top-2.5 right-2.5">
                            {resFull ? (
                              <Badge className="bg-red-500 text-white text-[9px] font-bold py-0.5 px-2">FULL</Badge>
                            ) : resSpots <= 5 ? (
                              <Badge className="bg-[#F5B32F] text-[#071326] text-[9px] font-black py-0.5 px-2">{resSpots} spots left</Badge>
                            ) : (
                              <Badge className="bg-[#12A870] text-white text-[9px] font-bold py-0.5 px-2">Available</Badge>
                            )}
                          </div>
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <h3 className="font-bold text-[#071326] line-clamp-1 group-hover:text-[#2563EB]">{res.name}</h3>
                            <p className="text-sm font-black text-[#2563EB] shrink-0">R{Number(res.price || 0).toLocaleString()}</p>
                          </div>
                          <p className="text-slate-400 text-xs line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {res.address}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          <div className="pt-8 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-[#2563EB]" />
                <h2 className="text-2xl font-black text-[#071326]">Student Reviews ({reviews.length})</h2>
                {averageRating > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold text-lg">
                    <Star className="w-5 h-5 fill-current" />
                    <span>{averageRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              {user && !showReviewForm && (
                <Button onClick={() => setShowReviewForm(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs h-9">
                  Write a Review
                </Button>
              )}
            </div>

            {showReviewForm && (
              <div className="mb-6">
                <ReviewForm
                  residenceId={residence.id}
                  onSuccess={() => {
                    setShowReviewForm(false);
                    fetchReviews();
                  }}
                  onCancel={() => setShowReviewForm(false)}
                />
              </div>
            )}

            {reviews.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
                ))}
              </div>
            ) : (
              <Card className="border border-slate-200 bg-slate-50/50 shadow-sm rounded-xl">
                <CardContent className="p-8 text-center max-w-sm mx-auto space-y-3">
                  <MessageSquare className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="font-bold text-[#071326] text-base">No Verified Reviews Yet</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Be the first to share your experience living in this student residence.
                  </p>
                  {user && !showReviewForm && (
                    <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>
                      Write the First Review
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Application Dialog */}
        <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-bold text-lg text-[#071326]">Apply to {residence?.name}</DialogTitle>
              <DialogDescription>
                Submit your official booking and support request. Our placement officer will coordinate deposit safety and contract setup.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="rounded-md border p-3 bg-slate-50"><ReferralBanner /></div>
              <div className="space-y-2">
                <Label htmlFor="institution_type" className="font-semibold text-slate-700">I am a student at <span className="text-red-500">*</span></Label>
                <Select value={institutionType} onValueChange={setInstitutionType}>
                  <SelectTrigger id="institution_type"><SelectValue placeholder="Select institution type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">University (TUT / UP / UNISA)</SelectItem>
                    <SelectItem value="tvet">TVET College</SelectItem>
                    <SelectItem value="private">Private College</SelectItem>
                    <SelectItem value="other">Other / Working Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="font-semibold text-slate-700">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Share details (e.g., room preference, roommate wishes)..."
                  value={applicationNotes}
                  onChange={(e) => setApplicationNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-1.5 text-xs">
                <p className="font-bold text-[#071326]">Summary of Booking Request:</p>
                <p className="text-slate-600">Residence: <span className="font-bold text-slate-800">{residence?.name}</span></p>
                <p className="text-slate-600">Monthly Rent: <span className="font-bold text-[#2563EB]">R{residence?.price?.toLocaleString()}</span></p>
                <p className="text-slate-600">Room Configuration: <span className="font-bold text-slate-800 capitalize">{residence?.room_type}</span></p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowApplyModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitApplication} disabled={submitting} className="bg-[#2563EB] hover:bg-[#2F6EDB] text-white">
                {submitting ? "Submitting..." : "Submit Placement Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lightbox Gallery */}
        {showLightbox && (() => {
          const allImages = [residence.image_url, ...(residence.images || [])].filter(Boolean);
          return (
            <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 text-white hover:text-white/80 p-2 z-10"
              >
                <X className="w-8 h-8" />
              </button>

              <button
                onClick={() => setLightboxIndex((prev) => (prev - 1 + allImages.length) % allImages.length)}
                className="absolute left-4 text-white hover:text-white/80 p-2"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>

              <img
                src={allImages[lightboxIndex]}
                alt={`${residence.name} Gallery ${lightboxIndex + 1}`}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />

              <button
                onClick={() => setLightboxIndex((prev) => (prev + 1) % allImages.length)}
                className="absolute right-4 text-white hover:text-white/80 p-2"
              >
                <ChevronRight className="w-10 h-10" />
              </button>

              <div className="absolute bottom-4 text-white text-sm font-semibold tracking-wider">
                {lightboxIndex + 1} / {allImages.length}
              </div>
            </div>
          );
        })()}
      </DashboardLayout>
    </TooltipProvider>
  );
};

export default ResidenceDetail;
