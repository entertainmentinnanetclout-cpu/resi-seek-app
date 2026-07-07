import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, ArrowUpDown } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { useResidenceFilters } from "@/hooks/useResidenceFilters";
import { useResidenceSections } from "@/hooks/useResidenceSections";
import { supabase } from "@/integrations/supabase/client";
import { SmartSearchBar } from "@/components/findmyres/SmartSearchBar";
import { FilterSidebar } from "@/components/findmyres/FilterSidebar";
import { FilterBottomSheet } from "@/components/findmyres/FilterBottomSheet";
import { ActiveFilterChips } from "@/components/findmyres/ActiveFilterChips";
import { ResidencePropertyCard } from "@/components/findmyres/ResidencePropertyCard";
import { CategoryRail } from "@/components/findmyres/CategoryRail";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector, type AudienceKey } from "@/components/findmyres/AudienceSelector";
import { ResidenceSpotlightSlider } from "@/components/findmyres/ResidenceSpotlightSlider";
import CompareDrawer from "@/components/CompareDrawer";
import { ReferralBanner } from "@/components/referrals/ReferralBanner";
import { getReferralPublic, captureReferralClick } from "@/lib/referrals/referralApi";
import { saveReferral, getVisitorId } from "@/lib/referrals/referralStorage";

const MAX_COMPARE = 3;
const PAGE_SIZE = 20;

const CATEGORY_SECTIONS = [
  { key: "flats", title: "Flats", subtitle: "Bachelor, studio, 1 & 2 bedroom apartments" },
  { key: "communes", title: "Communes", subtitle: "Male, female and mixed shared houses" },
  { key: "student_residences", title: "Student Residences", subtitle: "NSFAS & TUT accredited buildings" },
  { key: "private_rentals", title: "Private Rentals", subtitle: "Family rentals and professional homes" },
] as const;

