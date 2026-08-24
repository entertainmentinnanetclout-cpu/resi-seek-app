import SEO from "@/components/SEO";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import About from "@/pages/public/About";
import ManagedSeoPage from "@/pages/seo/ManagedSeoPage";
import PropertyOpportunityDetail from "@/pages/public/PropertyOpportunityDetail";
import PublicOpportunityDetail from "@/pages/public/PublicOpportunityDetail";
import TumeloCareerEducation from "@/pages/public/TumeloCareerEducation";

const MANAGED_SEARCH_PATHS = new Set([
  "/ai",
  "/properties",
  "/property-auctions",
  "/student-accommodation-for-sale",
  "/development-opportunities",
  "/student-accommodation/pretoria",
  "/opportunities/internships",
  "/opportunities/seta",
]);

const NotFound = () => {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, "") : location.pathname;
  const isAboutRoute = normalizedPath === "/about" || normalizedPath === "/contact";
  const isTumeloCareerRoute = normalizedPath === "/career-education/tumelo";
  const isManagedSearchRoute = MANAGED_SEARCH_PATHS.has(normalizedPath);
  const isPublishedPropertyRoute = /^\/properties\/[^/]+$/.test(normalizedPath);
  const isPublishedOpportunityRoute = /^\/opportunity\/[^/]+$/.test(normalizedPath);
  const isKnownFallbackRoute =
    isAboutRoute ||
    isTumeloCareerRoute ||
    isManagedSearchRoute ||
    isPublishedPropertyRoute ||
    isPublishedOpportunityRoute;

  useEffect(() => {
    if (!isKnownFallbackRoute) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [isKnownFallbackRoute, location.pathname]);

  if (isAboutRoute) return <About />;
  if (isTumeloCareerRoute) return <TumeloCareerEducation />;
  if (isManagedSearchRoute) return <ManagedSeoPage pagePath={normalizedPath} />;
  if (isPublishedPropertyRoute) return <PropertyOpportunityDetail />;
  if (isPublishedOpportunityRoute) return <PublicOpportunityDetail />;

  return (
    <>
      <SEO
        noIndex
        title="404 - Page Not Found | ResKonnect"
        description="The page you are looking for does not exist."
      />
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
          <a href="/" className="text-blue-500 underline hover:text-blue-700">
            Return to Home
          </a>
        </div>
      </div>
    </>
  );
};

export default NotFound;
