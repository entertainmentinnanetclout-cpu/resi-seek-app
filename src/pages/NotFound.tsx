import SEO from "@/components/SEO";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import About from "@/pages/public/About";

const NotFound = () => {
  const location = useLocation();
  const isAboutRoute = location.pathname === "/about" || location.pathname === "/contact";

  useEffect(() => {
    if (!isAboutRoute) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [isAboutRoute, location.pathname]);

  if (isAboutRoute) return <About />;

  return (
    <>
      <SEO
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
