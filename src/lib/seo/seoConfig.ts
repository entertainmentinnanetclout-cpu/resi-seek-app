// Single source of truth for ResKonnect public SEO metadata.
// Canonical base domain — every public canonical/og:url is built from this.
export const SITE_URL = "https://www.reskonnect.org";
export const SITE_NAME = "ResKonnect";
export const BRAND_ALIASES = ["Res Konnect", "ResConnect", "Res Connect", "RESKONNECT"] as const;
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
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const clean = pathOnly === "/" ? "" : pathOnly.replace(/\/$/, "");
  return `${SITE_URL}${clean}`;
}

/** Per-route metadata for the main public pillars and utility pages. */
export const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "ResKonnect | Student Accommodation, Applications, AI & Opportunities",
    description:
      "Find student accommodation, prepare university and TVET applications, access WIL and career opportunities, and explore student-housing property intelligence with ResKonnect.",
    keywords:
      "ResKonnect, Res Konnect, ResConnect, student accommodation South Africa, TUT accommodation, university applications, WIL opportunities, student property",
  },
  "/living": {
    title: "ResKonnect Living | Student Accommodation & Private Rentals",
    description:
      "Find student accommodation, private rentals, room options and housing support near universities and TVET campuses through ResKonnect Living.",
    keywords:
      "student accommodation, private rentals Pretoria, NSFAS accommodation, student residence, student rooms",
  },
  "/living/student-accommodation": {
    title: "Student Accommodation | ResKonnect Living",
    description:
      "Browse student residences and private student accommodation by campus, budget, room type, funding fit and availability.",
    keywords: "student accommodation South Africa, student residences, student rooms near campus",
  },
  "/living/private-rentals": {
    title: "Private Rentals for Students & Young Tenants | ResKonnect",
    description:
      "Explore private rentals, bachelor rooms and flexible living options for students and young tenants through ResKonnect.",
    keywords: "private rentals Pretoria, student flats, bachelor rooms, private student housing",
  },
  "/applications": {
    title: "University & TVET Applications South Africa | ResKonnect",
    description:
      "Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application direction.",
    keywords:
      "university applications South Africa, TVET applications, APS checker, Course Match, application readiness",
  },
  "/applications/tvet": {
    title: "TVET College Applications South Africa | ResKonnect",
    description:
      "Prepare for TVET college applications with course guidance, document readiness and official application links through ResKonnect.",
    keywords: "TVET applications, TVET colleges South Africa, TVET application requirements",
  },
  "/applications/university": {
    title: "University Applications South Africa | ResKonnect",
    description:
      "Prepare university applications with qualification guidance, APS readiness, documents and official application portal direction.",
    keywords: "university applications, TUT applications, UP applications, UNISA applications, APS requirements",
  },
  "/applications/private-college": {
    title: "Private College Applications South Africa | ResKonnect",
    description:
      "Explore private-college application readiness, course options and official application direction through ResKonnect.",
    keywords: "private college applications South Africa, college application readiness",
  },
  "/opportunities": {
    title: "WIL, Internships & Student Opportunities South Africa | ResKonnect",
    description:
      "Discover WIL placements, internships, SETA programmes, graduate opportunities, bursaries and student career pathways through ResKonnect.",
    keywords: "WIL placement, internships South Africa, SETA opportunities, graduate opportunities, student jobs",
  },
  "/opportunities/wil": {
    title: "WIL Placement Support South Africa | ResKonnect",
    description:
      "Access Work Integrated Learning placement support, readiness guidance and employer-linked opportunities through ResKonnect.",
    keywords: "WIL placement, Work Integrated Learning, student workplace experience, WIL South Africa",
  },
  "/opportunities/internships": {
    title: "Student Internships South Africa | ResKonnect Opportunities",
    description:
      "Discover current internship, graduate and workplace-experience opportunities for South African students and graduates.",
    keywords: "student internships South Africa, graduate opportunities, workplace experience",
  },
  "/opportunities/seta": {
    title: "SETA Opportunities for Students & Graduates | ResKonnect",
    description:
      "Find SETA-linked WIL, internship, workplace-experience and graduate opportunities through ResKonnect.",
    keywords: "SETA opportunities, SETA internships, WIL SETA, workplace experience programmes",
  },
  "/properties": {
    title: "Student Housing Property & Investment Opportunities | ResKonnect",
    description:
      "Discover student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence across South Africa.",
    keywords: "student housing investment, student accommodation property, student property for sale",
  },
  "/property-auctions": {
    title: "Student Accommodation Property Auctions South Africa | ResKonnect",
    description:
      "Track third-party student housing auctions, sale-in-execution opportunities and properties with student-accommodation potential.",
    keywords: "student accommodation auctions, property auctions Pretoria, student housing auction",
  },
  "/student-accommodation-for-sale": {
    title: "Student Accommodation for Sale South Africa | ResKonnect",
    description:
      "Explore student residences, houses, flats and buildings for sale with student-housing investment potential.",
    keywords: "student accommodation for sale, student residence for sale, student property South Africa",
  },
  "/development-opportunities": {
    title: "Student Housing Development Opportunities | ResKonnect",
    description:
      "Find houses, buildings and land with student-accommodation conversion or development potential and due-diligence indicators.",
    keywords: "student housing development, student accommodation conversion, development sites",
  },
  "/ai": {
    title: "ResKonnect AI | Student, Course & Property Intelligence",
    description:
      "Explore ResKonnect AI for student guidance, course matching, application readiness, opportunity discovery and student-housing property intelligence.",
    keywords: "student AI South Africa, AI course match, student property AI, application AI",
  },
  "/partners": {
    title: "ResKonnect Partners | Landlords, Institutions & Businesses",
    description:
      "List student accommodation, receive property leads, support student intake and partner with ResKonnect across living, applications and opportunities.",
    keywords: "list student accommodation, landlord leads, institution partnerships, student marketing",
  },
  "/find": {
    title: "Find Student Accommodation | ResKonnect Find My Res",
    description:
      "Search student residences, flats, communes and private rentals by campus, budget, room type, funding fit and current availability.",
    keywords: "find student accommodation, Find My Res, student residence near me, TUT accommodation",
  },
  "/bursaries": {
    title: "Bursaries & Student Funding South Africa | ResKonnect",
    description:
      "Browse bursaries and funding opportunities for South African students with closing dates, requirements and official application links.",
    keywords: "bursaries South Africa, student funding, university bursaries, TVET bursaries",
  },
  "/events": {
    title: "Campus Events South Africa | ResKonnect",
    description: "Discover student events, expos, orientation activities and campus-community events through ResKonnect.",
  },
  "/campus-news": {
    title: "Campus News & Student Updates | ResKonnect",
    description: "Student-focused campus news, registration updates, accommodation notices and institution announcements.",
  },
  "/roommates": {
    title: "Student Roommate Finder South Africa | ResKonnect",
    description: "Find a compatible roommate to share student accommodation and split living costs near your campus.",
  },
  "/discounts": {
    title: "Student Deals & Discounts South Africa | ResKonnect",
    description: "Discover student deals on essentials, move-in items and services from ResKonnect partners.",
  },
  "/get-started": {
    title: "Get Started With ResKonnect | Student Journey Onboarding",
    description:
      "Tell ResKonnect what you need and get routed to accommodation, application readiness, WIL, property or partner support.",
  },
  "/terms": {
    title: "ResKonnect Terms of Use",
    description: "The terms that apply when using the ResKonnect platform and its services.",
  },
  "/privacy": {
    title: "ResKonnect Privacy Policy",
    description: "How ResKonnect collects, uses and protects personal information across its platform and services.",
  },
};

export function getRouteMeta(pathname: string): RouteMeta | undefined {
  return ROUTE_META[pathname];
}