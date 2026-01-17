
import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, DollarSign, Users, Bed, ShieldCheck, Wifi, Car, WashingMachine, Dumbbell, Utensils, Star, MessageSquare, CheckCircle, Video, ChevronLeft, ChevronRight, X, Award } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ResidenceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [residence, setResidence] = useState<any>(null);
  const [relatedResidences, setRelatedResidences] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [applicationNotes, setApplicationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const fetchReviews = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('reviews')
      .select('*, user:profiles(full_name)')
      .eq('residence_id', id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setReviews(data);
    }
  };

  const checkExistingApplication = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('residence_id', id)
      .maybeSingle();
    setHasApplied(!!data);
  };

  useEffect(() => {
    const fetchResidence = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('residences').select('*').eq('id', id).single();
        if (error) throw error;
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

        await fetchReviews();
        await checkExistingApplication();
      } catch (error) {
        console.error('Error fetching residence:', error);
        toast.error('Failed to load residence details.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidence();
  }, [id, user]);

  const handleApply = () => {
    if (!user) {
      toast.error("Please sign in to apply");
      navigate("/auth");
      return;
    }
    if (hasApplied) {
      toast.info("You have already applied to this residence");
      return;
    }
    setShowApplyModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!user || !id) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          residence_id: id,
          status: 'submitted',
          notes: applicationNotes || null,
        });

      if (error) throw error;

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

  if (loading) {
    return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  }

  if (!residence) {
    return <DashboardLayout><div className="p-8">Residence not found.</div></DashboardLayout>;
  }

  const accommodationSchema = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    "name": residence.name,
    "description": residence.description,
    "image": residence.image_url,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": residence.address,
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "postalCode": "0002",
      "addressCountry": "ZA"
    },
    "amenityFeature": residence.amenities?.map((amenity: string) => ({
      "@type": "LocationFeatureSpecification",
      "name": amenity,
      "value": true
    })),
    "url": `https://reskonnect.co.za/res/${residence.id}`
  };

  const amenityIcons: { [key: string]: React.ReactNode } = {
    "WiFi": <Wifi className="w-4 h-4" />,
    "Parking": <Car className="w-4 h-4" />,
    "Security": <ShieldCheck className="w-4 h-4" />,
    "Study Room": <Users className="w-4 h-4" />,
    "Laundry": <WashingMachine className="w-4 h-4" />,
    "Gym": <Dumbbell className="w-4 h-4" />,
    "Pool": <Users className="w-4 h-4" />,
    "Kitchen": <Utensils className="w-4 h-4" />
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
        title={`${residence.name} | ResKonnect`}
        description={residence.description}
        imageUrl={residence.image_url}
      />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb className="mb-4">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/find">Residences</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink>{residence.name}</BreadcrumbLink>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-3xl font-bold">{residence.name}</CardTitle>
                        <TrustScore 
                          verificationLevel={residence.verification_level || 'basic'}
                          averageRating={averageRating}
                          reviewCount={reviews.length}
                        />
                      </div>
                      <div className="flex items-center text-muted-foreground mt-2">
                          <MapPin className="w-4 h-4 mr-2" />
                          {residence.address}
                      </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center gap-2 flex-wrap">
                      <FavoriteButton residenceId={residence.id} />
                      <ShareButton 
                        title={`${residence.name} - Student Accommodation`}
                        text={`Check out ${residence.name} on ResKonnect! R${residence.price?.toLocaleString()}/month. ${residence.address}`}
                        imageUrl={residence.image_url}
                        variant="icon"
                      />
                      <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="full" />
                      {hasApplied ? (
                        <Button size="lg" variant="outline" disabled className="gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Already Applied
                        </Button>
                      ) : (
                        <Button size="lg" onClick={handleApply}>Apply Now</Button>
                      )}
                  </div>
              </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        {/* GOD MODE Image Gallery with Slideshow */}
                        {(() => {
                          const allImages = [residence.image_url, ...(residence.images || [])].filter(Boolean);
                          return (
                            <div className="space-y-4 mb-8">
                              {/* Main Image */}
                              <div 
                                className="relative aspect-[16/9] cursor-pointer group"
                                onClick={() => { setLightboxIndex(0); setShowLightbox(true); }}
                              >
                                <img 
                                  src={allImages[0] || "/placeholder.svg"} 
                                  alt={residence.name} 
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                  <span className="text-white font-medium">Click to view gallery</span>
                                </div>
                                {allImages.length > 1 && (
                                  <Badge className="absolute top-4 right-4 bg-black/70">
                                    {allImages.length} Photos
                                  </Badge>
                                )}
                                {/* Quality Grade Badge */}
                                {residence.quality_grade && (
                                  <Badge 
                                    className={`absolute top-4 left-4 ${
                                      residence.quality_grade === 'luxury' ? 'bg-purple-500' :
                                      residence.quality_grade === 'premium' ? 'bg-amber-500' :
                                      residence.quality_grade === 'standard' ? 'bg-blue-500' : 'bg-muted'
                                    }`}
                                  >
                                    <Award className="w-3 h-3 mr-1" />
                                    {residence.quality_grade.charAt(0).toUpperCase() + residence.quality_grade.slice(1)}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Thumbnail Strip */}
                              {allImages.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                  {allImages.map((img, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => { setLightboxIndex(idx); setShowLightbox(true); }}
                                      className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                                    >
                                      <img 
                                        src={img} 
                                        alt={`${residence.name} ${idx + 1}`} 
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
                        {/* Virtual Tour Section */}
                        {residence.virtual_tour_url && (
                          <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold flex items-center gap-2">
                                <Video className="w-5 h-5 text-primary" />
                                3D Virtual Tour
                              </h3>
                              <Button
                                variant={showVirtualTour ? "secondary" : "default"}
                                onClick={() => setShowVirtualTour(!showVirtualTour)}
                              >
                                {showVirtualTour ? "Hide Tour" : "Take Virtual Tour"}
                              </Button>
                            </div>
                            {showVirtualTour && (
                              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                <iframe
                                  src={residence.virtual_tour_url}
                                  className="w-full h-full border-0"
                                  allowFullScreen
                                  title={`Virtual tour of ${residence.name}`}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <h3 className="text-xl font-bold mb-4">Description</h3>
                        <p className="text-muted-foreground mb-8">{residence.description}</p>
                        <h3 className="text-xl font-bold mb-4">Amenities</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {residence.amenities?.map((amenity: string) => (
                                <div key={amenity} className="flex items-center space-x-2">
                                    {amenityIcons[amenity] || <Bed className="w-4 h-4" />}
                                    <span>{amenity}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Card className="bg-card/50">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">Details</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Available Spots</span>
                                        <span className="font-bold">{residence.available_spots || 0} / {residence.capacity}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Distance</span>
                                        <span className="font-bold">{residence.distance_from_campus}km</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Room Types</span>
                                        <div className="flex gap-1 flex-wrap justify-end">
                                          {(residence.room_types && residence.room_types.length > 0 
                                            ? residence.room_types 
                                            : [residence.room_type]
                                          ).filter(Boolean).map((type: string) => (
                                            <Badge key={type} variant="secondary" className="capitalize text-xs">{type}</Badge>
                                          ))}
                                        </div>
                                    </div>
                                </div>
                                <Separator className="my-4" />
                                <div>
                                    <h4 className="font-semibold mb-2">Contact ResKonnect</h4>
                                    <p className="text-sm text-muted-foreground">Phone: 0637323192</p>
                                    <p className="text-sm text-muted-foreground">Email: reskonnect@gmail.com</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </CardContent>
          </Card>

        <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Related Residences</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedResidences.map((res) => (
                    <Link to={`/res/${res.id}`} key={res.id}>
                        <Card className="hover:shadow-lg transition-shadow">
                            <img 
                              src={res.image_url || "/placeholder.svg"} 
                              alt={res.name} 
                              className="w-full h-48 object-cover rounded-t-lg"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.src = "/placeholder.svg";
                              }}
                            />
                            <CardContent className="p-4">
                                <h3 className="text-lg font-bold">{res.name}</h3>
                                <p className="text-muted-foreground text-sm">{res.address}</p>
                                <div className="flex items-center justify-end mt-4">
                                    <Button size="sm" variant="outline">View</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Reviews ({reviews.length})</h2>
              {averageRating > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="font-semibold">{averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>
            {user && !showReviewForm && (
              <Button onClick={() => setShowReviewForm(true)}>Write a Review</Button>
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
            <Card className="bg-card/50">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Reviews Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Be the first to share your experience at this residence.
                </p>
                {user && !showReviewForm && (
                  <Button variant="outline" onClick={() => setShowReviewForm(true)}>
                    Write the First Review
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-12">
            <Card className="bg-card/50">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Your Home Away From Home</h3>
                    <p className="text-muted-foreground text-sm">
                    Located near leading campuses, this residence offers convenient student living with modern amenities, high-speed WiFi, laundry facilities, and a supportive community. We prioritize safety with 24/7 security and access control. Our goal is to provide a comfortable and conducive environment for your academic success.
                    </p>
                </CardContent>
            </Card>
        </div>

      </div>

      {/* Application Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {residence?.name}</DialogTitle>
            <DialogDescription>
              Submit your application for this residence. We'll review it and get back to you soon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information you'd like to share..."
                value={applicationNotes}
                onChange={(e) => setApplicationNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Application Details:</p>
              <p className="text-sm text-muted-foreground">Residence: {residence?.name}</p>
              <p className="text-sm text-muted-foreground">Monthly Rent: R{residence?.price?.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Room Type: {residence?.room_type}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitApplication} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GOD MODE Lightbox */}
      {showLightbox && (() => {
        const allImages = [residence.image_url, ...(residence.images || [])].filter(Boolean);
        return (
          <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
            <button 
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 text-white hover:text-white/80 z-10"
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
              alt={`${residence.name} ${lightboxIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            
            <button 
              onClick={() => setLightboxIndex((prev) => (prev + 1) % allImages.length)}
              className="absolute right-4 text-white hover:text-white/80 p-2"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
            
            <div className="absolute bottom-4 text-white text-sm">
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
