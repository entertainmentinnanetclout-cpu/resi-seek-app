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
    title: "ResKonnect | Student Accommodation, Applications & Opportunities",
    description:
      "Find student accommodation, prepare applications, discover WIL and student opportunities, and explore student-housing property intelligence with ResKonnect.",
    keywords:
      "ResKonnect, Res Konnect, student accommodation South Africa, student applications, WIL opportunities, student housing property",
  },
  "/living": {
    title: "ResKonnect Living | Student Accommodation & Private Rentals",
    description:
      "Browse student accommodation, private-paying residences, NSFAS-related accommodation information and private rental support through ResKonnect.",
    keywords: "student accommodation, student housing, private rentals, NSFAS accommodation",
  },
  "/student-accommodation": {
    title: "Student Accommodation South Africa | ResKonnect",
    description:
      "Find student accommodation by university, TVET college, campus, suburb, budget, room type and availability with ResKonnect.",
    keywords: "student accommodation, student housing, student residence, NSFAS accommodation",
  },
  "/student-accommodation/pretoria": {
    title: "Student Accommodation Pretoria | TUT, UP, UNISA & SMU | ResKonnect",
    description:
      "Explore student accommodation across Pretoria, including areas serving TUT, UP, UNISA and SMU, with campus and location context from ResKonnect.",
    keywords: "student accommodation Pretoria, TUT accommodation, UP accommodation, UNISA accommodation, SMU accommodation",
  },
  "/applications": {
    title: "Student Applications, APS & Course Match | ResKonnect",
    description:
      "Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application-route support.",
    keywords: "university applications South Africa, TVET applications, APS checker, Course Match, application readiness",
  },
  "/opportunities": {
    title: "Student WIL, Internships & Opportunities | ResKonnect",
    description:
      "Discover WIL placements, internships, SETA-linked programmes, bursaries and graduate opportunities through ResKonnect.",
    keywords: "WIL opportunities, internships South Africa, SETA opportunities, graduate opportunities, bursaries",
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
    title: "ResKonnect AI | Student, Application & Property Intelligence",
    description:
      "Use source-aware ResKonnect AI for student guidance, Course Match, application readiness and student-housing property intelligence.",
    keywords: "ResKonnect AI, student AI, AI Course Match, property intelligence AI, application AI",
  },
  "/partners": {
    title: "ResKonnect Partners | Landlords, Institutions & Businesses",
    description:
      "List student accommodation, receive property leads, support student intake, and partner with ResKonnect for digital student journey solutions.",
    keywords: "list student accommodation, landlord leads, institution partnerships, student marketing",
  },
  "/find": {
    title: "Find Student Accommodation | ResKonnect Find My Res",
    description:
      "Search student residences, flats, communes and private rentals by campus, budget, room type and availability across South Africa.",
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
    title: "Get Started With ResKonnect | Student Journey Onboarding",
    description:
      "Tell ResKonnect your institution, funding and area to reach matching accommodation, application support or opportunity guidance.",
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
