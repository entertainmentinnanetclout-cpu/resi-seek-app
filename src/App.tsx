import { useState, useEffect } from "react";
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
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Updates from "./pages/Updates";
import CampusNews from "./pages/CampusNews";
import FindMyRes from "./pages/FindMyRes";
import Applications from "./pages/Applications";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Marketplace from "./pages/Marketplace";
import ResidenceDetail from "./pages/ResidenceDetail";
import BursaryFinder from "./pages/BursaryFinder";
import StudentDiscounts from "./pages/StudentDiscounts";
import RoommateFinder from "./pages/RoommateFinder";
import Events from "./pages/Events";
import Documents from "./pages/Documents";
import StoreSetup from "./pages/StoreSetup";
import MyStore from "./pages/MyStore";
import Store from "./pages/Store";
import Orders from "./pages/Orders";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StudentRoute } from "@/components/StudentRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import ProvinceLanding from "./pages/seo/ProvinceLanding";
import CampusLanding from "./pages/seo/CampusLanding";
import NationalLanding from "./pages/seo/NationalLanding";
import NsfAsLanding from "./pages/seo/NsfAsLanding";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminResidences from "./pages/admin/AdminResidences";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSlides from "./pages/admin/AdminSlides";
import AdminBursaries from "./pages/admin/AdminBursaries";
import AdminDiscounts from "./pages/admin/AdminDiscounts";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminNews from "./pages/admin/AdminNews";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSystemStatus from "./pages/admin/AdminSystemStatus";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminStores from "./pages/admin/AdminStores";
import AdminFollowUp from "./pages/admin/AdminFollowUp";
import AdminWhatsAppTemplates from "./pages/admin/AdminWhatsAppTemplates";
import AdminDiscountOrders from "./pages/admin/AdminDiscountOrders";
import AdminHamperItems from "./pages/admin/AdminHamperItems";
import BursaryDetail from "./pages/BursaryDetail";
import StudentHamper from "./pages/StudentHamper";
import MyDiscountOrders from "./pages/MyDiscountOrders";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
const queryClient = new QueryClient();

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
              <Routes>
              {/* Core App Routes - Student Only */}
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<StudentRoute><Dashboard /></StudentRoute>} />
              <Route path="/profile" element={<StudentRoute><Profile /></StudentRoute>} />
              <Route path="/applications" element={<StudentRoute><Applications /></StudentRoute>} />
              <Route path="/find" element={<StudentRoute><FindMyRes /></StudentRoute>} />
              <Route path="/findmyres" element={<StudentRoute><FindMyRes /></StudentRoute>} />
              <Route path="/messages" element={<StudentRoute><Messages /></StudentRoute>} />
              <Route path="/favorites" element={<StudentRoute><Favorites /></StudentRoute>} />
              <Route path="/marketplace" element={<StudentRoute><Marketplace /></StudentRoute>} />
              <Route path="/bursaries" element={<StudentRoute><BursaryFinder /></StudentRoute>} />
              <Route path="/bursary/:id" element={<StudentRoute><BursaryDetail /></StudentRoute>} />
              <Route path="/discounts" element={<StudentRoute><StudentDiscounts /></StudentRoute>} />
              <Route path="/roommates" element={<StudentRoute><RoommateFinder /></StudentRoute>} />
              <Route path="/events" element={<StudentRoute><Events /></StudentRoute>} />
              <Route path="/documents" element={<StudentRoute><Documents /></StudentRoute>} />
              <Route path="/store-setup" element={<StudentRoute><StoreSetup /></StudentRoute>} />
              <Route path="/my-store" element={<StudentRoute><MyStore /></StudentRoute>} />
              <Route path="/store/:storeId" element={<StudentRoute><Store /></StudentRoute>} />
              <Route path="/orders" element={<StudentRoute><Orders /></StudentRoute>} />
              <Route path="/hamper" element={<StudentRoute><StudentHamper /></StudentRoute>} />
              <Route path="/my-discount-orders" element={<StudentRoute><MyDiscountOrders /></StudentRoute>} />
              {/* Other Essential Routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/setup-profile" element={<StudentRoute><ProfileSetup /></StudentRoute>} />
              <Route path="/dashboard/updates" element={<StudentRoute><Updates /></StudentRoute>} />
              <Route path="/campus-news" element={<StudentRoute><CampusNews /></StudentRoute>} />
              <Route path="/res/:id" element={<StudentRoute><ResidenceDetail /></StudentRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><AdminRoute><AdminAnalytics /></AdminRoute></ProtectedRoute>} />
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

              {/* SEO Routes */}
              <Route path="/student-accommodation-:province" element={<ProvinceLanding />} />
              <Route path="/tut-:campus-accommodation" element={<CampusLanding />} />
              <Route path="/nsfas-accredited-accommodation" element={<NsfAsLanding />} />
              <Route path="/south-africa-student-accommodation" element={<NationalLanding />} />

              {/* Catch-all Not Found Route */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              {/* Global ResBot Chatbot */}
              <ResBot />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
