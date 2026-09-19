import SEO from "@/components/SEO";
import { Link, useLocation } from "react-router-dom";
import PublicPartnerProfile from "@/pages/partners/PublicPartnerProfile";

export default function NotFound() {
  const location = useLocation();
  // The current App router places its wildcard here. Resolve canonical partner profiles
  // before rendering a genuine 404; this avoids widening protected admin routes.
  if (/^\/partners\/[a-z0-9][a-z0-9-]{2,79}\/?$/.test(location.pathname)) return <PublicPartnerProfile />;
  return (
    <>
      <SEO noIndex title="404 - Page Not Found | ResKonnect" description="The page you are looking for does not exist." />
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">ResKonnect · Living • AI • Opportunity</p>
          <h1 className="mt-3 text-5xl font-black">404</h1>
          <p className="mt-3 text-lg font-bold">Page not found</p>
          <p className="mt-2 text-sm text-muted-foreground">We could not find <span className="font-mono">{location.pathname}</span>.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/" className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">ResKonnect home</Link>
            <Link to="/get-started" className="rounded-full border px-5 py-3 text-sm font-bold">Get started</Link>
          </div>
        </div>
      </div>
    </>
  );
}
