import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Preloader from "@/components/Preloader";
import ResBot from "@/components/ResBot";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import MarketplaceComingSoon from "./pages/MarketplaceComingSoon";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StudentRoute } from "@/components/StudentRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { ResidenceRoute } from "./components/ResidenceRoute";
import { SpecialistRoute } from "@/components/SpecialistRoute";
import PushPrompt from "@/components/PushPrompt";

// Lazy load heavy components
const GetStarted = lazy(() => import("./pages/GetStarted"));
const Living = lazy(() => import("./pages/public/Living"));
const StudentAccommodation = lazy(() => import("./pages/public/StudentAccommodation"));
const PrivateRentals = lazy(() => import("./pages/public/PrivateRentals"));
const Parents = lazy(() => import("./pages/public/Parents"));
const ApplicationsPillar = lazy(() => import("./pages/public/Applications"));
const TvetApplication = lazy(() => import("./pages/public/TvetApplication"));
const UniversityApplication = lazy(() => import("./pages/public/UniversityApplication"));
const PrivateCollegeApplication = lazy(() => import("./pages/public/PrivateCollegeApplication"));
const ApplicationsChecker = lazy(() => import("./pages/public/ApplicationsChecker"));
const OpportunitiesPillar = lazy(() => import("./pages/public/Opportunities"));
const OpportunitiesWil = lazy(() => import("./pages/public/OpportunitiesWil"));
const PartnersPillar = lazy(() => import("./pages/public/Partners"));
const PartnersLandlords = lazy(() => import("./pages/public/PartnersLandlords"));
const PartnersInstitutions = lazy(() => import("./pages/public/PartnersInstitutions"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Updates = lazy(() => import("./pages/Updates"));
const CampusNews = lazy(() => import("./pages/CampusNews"));
const FindMyRes = lazy(() => import("./pages/FindMyRes"));
const Applications = lazy(() => import("./pages/Applications"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Admin = lazy(() => import("./pages/Admin"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ApplicationsHub = lazy(() => import("./pages/ApplicationsHub"));
const ResidenceDetail = lazy(() => import("./pages/ResidenceDetail"));
const BursaryFinder = lazy(() => import("./pages/BursaryFinder"));
const StudentDeals = lazy(() => import("./pages/StudentDeals"));
const RoommateFinder = lazy(() => import("./pages/RoommateFinder"));
const Events = lazy(() => import("./pages/Events"));
const Documents = lazy(() => import("./pages/Documents"));
const StoreSetup = lazy(() => import("./pages/StoreSetup"));
const MyStore = lazy(() => import("./pages/MyStore"));
const StoreEdit = lazy(() => import("./pages/StoreEdit"));
const Store = lazy(() => import("./pages/Store"));
const Orders = lazy(() => import("./pages/Orders"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ProvinceLanding = lazy(() => import("./pages/seo/ProvinceLanding"));
const CampusLanding = lazy(() => import("./pages/seo/CampusLanding"));
const NationalLanding = lazy(() => import("./pages/seo/NationalLanding"));
const NsfAsLanding = lazy(() => import("./pages/seo/NsfAsLanding"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminResidences = lazy(() => import("./pages/admin/AdminResidences"));
const AdminApplications = lazy(() => import("./pages/admin/AdminApplications"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSlides = lazy(() => import("./pages/admin/AdminSlides"));
const AdminBursaries = lazy(() => import("./pages/admin/AdminBursaries"));
const AdminDiscounts = lazy(() => import("./pages/admin/AdminDiscounts"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const AdminNews = lazy(() => import("./pages/admin/AdminNews"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminSystemStatus = lazy(() => import("./pages/admin/AdminSystemStatus"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminDocuments = lazy(() => import("./pages/admin/AdminDocuments"));
const AdminStores = lazy(() => import("./pages/admin/AdminStores"));
const AdminFollowUp = lazy(() => import("./pages/admin/AdminFollowUp"));
const AdminWhatsAppTemplates = lazy(() => import("./pages/admin/AdminWhatsAppTemplates"));
const AdminDiscountOrders = lazy(() => import("./pages/admin/AdminDiscountOrders"));
const AdminHamperItems = lazy(() => import("./pages/admin/AdminHamperItems"));
const AdminResidencePortals = lazy(() => import("./pages/admin/AdminResidencePortals"));
const BursaryDetail = lazy(() => import("./pages/BursaryDetail"));
const MyDiscountOrders = lazy(() => import("./pages/MyDiscountOrders"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ResidenceLogin = lazy(() => import("./pages/residence/ResidenceLogin"));
const ResidenceLayout = lazy(() => import("./pages/residence/ResidenceLayout"));
const ResidenceDashboard = lazy(() => import("./pages/residence/ResidenceDashboard"));
const ResidenceInbox = lazy(() => import("./pages/residence/ResidenceInbox"));
const ResidenceApplicationDetail = lazy(() => import("./pages/residence/ResidenceApplicationDetail"));
const ResidenceAnalytics = lazy(() => import("./pages/residence/ResidenceAnalytics"));
const SellerOnboarding = lazy(() => import("./pages/SellerOnboarding"));
const Referrals = lazy(() => import("./pages/Referrals"));
const MyDiscountCodes = lazy(() => import("./pages/MyDiscountCodes"));
const AdminSellerApprovals = lazy(() => import("./pages/admin/AdminSellerApprovals"));
const MyWIL = lazy(() => import("./pages/MyWIL"));
const AdminWIL = lazy(() => import("./pages/admin/AdminWIL"));
const AdminOnboardingHub = lazy(() => import("./pages/admin/AdminOnboardingHub"));
const AdminOperationsHub = lazy(() => import("./pages/admin/AdminOperationsHub"));
const AdminCommerceHub = lazy(() => import("./pages/admin/AdminCommerceHub"));
const AdminMediaHub = lazy(() => import("./pages/admin/AdminMediaHub"));
const AdminSystemHub = lazy(() => import("./pages/admin/AdminSystemHub"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const OrderPayment = lazy(() => import("./pages/OrderPayment"));
const MediaDashboard = lazy(() => import("./pages/MediaDashboard"));
const CommerceDashboard = lazy(() => import("./pages/CommerceDashboard"));
const ReferralRedirect = lazy(() => import("./pages/ReferralRedirect"));
const RecruiterDashboard = lazy(() => import("./pages/RecruiterDashboard"));
const AdminRecruitmentProgramme = lazy(() => import("./pages/admin/AdminRecruitmentProgramme"));
const AdminTvetHub = lazy(() => import("./pages/admin/AdminTvetHub"));
const TvetDashboard = lazy(() => import("./pages/tvet/TvetDashboard"));
const RecruitLanding = lazy(() => import("./pages/recruit/RecruitLanding"));
const RecruiterAuth = lazy(() => import("./pages/recruit/RecruiterAuth"));
const RecruiterApply = lazy(() => import("./pages/recruit/RecruiterApply"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Preloader />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<Preloader />}>
              <Routes>
              {/* Public Browse Routes (shareable, no auth required) */}
              <Route path="/" element={<Landing />} />
              <Route path="/get-started" element={<GetStarted />} />

              {/* Public Pillar Routes */}
              <Route path="/living" element={<Living />} />
              <Route path="/living/student-accommodation" element={<StudentAccommodation />} />
              <Route path="/living/private-rentals" element={<PrivateRentals />} />
              <Route path="/living/parents" element={<Parents />} />

              <Route path="/applications" element={<ApplicationsPillar />} />
              <Route path="/applications/tvet" element={<TvetApplication />} />
              <Route path="/applications/university" element={<UniversityApplication />} />
              <Route path="/applications/private-college" element={<PrivateCollegeApplication />} />
              <Route path="/applications/checker" element={<ApplicationsChecker />} />

              <Route path="/opportunities" element={<OpportunitiesPillar />} />
              <Route path="/opportunities/wil" element={<OpportunitiesWil />} />

              <Route path="/partners" element={<PartnersPillar />} />
              <Route path="/partners/landlords" element={<PartnersLandlords />} />
              <Route path="/partners/institutions" element={<PartnersInstitutions />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/find" element={<FindMyRes />} />
              <Route path="/findmyres" element={<FindMyRes />} />
              <Route path="/res/:id" element={<ResidenceDetail />} />
              <Route path="/find-my-res/:slug" element={<ResidenceDetail />} />
              <Route path="/bursaries" element={<BursaryFinder />} />
              <Route path="/bursary/:id" element={<BursaryDetail />} />
              {/* Marketplace paused publicly — all shop routes render Coming Soon */}
              <Route path="/marketplace" element={<MarketplaceComingSoon />} />
              <Route path="/marketplace/*" element={<MarketplaceComingSoon />} />
              <Route path="/product/:id" element={<MarketplaceComingSoon />} />
              <Route path="/store/:storeId" element={<MarketplaceComingSoon />} />
              <Route path="/apply" element={<ApplicationsHub />} />
              <Route path="/discounts" element={<StudentDeals />} />
              <Route path="/hamper" element={<StudentDeals />} />
              <Route path="/events" element={<Events />} />
              <Route path="/campus-news" element={<CampusNews />} />
              <Route path="/roommates" element={<RoommateFinder />} />
              <Route path="/affiliates" element={<Affiliates />} />
              {/* Referral link entrypoint (public) */}
              <Route path="/r/:code" element={<ReferralRedirect />} />
              {/* Student Recruitment Programme */}
              <Route path="/recruit" element={<RecruitLanding />} />
              <Route path="/recruit/auth" element={<RecruiterAuth />} />
              <Route path="/recruit/apply" element={<ProtectedRoute><RecruiterApply /></ProtectedRoute>} />
              <Route path="/recruit/dashboard" element={<ProtectedRoute><RecruiterDashboard /></ProtectedRoute>} />

              {/* Legacy/Other Referrals */}
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/recruiter-dashboard" element={<ProtectedRoute><RecruiterDashboard /></ProtectedRoute>} />

              {/* Protected Student Routes (require auth) */}
              <Route path="/dashboard" element={<StudentRoute><Dashboard /></StudentRoute>} />
              <Route path="/profile" element={<StudentRoute><Profile /></StudentRoute>} />
              <Route path="/applications" element={<StudentRoute><Applications /></StudentRoute>} />
              <Route path="/messages" element={<StudentRoute><Messages /></StudentRoute>} />
              <Route path="/favorites" element={<StudentRoute><Favorites /></StudentRoute>} />
              <Route path="/documents" element={<StudentRoute><Documents /></StudentRoute>} />
              <Route path="/store-setup" element={<MarketplaceComingSoon />} />
              <Route path="/my-store" element={<MarketplaceComingSoon />} />
              <Route path="/my-store/edit" element={<MarketplaceComingSoon />} />
              <Route path="/orders" element={<MarketplaceComingSoon />} />
              <Route path="/orders/:id/pay" element={<MarketplaceComingSoon />} />
              <Route path="/cart" element={<MarketplaceComingSoon />} />
              <Route path="/checkout" element={<MarketplaceComingSoon />} />
              <Route path="/my-discount-orders" element={<StudentRoute><MyDiscountOrders /></StudentRoute>} />
              <Route path="/wil" element={<StudentRoute><MyWIL /></StudentRoute>} />
              <Route path="/setup-profile" element={<StudentRoute><ProfileSetup /></StudentRoute>} />
              <Route path="/dashboard/updates" element={<StudentRoute><Updates /></StudentRoute>} />
              <Route path="/seller-onboarding" element={<MarketplaceComingSoon />} />
              <Route path="/my-discount-codes" element={<StudentRoute><MyDiscountCodes /></StudentRoute>} />
              
              {/* Admin Hub Routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><AdminRoute><AdminAnalytics /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/operations" element={<ProtectedRoute><AdminRoute><AdminOperationsHub /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/onboarding" element={<ProtectedRoute><AdminRoute><AdminOnboardingHub /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/commerce" element={<ProtectedRoute><AdminRoute><AdminCommerceHub /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/media" element={<ProtectedRoute><AdminRoute><AdminMediaHub /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/system" element={<ProtectedRoute><AdminRoute><AdminSystemHub /></AdminRoute></ProtectedRoute>} />

              {/* Specialist Standalone Dashboards */}
              <Route path="/media" element={<ProtectedRoute><SpecialistRoute allowedRoles={["admin", "growth_lead"]}><MediaDashboard /></SpecialistRoute></ProtectedRoute>} />
              <Route path="/commerce" element={<ProtectedRoute><SpecialistRoute allowedRoles={["admin", "commerce_lead"]}><CommerceDashboard /></SpecialistRoute></ProtectedRoute>} />

              {/* Legacy Admin Routes (kept for backward compatibility) */}
              <Route path="/admin/residences" element={<ProtectedRoute><AdminRoute><AdminResidences /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/applications" element={<ProtectedRoute><AdminRoute><AdminApplications /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/documents" element={<ProtectedRoute><AdminRoute><AdminDocuments /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/follow-up" element={<ProtectedRoute><AdminRoute><AdminFollowUp /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><AdminUsers /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/slides" element={<ProtectedRoute><AdminRoute><AdminSlides /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/bursaries" element={<ProtectedRoute><AdminRoute><AdminBursaries /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/discounts" element={<ProtectedRoute><AdminRoute><AdminDiscounts /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/discount-orders" element={<ProtectedRoute><AdminRoute><AdminDiscountOrders /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/events" element={<ProtectedRoute><AdminRoute><AdminEvents /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/marketplace" element={<ProtectedRoute><AdminRoute><AdminMarketplace /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/stores" element={<ProtectedRoute><AdminRoute><AdminStores /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/hamper-items" element={<ProtectedRoute><AdminRoute><AdminHamperItems /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/whatsapp-templates" element={<ProtectedRoute><AdminRoute><AdminWhatsAppTemplates /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/news" element={<ProtectedRoute><AdminRoute><AdminNews /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/system-status" element={<ProtectedRoute><AdminRoute><AdminSystemStatus /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute><AdminRoute><AdminSettings /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/residence-portals" element={<ProtectedRoute><AdminRoute><AdminResidencePortals /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/wil" element={<ProtectedRoute><AdminRoute><AdminWIL /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/seller-approvals" element={<ProtectedRoute><AdminRoute><AdminSellerApprovals /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/recruitment" element={<ProtectedRoute><AdminRoute><AdminRecruitmentProgramme /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/tvet" element={<ProtectedRoute><AdminRoute><AdminTvetHub /></AdminRoute></ProtectedRoute>} />

              {/* TVET Lead Routes */}
              <Route path="/tvet-dashboard" element={<ProtectedRoute><SpecialistRoute allowedRoles={["tvet_lead", "admin", "super_admin", "developer", "owner"]}><TvetDashboard /></SpecialistRoute></ProtectedRoute>} />

              {/* Residence Portal Routes */}
              <Route path="/residence/login" element={<ResidenceLogin />} />
              <Route path="/residence" element={<ResidenceRoute><ResidenceLayout /></ResidenceRoute>}>
                <Route index element={<ResidenceDashboard />} />
                <Route path="inbox" element={<ResidenceInbox />} />
                <Route path="application/:id" element={<ResidenceApplicationDetail />} />
                <Route path="analytics" element={<ResidenceAnalytics />} />
              </Route>

              {/* SEO Routes */}
              <Route path="/student-accommodation-:province" element={<ProvinceLanding />} />
              <Route path="/tut-:campus-accommodation" element={<CampusLanding />} />
              <Route path="/nsfas-accredited-accommodation" element={<NsfAsLanding />} />
              <Route path="/south-africa-student-accommodation" element={<NationalLanding />} />

              {/* Catch-all Not Found Route */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              {/* Global ResBot Chatbot */}
              <ResBot />
              <PushPrompt />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
