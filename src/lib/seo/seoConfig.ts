// Single source of truth for ResKonnect public SEO metadata.
// Canonical base domain — every public canonical/og:url is built from this.
export const SITE_URL = "https://www.reskonnect.org";
export const SITE_NAME = "ResKonnect";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface RouteMeta {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
}

/** Path prefixes that must never be indexed (private / account / internal). */
export const NOINDEX_PREFIXES = [
  "/admin",
  "/god-mode",
  "/dashboard",
  "/auth",
  "/profile",
  "/setup-profile",
  "/messages",
  "/favorites",
  "/documents",
  "/residence/",
  "/residence",
  "/media",
  "/commerce",
  "/tvet-dashboard",
  "/recruit/dashboard",
  "/recruiter-dashboard",
  "/recruit/apply",
  "/recruit/auth",
  "/wil",
  "/cart",
  "/checkout",
  "/orders",
  "/my-store",
  "/store-setup",
  "/my-discount-orders",
  "/my-discount-codes",
  "/seller-onboarding",
  "/r/",
];

export function isNoIndexPath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  );
}

export function canonicalUrl(pathname: string): string {
  const clean = pathname === "/" ? "" : pathname.replace(/\/$/, "");
  return `${SITE_URL}${clean}`;
}

/** Per-route metadata for the main public pillars and utility pages. */
export const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "ResKonnect | Student Accommodation, Application Readiness & WIL Support",
    description:
      "ResKonnect helps students, parents, private tenants, landlords, and partners find verified accommodation, prepare application documents, check APS readiness, and access WIL support.",
    keywords:
      "student accommodation South Africa, Pretoria West accommodation, TUT residence, application readiness, APS checker, WIL placement support",
  },
  "/living": {
    title: "ResKonnect Living | Student Accommodation & Private Rental Support",
    description:
      "Browse verified student accommodation, NSFAS accommodation context, private-paying student residences, and private rental support through ResKonnect.",
    keywords:
      "student accommodation, private rentals Pretoria, NSFAS accredited accommodation, private paying student residence",
  },
  "/applications": {
    title: "ResKonnect Applications | APS Checker & Application Readiness",
    description:
      "Prepare for TVET, university, or private college applications with APS guidance, document checklists, and official portal direction.",
    keywords:
      "application readiness, APS checker, TVET application, university application, matric documents",
  },
  "/opportunities": {
    title: "ResKonnect Opportunities | WIL Placement & Student Support",
    description:
      "Access WIL readiness support, internship guidance, student referral opportunities, and career pathway support through ResKonnect.",
    keywords: "WIL placement, work integrated learning, internship support, student opportunities",
  },
  "/partners": {
    title: "ResKonnect Partners | Landlords, Institutions & Businesses",
    description:
      "List student accommodation, receive property leads, support student intake, and partner with ResKonnect for digital student journey solutions.",
    keywords: "list student accommodation, landlord leads, institution partnerships, student marketing",
  },
  "/find": {
    title: "ResKonnect Find My Res | Search Verified Student Accommodation",
    description:
      "Search verified student residences, flats, communes and private rentals by campus, budget, room type and availability across South Africa.",
  },
  "/bursaries": {
    title: "ResKonnect Bursaries | Student Funding Opportunities",
    description:
      "Browse open bursaries and funding opportunities for South African students, with closing dates, requirements and official application links.",
  },
  "/events": {
    title: "ResKonnect Events | Campus Events for South African Students",
    description: "See what is happening on and around campus — student events, expos, orientation and community activities.",
  },
  "/campus-news": {
    title: "ResKonnect Campus News | Student Updates & Notices",
    description: "Student-focused campus news, registration updates, accommodation notices and institution announcements.",
  },
  "/roommates": {
    title: "ResKonnect Roommate Finder | Share Student Accommodation",
    description: "Find a compatible roommate to share verified student accommodation and split costs near your campus.",
  },
  "/discounts": {
    title: "ResKonnect Student Deals & Discounts",
    description: "Student-only deals on essentials, move-in items and services from partner businesses.",
  },
  "/get-started": {
    title: "Get Started With ResKonnect | Guided Student Onboarding",
    description:
      "Tell us your institution, funding and area, and we will point you to matching accommodation, application readiness support or WIL guidance.",
  },
  "/terms": {
    title: "ResKonnect Terms of Use",
    description: "The terms that apply when using the ResKonnect platform and its services.",
  },
  "/privacy": {
    title: "ResKonnect Privacy Policy",
    description: "How ResKonnect collects, uses and protects your personal information.",
  },
};

export function getRouteMeta(pathname: string): RouteMeta | undefined {
  return ROUTE_META[pathname];
}