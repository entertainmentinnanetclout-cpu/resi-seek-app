import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Building2, ArrowUpDown, RefreshCw } from "lucide-react";
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
import { useResidenceFilters, isMockResidence } from "@/hooks/useResidenceFilters";
import { useResidenceSections } from "@/hooks/useResidenceSections";
import { supabase } from "@/integrations/supabase/client";
import {getResidenceIntake,canApplyToResidence,ACCOMMODATION_APPLICATION_YEAR} from "@/lib/residenceIntake";
import { SmartSearchBar } from "@/components/findmyres/SmartSearchBar";
import { FilterSidebar } from "@/components/findmyres/FilterSidebar";
import { FilterBottomSheet } from "@/components/findmyres/FilterBottomSheet";
import { ActiveFilterChips } from "@/components/findmyres/ActiveFilterChips";
import { ResidencePropertyCard } from "@/components/findmyres/ResidencePropertyCard";
import SponsoredResidenceRail from "@/components/findmyres/SponsoredResidenceRail";
import { CategoryRail } from "@/components/findmyres/CategoryRail";
import { AccreditationCTA } from "@/components/findmyres/AccreditationCTA";
import { AudienceSelector, type AudienceKey } from "@/components/findmyres/AudienceSelector";
import PremiumResidenceShowcase from "@/components/findmyres/PremiumResidenceShowcase";
import MonthlyTopThree from "@/components/findmyres/MonthlyTopThree";
import ResidenceDiscoveryCard from "@/components/findmyres/ResidenceDiscoveryCard";
import {usePublicLivingSignals} from "@/hooks/usePublicLivingSignals";
import NearbySuggestedResidences from "@/components/findmyres/NearbySuggestedResidences";
import CompareDrawer from "@/components/CompareDrawer";
import { ReferralBanner } from "@/components/referrals/ReferralBanner";
import { IntentNotice } from "@/components/findmyres/IntentNotice";
import { useUserIntent } from "@/contexts/UserIntentContext";
import { deriveFiltersFromIntent } from "@/lib/intent/intentFilters";
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
  const { residences, loading, error: residenceError, refresh: refreshResidences } = useRealtimeResidences();
  const { sections } = useResidenceSections("findmyres");
  const { intent } = useUserIntent();
  const livingSignals=usePublicLivingSignals();
  const [listingStyle,setListingStyle]=useState<"photo"|"list"|"details">("photo");
  const {
    filters,
    cityOptions,
    updateFilter,
    resetFilters,
    filteredResidences,
    closestResidences,
    relaxBudget,
    activeFilterCount,
    hasActiveFilters,
  } = useResidenceFilters(residences);

  const [compareList, setCompareList] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [privateTenantConfirmed,setPrivateTenantConfirmed]=useState(false);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [applicationNotes, setApplicationNotes] = useState("");
  const [institutionType, setInstitutionType] = useState<string>("university");
  const [appliedIntentStamp, setAppliedIntentStamp] = useState<string | null>(null);

  const intentResult = deriveFiltersFromIntent(intent);
  const intentApplied = appliedIntentStamp !== null;

  // Re-apply intent-derived filters whenever the guide answers change.
  // Every filter stays user-removable.
  useEffect(() => {
    const stamp = intent.updated_at ?? JSON.stringify(intentResult.patch);
    if (appliedIntentStamp === stamp) return;
    const entries = Object.entries(intentResult.patch);
    entries.forEach(([key, value]) => updateFilter(key as any, value as any));
    setAppliedIntentStamp(stamp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedIntentStamp, intent]);

  // Deep-link category support: /find?category=flats
  useEffect(() => {
    const searchTerm=searchParams.get("query");
    if(searchTerm&&searchTerm.length<=100&&searchTerm!==filters.searchQuery)updateFilter("searchQuery",searchTerm);
    const city = searchParams.get("city");
    if(city && city!==filters.city)updateFilter("city",city);
    const cat = searchParams.get("category");
    if (cat && cat !== filters.category) updateFilter("category", cat);
    const aud = searchParams.get("audience") as AudienceKey | null;
    if (aud && aud !== filters.audience) updateFilter("audience", aud);
    const inst = searchParams.get("institution");
    if (inst && inst !== filters.institutionTag) updateFilter("institutionTag", inst);
    // Search-engine landing pages can deep-link into real, removable filters.
    // Unknown values are ignored, and price bounds are clamped to the UI range.
    const lower = searchParams.get("minPrice");
    const upper = searchParams.get("maxPrice");
    if (lower !== null && /^\\d{1,5}$/.test(lower)) {
      const n = Math.min(10000, Math.max(0, Number(lower)));
      if (n !== filters.priceMin) updateFilter("priceMin", n);
    }
    if (upper !== null && /^\\d{1,5}$/.test(upper)) {
      const n = Math.min(10000, Math.max(0, Number(upper)));
      if (n !== filters.priceMax) updateFilter("priceMax", n);
    }
    if (searchParams.get("singlesOnly") === "true" && !filters.singlesOnly) updateFilter("singlesOnly", true);
    if (searchParams.get("nsfasOnly") === "true" && !filters.nsfasOnly) updateFilter("nsfasOnly", true);
    if (searchParams.get("privatePayingOnly") === "true" && !filters.privatePayingOnly) updateFilter("privatePayingOnly", true);
    if (searchParams.get("priceVerifiedOnly") === "true" && !filters.priceVerifiedOnly) updateFilter("priceVerifiedOnly", true);
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
      if (!visited && !searchParams.has("query") && !searchParams.has("discovery")) {
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

  const handleApply = async (residence: any) => {
    if(!canApplyToResidence(await getResidenceIntake(residence.id))){
      toast.info("Accommodation applications are closed. Explore 2027 reservations instead.");
      navigate("/res/"+residence.id+"#reservations");
      return;
    }
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
    if(!canApplyToResidence(await getResidenceIntake(selectedResidence.id))){setShowApplyModal(false);toast.info("Applications are closed; please reserve for 2027.");navigate("/res/"+selectedResidence.id+"#reservations");return;}
    if(!privateTenantConfirmed){toast.error("Please confirm your private-paying tenant application.");return;}
    try {
      const { error } = await supabase.from("applications").insert({
        user_id: user.id,
        residence_id: selectedResidence.id,
        academic_year:ACCOMMODATION_APPLICATION_YEAR,
        funding_type:"private",
        status: "submitted",
        notes: applicationNotes,
        institution_type: institutionType,
      } as any);
      if (error) throw error;
      toast.success(`Application submitted for ${selectedResidence.name}!`);
      setApplicationNotes("");setPrivateTenantConfirmed(false);
      setShowApplyModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    }
  };

  const visibleResidences = filteredResidences.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResidences.length;

  // Real listings only — seed/demo rows never appear beside real ones.
  const realResidences = residences.filter((r: any) => !isMockResidence(r));

  // Group residences by category for rails (only when no filters active)
  const byCategory = CATEGORY_SECTIONS.map((s) => ({
    ...s,
    items: realResidences.filter((r: any) => r.category === s.key).slice(0, 10),
    total: realResidences.filter((r: any) => r.category === s.key).length,
  }));
  // A separate, explicitly curated rail; never secretly select every property
  // by views/applications or duplicate the higher-priority Spotlight block.
  const featured = [...realResidences]
    .filter((r:any)=>r.is_visible!==false&&(r.is_featured===true||r.featured===true)&&r.is_spotlight!==true)
    .sort((a:any,b:any)=>Number(b.featured_rank||0)-Number(a.featured_rank||0)||String(a.name||"").localeCompare(String(b.name||"")))
    .slice(0,6);

  const showRails = !hasActiveFilters && !loading && realResidences.length > 0;

  return (
    <DashboardLayout>
      <SEO
        title="ResKonnect Find My Res | Student Accommodation & Room Search"
        description="Explore student accommodation by area, campus, room type and price. Listing evidence, funding acceptance and verification status are shown separately."
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
            cityOptions={cityOptions}
          filters={filters}
          updateFilter={updateFilter}
          resultCount={filteredResidences.length}
          totalCount={residences.length}
        />

        {/* Editorial premium placements are visible only until a student applies filters. */}
        {!hasActiveFilters&&<PremiumResidenceShowcase residences={realResidences} loading={loading} surface="find"/>}
        {!hasActiveFilters&&!loading&&<MonthlyTopThree residences={realResidences} signals={livingSignals} surface="find"/>}
        <NearbySuggestedResidences residences={residences}/>
        {!hasActiveFilters&&!loading&&<SponsoredResidenceRail residences={realResidences} onApply={handleApply}/>}
        <ReferralBanner />
        {residenceError && (
          <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:px-8">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Accommodation connection needs attention</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{residenceError}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" className="shrink-0" onClick={refreshResidences} disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Retry live data
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Intent-aware explanation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <IntentNotice
            note={intentApplied ? intentResult.note : null}
            privateRentalUnavailable={intentResult.privateRentalUnavailable}
            guideSkipped={Boolean(intent.skipped_guide) || !intent.persona}
            onClearIntentFilters={resetFilters}
            area={intent.area}
            budget={intent.budget_max}
          />
        </div>

        {/* Audience Selector — University / TVET / Private */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <AudienceSelector
            audience={filters.audience}
            onChange={(v) => updateFilter("audience", v)}
            institutionTag={filters.institutionTag}
            onInstitutionChange={(v) => updateFilter("institutionTag", v)}
          />
        </div>



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
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#173b70]/10 bg-gradient-to-r from-[#102d57]/[0.06] to-background p-4 sm:p-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Find My Res · Explore</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Discover student living the ResKonnect way</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Your filters shape these results. Residence-reported availability is not a booking guarantee.</p>
                </div>
                <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-bold">{filteredResidences.length} matching residences</span>
              </div>
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
                      <SelectItem value="recent">Recently Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Residence card display style">
                {([["photo","Photo cards"],["list","Compact list"],["details","Detailed cards"]] as const).map(([key,label])=>(
                  <Button key={key} size="sm" type="button" variant={listingStyle===key?"default":"outline"}
                   className="rounded-full" onClick={()=>setListingStyle(key)} aria-pressed={listingStyle===key}>{label}</Button>
                ))}
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
                <div className="space-y-6">
                  <Card>
                    <CardContent className="text-center py-12">
                      <Building2 className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No exact matches found</h3>
                      <p className="text-muted-foreground mb-4">
                        Nothing matches every filter you selected. Relax your budget or let
                        ResKonnect help you source a place.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {filters.priceMax < 10000 && (
                          <Button variant="outline" onClick={relaxBudget}>
                            Relax budget filter
                          </Button>
                        )}
                        <Button variant="outline" onClick={resetFilters}>
                          Clear all filters
                        </Button>
                        <Button asChild>
                          <a
                            href="https://wa.me/27637323192"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Request help finding a match
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {closestResidences.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-lg font-semibold">Closest matches</h4>
                        <p className="text-sm text-muted-foreground">
                          These are outside your selected budget but match your other criteria.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {closestResidences.map((r: any) => (
                          <ResidencePropertyCard key={r.id} residence={r} onApply={handleApply} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={listingStyle==="list"?"grid grid-cols-1 gap-3":"grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"}>
                    {visibleResidences.map((residence) => (
                      listingStyle==="details"?<ResidencePropertyCard key={residence.id} residence={residence} onApply={handleApply}
                        rating={livingSignals.ratings[residence.id]} accredited={livingSignals.accreditedIds.has(residence.id)}
                        nsfasAccredited={livingSignals.nsfasAccreditedIds.has(residence.id)}
                        matchScore={hasActiveFilters ? residence._matchScore : undefined}/>:
                      <ResidenceDiscoveryCard key={residence.id} residence={residence} layout={listingStyle==="list"?"horizontal":"compact"}
                        rating={livingSignals.ratings[residence.id]}
                        accredited={livingSignals.accreditedIds.has(residence.id)}
                        nsfasAccredited={livingSignals.nsfasAccreditedIds.has(residence.id)}/>
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


        {/* Broader editorial discovery comes AFTER primary search results. */}
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
                    <ResidenceDiscoveryCard residence={r} rating={livingSignals.ratings[r.id]}
                      accredited={livingSignals.accreditedIds.has(r.id)}
                      nsfasAccredited={livingSignals.nsfasAccreditedIds.has(r.id)}/>
                  </div>
                ))}
              </CategoryRail>
            ))}
            {featured.length > 0 && (
              <CategoryRail title="More selected residences" subtitle="Other curated listings. Listing visibility does not establish accreditation or availability" count={featured.length}>
                {featured.map((r: any) => (
                  <div key={r.id} className="min-w-[280px] sm:min-w-[320px] snap-start">
                    <ResidenceDiscoveryCard residence={r} rating={livingSignals.ratings[r.id]}
                      accredited={livingSignals.accreditedIds.has(r.id)}
                      nsfasAccredited={livingSignals.nsfasAccreditedIds.has(r.id)}/>
                  </div>
                ))}
              </CategoryRail>
            )}
            <AccreditationCTA />
          </div>
        )}


                {/* SEO Text */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Find Your Ideal Student Home</h3>
              <p className="text-muted-foreground text-sm">
                Search published accommodation across Pretoria, Soshanguve, Ga-Rankuwa and more. Listings display residence-provided images, amenities, reported inventory and relevant verification evidence when available. Confirm current availability and pricing with each residence before applying. Contact us at 0637323192 or reskonnect@gmail.com for assistance.
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
              <Label htmlFor="fmr-institution">I am a student at <span className="text-destructive">*</span></Label>
              <Select value={institutionType} onValueChange={setInstitutionType}>
                <SelectTrigger id="fmr-institution"><SelectValue placeholder="Select institution type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="university">University (TUT / UP / UNISA)</SelectItem>
                  <SelectItem value="tvet">TVET College</SelectItem>
                  <SelectItem value="private">Private College</SelectItem>
                  <SelectItem value="other">Other / Working Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><Checkbox checked={privateTenantConfirmed} onCheckedChange={value=>setPrivateTenantConfirmed(value===true)}/><span>I confirm that I am applying as a <strong>private-paying tenant</strong>, not for an NSFAS-funded accommodation placement.</span></label>
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
            <Button onClick={handleSubmitApplication} disabled={!privateTenantConfirmed}>Submit Private Application</Button>
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
