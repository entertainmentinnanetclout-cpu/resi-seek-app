import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getMarketingConsent,
  initMetaPixel,
  MARKETING_CONSENT_EVENT,
  MARKETING_PREFERENCES_EVENT,
  setMarketingConsent,
  trackMetaEvent,
  type MarketingConsent,
} from "@/lib/metaPixel";
import { ShieldCheck, X } from "lucide-react";

const MetaPixelTracker = () => {
  const location = useLocation();
  const [consent, setConsent] = useState<MarketingConsent>(() => getMarketingConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(() => getMarketingConsent() === null);
  const lastPage = useRef("");

  useEffect(() => {
    const onConsent = (event: Event) => {
      const next = (event as CustomEvent<MarketingConsent>).detail ?? getMarketingConsent();
      setConsent(next);
      setPreferencesOpen(false);
      if (next === "granted") initMetaPixel();
    };
    const onOpen = () => setPreferencesOpen(true);
    window.addEventListener(MARKETING_CONSENT_EVENT, onConsent);
    window.addEventListener(MARKETING_PREFERENCES_EVENT, onOpen);
    return () => {
      window.removeEventListener(MARKETING_CONSENT_EVENT, onConsent);
      window.removeEventListener(MARKETING_PREFERENCES_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    initMetaPixel();
    const pageKey = `${location.pathname}${location.search}`;
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    trackMetaEvent("PageView");

    if (location.pathname === "/find") {
      trackMetaEvent("Search", { content_category: "student_accommodation", source: "find_my_res" });
    } else if (/^\/res\/[^/]+$/.test(location.pathname)) {
      trackMetaEvent("ViewContent", { content_category: "student_accommodation", content_type: "product" });
    } else if (location.pathname === "/partners/landlords" || location.pathname === "/accreditation-readiness") {
      trackMetaEvent("ViewContent", { content_category: "landlord_services", content_type: "service" });
    }
  }, [consent, location.pathname, location.search]);

  if (!preferencesOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] p-3 sm:p-5" role="dialog" aria-label="Marketing privacy preferences">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"><ShieldCheck className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black">Marketing & measurement preference</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Essential site functions and ResKonnect's first-party operations continue either way. With your permission, Meta Pixel may measure website visits and broad conversion events so we can understand campaign performance. We do not intentionally send student documents, contact details, student numbers or funding records to Meta.</p></div>
              {consent !== null && <button type="button" onClick={() => setPreferencesOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close marketing preferences"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setMarketingConsent("granted")}>Allow marketing measurement</Button>
              <Button variant="outline" onClick={() => setMarketingConsent("denied")}>Essential only</Button>
              <Button asChild variant="ghost"><Link to="/privacy">Privacy policy</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaPixelTracker;
