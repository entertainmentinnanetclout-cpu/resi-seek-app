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
  "/marketplace",
  "/product",
  "/store",
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
    title: "ResKonnect | Living • AI • Opportunity",
    description:
      "ResKonnect connects Living, AI and Opportunity in one integrated student platform for accommodation, intelligent guidance, applications, bursaries, WIL and verified opportunities.",
    keywords:
      "ResKonnect, Living AI Opportunity, student platform South Africa, student accommodation, student AI, student applications, bursaries, WIL, student opportunities",
  },
  "/living": {
    title: "ResKonnect Living | Student Accommodation & Connected Living",
    description:
      "Find verified student accommodation, private-rental support, roommates and connected Living services through ResKonnect.",
    keywords: "ResKonnect Living, student accommodation South Africa, student housing, private rentals, roommates, student living",
  },
  "/student-accommodation": {
    title: "Student Accommodation | AI Discovery, 3D Maps & Placement | ResKonnect",
    description:
      "Find student accommodation with Dimpho AI, verified listings, photorealistic ResMap 3D, live route navigation and a defined accommodation placement guarantee for eligible ResKonnect placement clients.",
    keywords: "student accommodation Africa, student housing platform, student residence, AI accommodation search, 3D accommodation map, guaranteed accommodation placement",
  },
  "/student-accommodation/pretoria": {
    title: "Student Accommodation Pretoria | TUT, UP, UNISA & SMU | ResKonnect",
    description:
      "Explore student accommodation across Pretoria, including areas serving TUT, UP, UNISA and SMU, with Dimpho AI and ResMap location intelligence from ResKonnect.",
    keywords: "student accommodation Pretoria, TUT accommodation, UP accommodation, UNISA accommodation, SMU accommodation, ResMap Pretoria",
  },
  "/applications": {
    title: "Student Applications, APS & Course Match | ResKonnect",
    description:
      "Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application-route support.",
    keywords: "university applications South Africa, TVET applications, APS checker, Course Match, application readiness",
  },
  "/opportunities": {
    title: "Student Opportunities, Bursaries & WIL | ResKonnect Opportunity",
    description:
      "Explore verified current bursaries, graduate programmes, WIL and student opportunities through the ResKonnect Opportunity Engine, with signed-in relevance guidance and official application routes.",
    keywords: "student opportunities South Africa, bursaries 2027, WIL opportunities, graduate programmes, internships, ResKonnect Opportunity",
  },
  "/opportunities/internships": {
    title: "Student Internships & Graduate Opportunities | ResKonnect",
    description:
      "Find published student internships, graduate opportunities and workplace-experience programmes with closing-date and application-route context.",
    keywords: "student internships South Africa, graduate opportunities, workplace experience",
  },
  "/opportunities/seta": {
    title: "SETA WIL & Internship Opportunities | ResKonnect",
    description:
      "Discover published SETA-linked WIL, internship and workplace-experience opportunities for students and graduates.",
    keywords: "SETA opportunities, SETA internships, SETA WIL, workplace experience",
  },
  "/properties": {
    title: "Student Housing Property Intelligence | ResKonnect",
    description:
      "Explore student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence on ResKonnect.",
    keywords: "student accommodation for sale, student housing investment, property auctions, student housing development",
  },
  "/property-auctions": {
    title: "Student Accommodation Property Auctions | ResKonnect",
    description:
      "Track third-party property auctions and distressed opportunities relevant to student housing, with source and verification context from ResKonnect.",
    keywords: "student accommodation auctions, property auctions Pretoria, student housing auction",
  },
  "/student-accommodation-for-sale": {
    title: "Student Accommodation for Sale | ResKonnect",
    description:
      "Explore student residences, houses, flats and buildings marketed for sale where there is a credible student-housing investment case.",
    keywords: "student accommodation for sale, student residence for sale, student housing investment",
  },
  "/development-opportunities": {
    title: "Student Housing Development Opportunities | ResKonnect",
    description:
      "Explore buildings, houses and development sites with potential for lawful student-housing conversion, subject to independent planning and compliance checks.",
    keywords: "student housing development, student accommodation conversion, development sites",
  },
  "/ai": {
    title: "ResKonnect AI | Grounded Student Guidance & Service Intelligence",
    description:
      "Use ResKonnect AI across Living, applications and opportunities with verified platform context and account-aware next-step guidance when signed in.",
    keywords: "ResKonnect AI, student AI South Africa, student guidance AI, application guidance, opportunity matching, Luna ResKonnect, Dimpho ResKonnect",
  },
  "/partners": {
    title: "ResKonnect Partners | Landlords, Institutions & Businesses",
    description:
      "List student accommodation, receive property leads, support student intake, and partner with ResKonnect for AI-enabled student accommodation and digital journey solutions.",
    keywords: "list student accommodation, landlord leads, institution partnerships, student housing technology Africa, student marketing",
  },
  "/find": {
    title: "Find Student Accommodation | ResKonnect Find My Res",
    description:
      "Search student residences, flats, communes and private rentals by campus, budget, room type and availability with ResKonnect.",
  },
  "/findmyres": {
    title: "Find My Res | Verified Student Accommodation | ResKonnect",
    description:
      "Find verified student accommodation by campus, area, budget, funding, room type and availability. Smart matching, maps, 3D exploration and navigation are optional ResKonnect Living capabilities.",
    keywords: "Find My Res, verified student accommodation, student accommodation near campus, NSFAS accommodation, student rooms South Africa",
  },
  "/bursaries": {
    title: "Student Bursaries & Funding Opportunities | ResKonnect",
    description:
      "Browse open bursaries and student funding opportunities with closing dates, requirements and official application links.",
  },
  "/events": {
    title: "ResKonnect Events | Campus Events for South African Students",
    description: "See student events, expos, orientation activities and community events on and around campus.",
  },
  "/campus-news": {
    title: "ResKonnect Campus News | Student Updates & Notices",
    description: "Student-focused campus news, registration updates, accommodation notices and institution announcements.",
  },
  "/roommates": {
    title: "ResKonnect Roommate Finder | Share Student Accommodation",
    description: "Find a compatible roommate to share student accommodation and split costs near your campus.",
  },
  "/discounts": {
    title: "ResKonnect Student Deals & Discounts",
    description: "Student deals on essentials, move-in items and services from participating businesses.",
  },
  "/get-started": {
    title: "Get Started With ResKonnect | Student Accommodation & Journey Onboarding",
    description:
      "Tell ResKonnect your institution, funding and area to reach matching accommodation, Dimpho guidance, application support or opportunity guidance.",
  },
  "/terms": {
    title: "ResKonnect Terms of Use",
    description: "The terms that apply when using the ResKonnect platform and its services.",
  },
  "/privacy": {
    title: "ResKonnect Privacy Policy",
    description: "How ResKonnect collects, uses and protects personal information.",
  },
};

export function getRouteMeta(pathname: string): RouteMeta | undefined {
  return ROUTE_META[pathname];
}
