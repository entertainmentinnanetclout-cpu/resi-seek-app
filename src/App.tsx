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
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import ProvinceLanding from "./pages/seo/ProvinceLanding";
import CampusLanding from "./pages/seo/CampusLanding";
import NationalLanding from "./pages/seo/NationalLanding";
import NsfAsLanding from "./pages/seo/NsfAsLanding";

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
              {/* Core App Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/find" element={<ProtectedRoute><FindMyRes /></ProtectedRoute>} />
              <Route path="/findmyres" element={<ProtectedRoute><FindMyRes /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
              <Route path="/bursaries" element={<ProtectedRoute><BursaryFinder /></ProtectedRoute>} />
              <Route path="/discounts" element={<ProtectedRoute><StudentDiscounts /></ProtectedRoute>} />
              <Route path="/roommates" element={<ProtectedRoute><RoommateFinder /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />

              {/* Other Essential Routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup-profile" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/dashboard/updates" element={<ProtectedRoute><Updates /></ProtectedRoute>} />
              <Route path="/campus-news" element={<ProtectedRoute><CampusNews /></ProtectedRoute>} />
              <Route path="/res/:id" element={<ProtectedRoute><ResidenceDetail /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />

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