const FindMyRes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { residences, loading } = useRealtimeResidences();
  const { sections } = useResidenceSections("findmyres");
  const {
    filters,
    updateFilter,
    resetFilters,
    filteredResidences,
    activeFilterCount,
    hasActiveFilters,
  } = useResidenceFilters(residences);

  const [compareList, setCompareList] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [applicationNotes, setApplicationNotes] = useState("");

  // Deep-link category support: /find?category=flats
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && cat !== filters.category) updateFilter("category", cat);
    const aud = searchParams.get("audience") as AudienceKey | null;
    if (aud && aud !== filters.audience) updateFilter("audience", aud);
    const inst = searchParams.get("institution");
    if (inst && inst !== filters.institutionTag) updateFilter("institutionTag", inst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Capture ?ref=CODE if present (safe if user landed via /r/:code already)
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    (async () => {
      const info = await getReferralPublic(ref);
      if (!info) return;
      const sid = await captureReferralClick(info.code, getVisitorId(), window.location.pathname + window.location.search);
      saveReferral(info.code, sid, info.agent_name, window.location.pathname);
    })();
  }, [searchParams]);

  // First-visit CTA modal
  useEffect(() => {
    if (!user) {
      const visited = localStorage.getItem("reskonnect_visited");
      if (!visited) {
        const timer = setTimeout(() => setShowFirstVisitModal(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Floating bar on scroll
  useEffect(() => {
    const handleScroll = () => setShowFloatingBar(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const { isStudent } = useAuth();

  const handleApply = (residence: any) => {
    if (!user) {
      toast.error("Please sign in to apply");
      navigate("/auth?returnTo=/find");
      return;
    }
    if (!isStudent) {
      toast.info("Please complete your student profile to apply for accommodation.");
      navigate("/setup-profile");
      return;
    }
    if ((residence.available_spots || 0) === 0) {
      toast.error("This residence is fully booked");
      return;
    }
    setSelectedResidence(residence);
    setShowApplyModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!selectedResidence || !user) return;
    try {
      const { error } = await supabase.from("applications").insert({
        user_id: user.id,
        residence_id: selectedResidence.id,
        status: "submitted",
        notes: applicationNotes,
      });
      if (error) throw error;
      toast.success(`Application submitted for ${selectedResidence.name}!`);
      setApplicationNotes("");
      setShowApplyModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    }
  };

  const visibleResidences = filteredResidences.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResidences.length;

  // Group residences by category for rails (only when no filters active)
  const byCategory = CATEGORY_SECTIONS.map((s) => ({
    ...s,
    items: residences.filter((r: any) => r.category === s.key).slice(0, 10),
    total: residences.filter((r: any) => r.category === s.key).length,
  }));
  const featured = [...residences]
    .filter((r: any) => (r.available_spots ?? 0) > 0)
    .sort((a: any, b: any) => {
      const aScore = (a.is_featured ? 1000 : 0) + (a.featured_rank || 0) + (a.application_count || 0) + (a.view_count || 0) / 10;
      const bScore = (b.is_featured ? 1000 : 0) + (b.featured_rank || 0) + (b.application_count || 0) + (b.view_count || 0) / 10;
      return bScore - aScore;
    })
    .slice(0, 10);

  const showRails = !hasActiveFilters && !loading && residences.length > 0;

  return (
    <DashboardLayout>
      <SEO
        title="Find Student Accommodation | University, TVET & Private | ResKonnect"
        description="Browse and apply to verified accommodation for university students, TVET college students and private applicants. NSFAS options available."
        keywords="TVET accommodation, university student accommodation, private student rentals, NSFAS residence, Pretoria accommodation"
      />
      <div className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>Find My Res</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Smart Search Hero */}
        <SmartSearchBar
          filters={filters}
          updateFilter={updateFilter}
          resultCount={filteredResidences.length}
          totalCount={residences.length}
        />

        {/* Marketing Spotlight Slider */}
        <ResidenceSpotlightSlider residences={residences} loading={loading} />
        <ReferralBanner />

        {/* Audience Selector — University / TVET / Private */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <AudienceSelector
            audience={filters.audience}
            onChange={(v) => updateFilter("audience", v)}
            institutionTag={filters.institutionTag}
            onInstitutionChange={(v) => updateFilter("institutionTag", v)}
          />
        </div>

        {/* Category Rails (Property24-style discovery) */}
        {showRails && (
          <div className="max-w-7xl mx-auto py-8 space-y-10">
            {byCategory.filter((s) => s.items.length > 0).map((s) => (
              <CategoryRail
                key={s.key}
                title={s.title}
                subtitle={s.subtitle}
                viewAllHref={`/find?category=${s.key}`}
                viewAllLabel={`View All ${s.title}`}
                count={s.total}
              >
                {s.items.map((r: any) => (
                  <div key={r.id} className="min-w-[280px] sm:min-w-[320px] snap-start">
                    <ResidencePropertyCard residence={r} onApply={handleApply} />
                  </div>
                ))}
              </CategoryRail>
            ))}
            {featured.length > 0 && (
              <CategoryRail title="Featured Accommodation" subtitle="Smart-ranked by demand, reviews and availability" count={featured.length}>
                {featured.map((r: any) => (
                  <div key={r.id} className="min-w-[280px] sm:min-w-[320px] snap-start">
                    <ResidencePropertyCard residence={r} onApply={handleApply} />
                  </div>
                ))}
              </CategoryRail>
            )}
            <AccreditationCTA />
          </div>
        )}

        {/* Main Content: Sidebar + Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="results">
          <div className="flex gap-6">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <FilterSidebar
                filters={filters}
                updateFilter={updateFilter}
                resetFilters={resetFilters}
                activeFilterCount={activeFilterCount}
                sections={sections}
              />
            </div>

            {/* Results Area */}
            <div className="flex-1 min-w-0">
              {/* Top bar: chips + sort */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <ActiveFilterChips
                  filters={filters}
                  updateFilter={updateFilter}
                  resetFilters={resetFilters}
                  hasActiveFilters={hasActiveFilters}
                />

                <div className="flex items-center gap-2 shrink-0">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <Select value={filters.sortBy} onValueChange={(v) => updateFilter("sortBy", v)}>
                    <SelectTrigger className="w-44 h-9 text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match">Best Match</SelectItem>
                      <SelectItem value="price-asc">Price: Low to High</SelectItem>
                      <SelectItem value="price-desc">Price: High to Low</SelectItem>
                      <SelectItem value="distance">Nearest First</SelectItem>
                      <SelectItem value="availability">Most Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results Grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-[16/10] w-full" />
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredResidences.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-16">
                    <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No residences found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your filters or search query.
                    </p>
                    <Button onClick={resetFilters}>Clear All Filters</Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visibleResidences.map((residence) => (
                      <ResidencePropertyCard
                        key={residence.id}
                        residence={residence}
                        onApply={handleApply}
                        matchScore={hasActiveFilters ? residence._matchScore : undefined}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="text-center mt-8">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      >
                        Load More ({filteredResidences.length - visibleCount} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* SEO Text */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Find Your Ideal Student Home</h3>
              <p className="text-muted-foreground text-sm">
                Search verified student residences across Pretoria, Soshanguve, Ga-Rankuwa, and more. Each listing includes amenities, images, and real-time availability. ResKonnect is committed to providing a seamless and secure platform for students to find and apply for accommodation. Contact us at 0637323192 or reskonnect@gmail.com for assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      <FilterBottomSheet
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        sections={sections}
        resultCount={filteredResidences.length}
      />

      {/* Application Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="max-w-lg w-[90%]">
          <DialogHeader>
            <DialogTitle>Apply to {selectedResidence?.name}</DialogTitle>
            <DialogDescription>
              Submit your application. We'll review it and contact you via WhatsApp or email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g. I am a first-year student looking for a quiet place..."
                value={applicationNotes}
                onChange={(e) => setApplicationNotes(e.target.value)}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
              <p className="font-medium">Application Details:</p>
              <p className="text-muted-foreground">Residence: {selectedResidence?.name}</p>
              <p className="text-muted-foreground">
                Monthly Rent: R{Number(selectedResidence?.price || 0).toLocaleString()}
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox id="terms-apply" required />
              <Label htmlFor="terms-apply" className="text-sm text-muted-foreground leading-relaxed -mt-1">
                By submitting, I confirm that my profile is up-to-date and I agree to be contacted by ResKonnect.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmitApplication}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* First-Visit CTA Modal */}
      <Dialog
        open={showFirstVisitModal}
        onOpenChange={(open) => {
          setShowFirstVisitModal(open);
          if (!open) localStorage.setItem("reskonnect_visited", "true");
        }}
      >
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl">Start Your Journey 🎓</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Find verified accommodation for university, TVET college and private applicants. Create a free account to apply, save favourites, and get notified about new listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => {
                setShowFirstVisitModal(false);
                localStorage.setItem("reskonnect_visited", "true");
                navigate("/auth");
              }}
            >
              Create Free Account
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowFirstVisitModal(false);
                localStorage.setItem("reskonnect_visited", "true");
              }}
            >
              Browse First
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Bar (Mobile) */}
      {showFloatingBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-lg border-t shadow-lg sm:hidden">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button
              className="flex-1"
              onClick={() => {
                if (!user) {
                  navigate("/auth?returnTo=/find");
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              Find My Res
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                window.open(
                  `https://wa.me/27637323192?text=${encodeURIComponent("Hi ResKonnect, I need help finding accommodation!")}`,
                  "_blank"
                )
              }
            >
              WhatsApp Us
            </Button>
          </div>
        </div>
      )}

      <CompareDrawer
        compareList={compareList}
        onRemove={(id) => setCompareList((prev) => prev.filter((r) => r.id !== id))}
        onClear={() => setCompareList([])}
      />
    </DashboardLayout>
  );
};

export default FindMyRes;
