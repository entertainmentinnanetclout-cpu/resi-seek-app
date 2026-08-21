import SEO from "@/components/SEO";
import { Link, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import About from "@/pages/public/About";

const AccommodationLocationHub = lazy(() => import("@/pages/seo/AccommodationLocationHub"));

const NotFound = () => {
  const location = useLocation();
  const isAboutRoute = location.pathname === "/about" || location.pathname === "/contact";
  const isControlledAccommodationLocation = /^\/student-accommodation\/[a-z0-9-]+\/?$/i.test(location.pathname);

  useEffect(() => {
    if (!isAboutRoute && !isControlledAccommodationLocation) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [isAboutRoute, isControlledAccommodationLocation, location.pathname]);

  if (isAboutRoute) return <About />;
  if (isControlledAccommodationLocation) {
    return <Suspense fallback={<main className="min-h-screen bg-background" />}><AccommodationLocationHub /></Suspense>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <SEO
        title="404 - Page Not Found | ResKonnect"
        description="The requested ResKonnect page does not exist."
        noIndex
      />
      <div className="max-w-xl text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-primary">RESKONNECT</p>
        <h1 className="mt-3 text-6xl font-black">404</h1>
        <p className="mt-4 text-xl font-semibold">Page not found</p>
        <p className="mt-2 text-muted-foreground">Explore student accommodation, applications and opportunities from the main ResKonnect search hubs.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/student-accommodation" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Student accommodation</Link>
          <Link to="/applications" className="rounded-full border border-border px-5 py-2.5 font-semibold">Applications</Link>
          <Link to="/opportunities" className="rounded-full border border-border px-5 py-2.5 font-semibold">Opportunities</Link>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
