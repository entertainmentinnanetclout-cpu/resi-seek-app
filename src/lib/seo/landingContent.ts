// Content definitions for ResKonnect SEO landing and guide pages.
// Every page answers: what it is, who it is for, what you can do,
// what ResKonnect helps with, what ResKonnect does not do, and the next step.
import type { Crumb, FaqItem } from "./jsonLd";
import type { SeoLink } from "@/components/seo/SeoInternalLinks";
import type { ListingQuery } from "@/components/seo/SeoListingResults";

export interface SeoLandingContent {
  path: string;
  kind: "landing" | "guide";
  title: string;
  description: string;
  keywords?: string;
  h1: string;
  intro: string[];
  audience: string;
  benefits: { title: string; body: string }[];
  helps: string[];
  notDoing: string[];
  body?: { heading: string; paragraphs: string[] }[];
  listings?: { heading: string; query: ListingQuery; emptyText: string };
  faqs: FaqItem[];
  links: SeoLink[];
  cta: { label: string; to: string; secondaryLabel?: string; secondaryTo?: string };
  crumbs: Crumb[];
}

const HOME: Crumb = { name: "Home", path: "/" };
const ACC: Crumb = { name: "Student Accommodation", path: "/student-accommodation" };
const RENT: Crumb = { name: "Private Rentals", path: "/private-rentals" };
const APPS: Crumb = { name: "Applications", path: "/applications" };
const OPPS: Crumb = { name: "Opportunities", path: "/opportunities" };
const PARTNERS: Crumb = { name: "Partners", path: "/partners" };
const GUIDES: Crumb = { name: "Guides", path: "/guides/how-to-find-safe-student-accommodation" };

const NOT_ADMISSIONS =
  "ResKonnect is not an admissions office and does not replace official institution application systems.";
const NOT_NSFAS = "ResKonnect does not provide NSFAS application services.";
const NO_GUARANTEE = "We do not guarantee placement, funding outcomes or admission decisions.";

const ACCOMMODATION_LINKS: SeoLink[] = [
  { label: "Student accommodation", to: "/student-accommodation", description: "All verified listings across our areas." },
  { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west", description: "Rooms close to Pretoria West campuses." },
  { label: "Accommodation near TUT", to: "/student-accommodation/near-tut", description: "Residences within reach of TUT campuses." },
  { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited", description: "Listings with NSFAS accreditation context." },
  { label: "Private rentals", to: "/private-rentals", description: "Rooms and flats for private-paying tenants." },
  { label: "Application readiness", to: "/applications/application-readiness", description: "Get your documents and APS sorted." },
];

export const SEO_LANDING_PAGES: SeoLandingContent[] = [
  // ---------------- Accommodation ----------------
  {
    path: "/student-accommodation",
    kind: "landing",
    title: "ResKonnect Student Accommodation in South Africa | Verified Listings",
    description:
      "Browse verified student accommodation for university, TVET and private-paying students. Compare rooms, prices, campus distance and availability on ResKonnect.",
    keywords: "student accommodation, student housing South Africa, verified residences, campus accommodation",
    h1: "Student Accommodation in South Africa",
    intro: [
      "ResKonnect lists verified student accommodation for university students, TVET college students and private-paying students. Every listing shows the room types, monthly price, distance from campus and current availability so you can compare properly before you commit.",
      "Instead of scrolling through group chats and unverified adverts, you get a single place to search by campus, budget and room type, then enquire through ResKonnect.",
    ],
    audience: "Students looking for a place to stay for the academic year, and parents helping them decide.",
    benefits: [
      { title: "Verified listings only", body: "Each residence is checked before it goes live, and listing details are kept in sync with the property." },
      { title: "Compare on real detail", body: "Price, room type, distance from campus, availability, WiFi, parking and furnishing are shown per listing." },
      { title: "One enquiry channel", body: "All enquiries route through ResKonnect so your details are not scattered across strangers." },
      { title: "Built for the SA student journey", body: "University, TVET and private-paying options sit side by side, with NSFAS accreditation shown where it applies." },
    ],
    helps: [
      "Searching verified residences by campus, budget and room type",
      "Understanding what a listing actually includes before you enquire",
      "Preparing the documents most residences ask for",
      "Connecting you to the property through ResKonnect",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Available student accommodation",
      query: { limit: 6 },
      emptyText: "No listings are loaded for this view yet. Search all residences to see what is currently live.",
    },
    faqs: [
      { question: "What does it cost to use ResKonnect?", answer: "Searching listings and enquiring about accommodation is free for students." },
      { question: "Are the listings verified?", answer: "Listings are checked before publication and property details are maintained with the landlord or residence manager." },
      { question: "Can I apply if I am not funded by NSFAS?", answer: "Yes. Many listings accept private-paying students, and private rental options are listed separately." },
      { question: "How do I contact a residence?", answer: "Enquire through the listing page. Enquiries route through ResKonnect rather than exposing private contact details." },
    ],
    links: ACCOMMODATION_LINKS,
    cta: { label: "Search residences", to: "/find", secondaryLabel: "Get guided help", secondaryTo: "/get-started" },
    crumbs: [HOME, ACC],
  },
  {
    path: "/student-accommodation/pretoria-west",
    kind: "landing",
    title: "ResKonnect Student Accommodation in Pretoria West | Rooms Near Campus",
    description:
      "Find verified student accommodation in Pretoria West. Compare rooms, prices and availability close to TUT Pretoria West and surrounding campuses.",
    keywords: "Pretoria West student accommodation, res in Pretoria West, student rooms Pretoria West",
    h1: "Student Accommodation in Pretoria West",
    intro: [
      "Pretoria West is one of the busiest student accommodation areas in Tshwane, largely because of its proximity to TUT Pretoria West and the transport routes running through the area. Rooms move quickly, especially in the weeks around registration.",
      "This page brings together the Pretoria West listings currently on ResKonnect so you can compare price, room type and walking distance in one place.",
    ],
    audience: "Students studying in or near Pretoria West who want to stay within walking or short taxi distance of campus.",
    benefits: [
      { title: "Close to campus", body: "Listings in and around Pretoria West cut daily transport costs and travel time." },
      { title: "Range of budgets", body: "From shared rooms to single rooms and bachelor units, with monthly prices shown upfront." },
      { title: "Availability shown", body: "See which residences still have spots instead of phoning around." },
      { title: "Safety detail", body: "Security features, access control and furnishing are listed where the property provides them." },
    ],
    helps: [
      "Comparing Pretoria West residences by price and distance",
      "Checking availability before you travel to view a room",
      "Preparing the documents residences typically request",
      "Enquiring through ResKonnect instead of unverified adverts",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Pretoria West listings",
      query: { areaTerms: ["pretoria west", "pretoria-west"], limit: 6 },
      emptyText: "No Pretoria West listings are live right now. Search all residences or tell us what you need and we will point you to the closest matches.",
    },
    faqs: [
      { question: "How much is student accommodation in Pretoria West?", answer: "Prices vary by room type and what is included. Each listing on this page shows its own monthly price, so compare the listings above rather than relying on an average." },
      { question: "Can I walk to campus from Pretoria West accommodation?", answer: "Many listings in the area are within walking distance of TUT Pretoria West. Each listing shows its address and distance from campus where the property has supplied it." },
      { question: "When should I start looking?", answer: "Start before registration. Pretoria West rooms fill fastest in the weeks around the start of the academic year." },
      { question: "Do these residences take NSFAS students?", answer: "Some do. Listings that carry NSFAS accreditation are marked, and you can view only those on the NSFAS accredited page." },
    ],
    links: [
      { label: "Accommodation near TUT", to: "/student-accommodation/near-tut" },
      { label: "Near TUT Pretoria West", to: "/student-accommodation/near-tut-pretoria-west" },
      { label: "Private rentals in Pretoria West", to: "/private-rentals/pretoria-west" },
      { label: "Bachelor rooms in Pretoria", to: "/private-rentals/bachelor-rooms-pretoria" },
      { label: "Guide: student accommodation in Pretoria West", to: "/guides/student-accommodation-pretoria-west" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
    ],
    cta: { label: "Search Pretoria West rooms", to: "/find", secondaryLabel: "Document checklist", secondaryTo: "/guides/what-documents-do-you-need-for-student-accommodation" },
    crumbs: [HOME, ACC, { name: "Pretoria West", path: "/student-accommodation/pretoria-west" }],
  },
  {
    path: "/student-accommodation/near-tut",
    kind: "landing",
    title: "ResKonnect Student Accommodation Near TUT | Verified Residences",
    description:
      "Find verified student accommodation near TUT campuses. Compare residences by campus, price, room type and availability on ResKonnect.",
    keywords: "accommodation near TUT, TUT residence, TUT student housing",
    h1: "Student Accommodation Near TUT",
    intro: [
      "Tshwane University of Technology students study across several campuses, and the right accommodation depends on which campus you attend. This page pulls together the residences on ResKonnect that serve TUT students.",
      "Compare each listing on price, room type, distance and availability, then enquire through ResKonnect.",
    ],
    audience: "TUT students across Pretoria West, Soshanguve, Ga-Rankuwa, Arcadia and the regional campuses.",
    benefits: [
      { title: "Campus-aware search", body: "Filter down to the campus you actually attend instead of browsing the whole city." },
      { title: "Accreditation context", body: "NSFAS accreditation and TUT accreditation status are shown where the property has it." },
      { title: "Real availability", body: "Spot counts help you avoid chasing residences that are already full." },
      { title: "Move-in ready detail", body: "Furnishing, WiFi, parking and utilities are listed per residence." },
    ],
    helps: [
      "Matching accommodation to your specific TUT campus",
      "Comparing accredited and private-paying options",
      "Getting your accommodation documents ready",
      "Enquiring through a single, safe channel",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Residences serving TUT students",
      query: { audience: "university", areaTerms: ["tut", "pretoria", "soshanguve", "ga-rankuwa", "arcadia"], limit: 6 },
      emptyText: "No TUT-area listings are live in this view right now. Search all residences to see current availability.",
    },
    faqs: [
      { question: "Which TUT campuses do you cover?", answer: "Listings currently cover Pretoria West, Soshanguve, Ga-Rankuwa and Arcadia, with regional campuses added as properties are onboarded." },
      { question: "Is this official TUT accommodation?", answer: "No. ResKonnect lists off-campus and private residences. Official campus residence allocation is handled by the institution." },
      { question: "Can NSFAS pay for these residences?", answer: "Only residences with NSFAS accreditation can be paid through NSFAS accommodation funding. Those listings are marked as accredited." },
      { question: "How do I secure a room?", answer: "Enquire on the listing, submit the documents the residence asks for, and the property confirms your placement directly." },
    ],
    links: [
      { label: "Near TUT Pretoria West", to: "/student-accommodation/near-tut-pretoria-west" },
      { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "University student accommodation", to: "/student-accommodation/university" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "University application readiness", to: "/applications/university-application-readiness" },
      { label: "Guide: find safe student accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
    ],
    cta: { label: "Search TUT residences", to: "/find" },
    crumbs: [HOME, ACC, { name: "Near TUT", path: "/student-accommodation/near-tut" }],
  },
  {
    path: "/student-accommodation/near-tut-pretoria-west",
    kind: "landing",
    title: "ResKonnect Accommodation Near TUT Pretoria West Campus",
    description:
      "Verified student accommodation near TUT Pretoria West campus. Compare walking-distance rooms, prices and availability on ResKonnect.",
    keywords: "TUT Pretoria West accommodation, res near TUT Pretoria West, student room Pretoria West campus",
    h1: "Accommodation Near TUT Pretoria West Campus",
    intro: [
      "TUT Pretoria West sits in one of the densest student accommodation pockets in Tshwane. Staying close means shorter walks, lower transport spend and easier access to campus during test and submission weeks.",
      "The listings below are the Pretoria West residences on ResKonnect that serve TUT students, with price, room type and availability shown per property.",
    ],
    audience: "TUT students registered at the Pretoria West campus who want to live close to class.",
    benefits: [
      { title: "Walking distance options", body: "Listings clustered around the Pretoria West campus and its main access roads." },
      { title: "Transport savings", body: "Living close cuts daily taxi costs, which adds up over a full academic year." },
      { title: "Verified before listing", body: "Properties are checked before they appear, and details are kept current." },
      { title: "Clear next step", body: "Enquire directly from the listing once you have compared your shortlist." },
    ],
    helps: [
      "Shortlisting residences within reach of TUT Pretoria West",
      "Comparing monthly cost against distance and room type",
      "Getting accommodation documents ready before you enquire",
      "Reaching the property safely through ResKonnect",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Residences near TUT Pretoria West",
      query: { areaTerms: ["pretoria west", "pretoria-west"], audience: "university", limit: 6 },
      emptyText: "Nothing is live for this exact view right now. Browse all Pretoria West accommodation or search every residence.",
    },
    faqs: [
      { question: "How far are these residences from campus?", answer: "Each listing shows its address and, where supplied by the property, the distance from campus. Use that rather than a general estimate." },
      { question: "Are rooms furnished?", answer: "It varies by property. Furnishing is shown on each listing so you know what you need to bring." },
      { question: "Can I share a room to save money?", answer: "Several listings offer shared and double rooms at a lower monthly rate than singles." },
      { question: "What documents will the residence want?", answer: "Usually your ID, proof of registration and proof of funding or a guarantor. See our accommodation document guide for the full list." },
    ],
    links: [
      { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "All accommodation near TUT", to: "/student-accommodation/near-tut" },
      { label: "Private rentals in Pretoria West", to: "/private-rentals/pretoria-west" },
      { label: "What documents do you need?", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
      { label: "Guide: Pretoria West living", to: "/guides/student-accommodation-pretoria-west" },
      { label: "APS checker", to: "/applications/aps-checker" },
    ],
    cta: { label: "View Pretoria West rooms", to: "/find" },
    crumbs: [HOME, ACC, { name: "Near TUT Pretoria West", path: "/student-accommodation/near-tut-pretoria-west" }],
  },
  {
    path: "/student-accommodation/near-tshwane-south-tvet",
    kind: "landing",
    title: "ResKonnect Accommodation Near Tshwane South TVET College",
    description:
      "Find verified student accommodation near Tshwane South TVET College. Compare affordable rooms, prices and availability for TVET students.",
    keywords: "Tshwane South TVET accommodation, TVET student accommodation Pretoria, TVET res",
    h1: "Accommodation Near Tshwane South TVET College",
    intro: [
      "TVET students are often left out of student accommodation platforms, even though the need is the same. ResKonnect lists residences and private rooms that accept TVET students, including options near Tshwane South TVET College.",
      "Compare what is available on price, room type and distance, then enquire through ResKonnect.",
    ],
    audience: "Tshwane South TVET College students and other TVET students studying in the Pretoria area.",
    benefits: [
      { title: "TVET students welcome", body: "Listings shown here accept TVET students, not only university students." },
      { title: "Affordable-first", body: "Shared rooms and lower-cost options are included alongside single rooms." },
      { title: "Practical detail", body: "Transport access, furnishing and utilities are listed where the property provides them." },
      { title: "Funding context", body: "Where a property carries NSFAS accreditation, it is shown on the listing." },
    ],
    helps: [
      "Finding residences that accept TVET students",
      "Comparing affordable rooms near campus",
      "TVET application readiness and document preparation",
      "Enquiring through one safe channel",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Listings open to TVET students",
      query: { audience: "tvet", limit: 6 },
      emptyText: "No TVET-accepting listings are live in this view yet. Search all residences, or tell us your campus and budget so we can point you to the closest options.",
    },
    faqs: [
      { question: "Do residences accept TVET college students?", answer: "Yes. The listings on this page are marked as accepting TVET students. Always confirm with the property when you enquire." },
      { question: "Can NSFAS cover TVET accommodation?", answer: "NSFAS accommodation funding applies only at accredited properties and depends on your funding status. Accredited listings are marked as such." },
      { question: "Is TVET accommodation cheaper?", answer: "Prices depend on the room and the area, not the institution type. Compare the monthly price on each listing above." },
      { question: "Can you help with my TVET application?", answer: "We help with readiness — documents, checklists and official portal direction. Applications are submitted on the college's own system." },
    ],
    links: [
      { label: "TVET student accommodation", to: "/student-accommodation/tvet" },
      { label: "TVET application readiness", to: "/applications/tvet-application-readiness" },
      { label: "Guide: TVET application checklist", to: "/guides/tvet-application-checklist" },
      { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "Private rentals", to: "/private-rentals" },
    ],
    cta: { label: "Search TVET-friendly rooms", to: "/find" },
    crumbs: [HOME, ACC, { name: "Near Tshwane South TVET", path: "/student-accommodation/near-tshwane-south-tvet" }],
  },
  {
    path: "/student-accommodation/tvet",
    kind: "landing",
    title: "ResKonnect TVET College Student Accommodation",
    description:
      "Verified accommodation for TVET college students across South Africa. Compare affordable rooms, availability and campus distance on ResKonnect.",
    keywords: "TVET accommodation, TVET college residence, TVET student housing South Africa",
    h1: "TVET College Student Accommodation",
    intro: [
      "TVET students need the same things every other student needs: a safe room, a fair price and a short trip to campus. ResKonnect lists residences and rooms that accept TVET college students.",
      "Browse the listings below, compare them on price and distance, and enquire on the property that fits.",
    ],
    audience: "TVET college students, and school leavers planning a TVET pathway.",
    benefits: [
      { title: "Built for TVET too", body: "Audience is set per property, so you only see places that accept TVET students." },
      { title: "Affordable range", body: "Shared, double and single rooms across a range of monthly prices." },
      { title: "Readiness support", body: "Pair your accommodation search with TVET application readiness support." },
      { title: "No middlemen", body: "Enquiries route through ResKonnect, not informal agents." },
    ],
    helps: [
      "Finding TVET-friendly accommodation near your college",
      "Preparing application and accommodation documents",
      "Understanding official college portal steps",
      "Planning your move-in checklist",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "Accommodation for TVET students",
      query: { audience: "tvet", limit: 6 },
      emptyText: "No TVET listings are live in this view yet. Search all residences to see everything currently available.",
    },
    faqs: [
      { question: "Is accommodation different for TVET students?", answer: "The property standards are the same. What differs is whether the landlord accepts TVET students and whether the property is accredited for funded students." },
      { question: "Which colleges do you cover?", answer: "Coverage grows as properties are onboarded. Tshwane-area colleges are currently the strongest coverage." },
      { question: "Do I need proof of registration?", answer: "Most properties ask for proof of registration or an acceptance letter, along with your ID." },
      { question: "Can I get help with my college application?", answer: "We support readiness — checklists, documents and official portal direction. The application itself is submitted on the college's system." },
    ],
    links: [
      { label: "Near Tshwane South TVET", to: "/student-accommodation/near-tshwane-south-tvet" },
      { label: "TVET application readiness", to: "/applications/tvet-application-readiness" },
      { label: "TVET application checklist", to: "/guides/tvet-application-checklist" },
      { label: "Student accommodation hub", to: "/student-accommodation" },
      { label: "Private rentals", to: "/private-rentals" },
      { label: "WIL placement support", to: "/opportunities/wil-placement-support" },
    ],
    cta: { label: "Browse TVET accommodation", to: "/find" },
    crumbs: [HOME, ACC, { name: "TVET", path: "/student-accommodation/tvet" }],
  },
  {
    path: "/student-accommodation/university",
    kind: "landing",
    title: "ResKonnect University Student Accommodation | Verified Residences",
    description:
      "Compare verified university student accommodation by campus, price, room type and availability. Off-campus residences listed on ResKonnect.",
    keywords: "university accommodation, off campus residence, university student housing South Africa",
    h1: "University Student Accommodation",
    intro: [
      "Off-campus residences carry most of the university accommodation load in South Africa, and quality varies enormously. ResKonnect only lists properties that have been checked, with the details you actually need to decide.",
      "Compare the listings below by campus, monthly price and availability.",
    ],
    audience: "University students who did not get campus residence, or who prefer off-campus living.",
    benefits: [
      { title: "Verified off-campus stock", body: "Properties are checked before they are published." },
      { title: "Full listing detail", body: "Room types, price, distance, furnishing, WiFi and parking are shown per property." },
      { title: "Accreditation shown", body: "NSFAS accreditation is displayed where the property holds it." },
      { title: "Compare, then enquire", body: "Shortlist several properties before you commit to a viewing." },
    ],
    helps: [
      "Finding off-campus residences near your university",
      "Comparing what each residence includes",
      "Preparing accommodation documents",
      "Enquiring through ResKonnect",
    ],
    notDoing: [NOT_ADMISSIONS, NOT_NSFAS, NO_GUARANTEE],
    listings: {
      heading: "University-friendly residences",
      query: { audience: "university", limit: 6 },
      emptyText: "No university listings are live in this view yet. Search all residences to see current availability.",
    },
    faqs: [
      { question: "Do you list campus residences?", answer: "No. Campus residence allocation is handled by each institution. ResKonnect lists off-campus and private properties." },
      { question: "How early should I book?", answer: "Rooms near large campuses go fastest around registration. Starting a month or two earlier gives you real choice." },
      { question: "Can my parents view the listing?", answer: "Yes, listings are public and shareable. Many families compare together before enquiring." },
      { question: "What if I need to change residence mid-year?", answer: "Search availability again on Find My Res. Notice periods depend on the lease you signed with the property." },
    ],
    links: [
      { label: "Accommodation near TUT", to: "/student-accommodation/near-tut" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "University application readiness", to: "/applications/university-application-readiness" },
      { label: "University application checklist", to: "/guides/university-application-checklist" },
      { label: "Private rentals", to: "/private-rentals" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
    ],
    cta: { label: "Browse university residences", to: "/find" },
    crumbs: [HOME, ACC, { name: "University", path: "/student-accommodation/university" }],
  },
  {
    path: "/student-accommodation/nsfas-accredited",
    kind: "landing",
    title: "ResKonnect NSFAS Accredited Student Accommodation",
    description:
      "Browse student accommodation listed with NSFAS accreditation context. Compare accredited residences by campus, room type and availability.",
    keywords: "NSFAS accredited accommodation, NSFAS residence, NSFAS approved student housing",
    h1: "NSFAS Accredited Student Accommodation",
    intro: [
      "If your accommodation is funded through NSFAS, the property normally has to be accredited. This page shows the residences on ResKonnect that are listed as NSFAS accredited, so you can focus your search.",
      "Accreditation status is supplied by the property. Always confirm the current status with the residence and your institution before you sign anything.",
    ],
    audience: "NSFAS-funded students who need accommodation at an accredited property.",
    benefits: [
      { title: "Accredited listings grouped", body: "See only the properties listed as NSFAS accredited instead of filtering manually." },
      { title: "Cost clarity", body: "Monthly price and what it includes are shown per listing." },
      { title: "Campus proximity", body: "Compare distance so your allowance goes further." },
      { title: "Straightforward enquiries", body: "Enquire through ResKonnect once you have shortlisted." },
    ],
    helps: [
      "Finding properties listed as NSFAS accredited",
      "Comparing accredited residences near your campus",
      "Preparing the documents an accredited residence asks for",
      "Understanding what accreditation means for your placement",
    ],
    notDoing: [
      NOT_NSFAS,
      "We cannot confirm your funding status, allowance amounts or payment timelines — that sits with NSFAS and your institution.",
      NOT_ADMISSIONS,
    ],
    listings: {
      heading: "NSFAS accredited listings",
      query: { nsfasOnly: true, limit: 6 },
      emptyText: "No accredited listings are live in this view yet. Search all residences and check the NSFAS badge on each listing.",
    },
    faqs: [
      { question: "Can ResKonnect apply for NSFAS on my behalf?", answer: "No. ResKonnect does not provide NSFAS application services. NSFAS applications are submitted on the official NSFAS system." },
      { question: "What does NSFAS accredited mean?", answer: "It means the property has been accredited to house students whose accommodation is funded through NSFAS. Accreditation is granted to the property, not to ResKonnect." },
      { question: "How do I confirm a property is still accredited?", answer: "Ask the residence for its current accreditation and confirm with your institution's accommodation office before signing." },
      { question: "What if I am not NSFAS funded?", answer: "Private-paying students can use every other listing on ResKonnect, including private rentals." },
    ],
    links: [
      { label: "Student accommodation hub", to: "/student-accommodation" },
      { label: "Accommodation near TUT", to: "/student-accommodation/near-tut" },
      { label: "TVET accommodation", to: "/student-accommodation/tvet" },
      { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "What documents do you need?", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
      { label: "Private rentals", to: "/private-rentals" },
    ],
    cta: { label: "View accredited listings", to: "/find" },
    crumbs: [HOME, ACC, { name: "NSFAS accredited", path: "/student-accommodation/nsfas-accredited" }],
  },

  // ---------------- Private rentals ----------------
  {
    path: "/private-rentals",
    kind: "landing",
    title: "ResKonnect Private Rentals for Students & Young Professionals",
    description:
      "Private rental rooms, bachelor flats and units for private-paying tenants. Compare monthly rent, area and availability through ResKonnect.",
    keywords: "private rentals, rooms to rent, bachelor flat, private tenant accommodation",
    h1: "Private Rentals",
    intro: [
      "Not everyone renting near campus is a funded student. Private rentals on ResKonnect are for private-paying tenants — students paying their own way, graduates on WIL placement, and young working people who want a straightforward room or flat.",
      "These listings are kept separate from funded student residence stock so you are not filtering through options you cannot use.",
    ],
    audience: "Private-paying tenants: self-funded students, WIL interns and young professionals.",
    benefits: [
      { title: "Separated from funded stock", body: "Private rental listings are their own category, not mixed into accredited residence results." },
      { title: "Rent shown upfront", body: "Monthly rent and what is included are listed per property." },
      { title: "Room and flat options", body: "From single rooms in a shared house to self-contained bachelor units." },
      { title: "Safe enquiry route", body: "Enquiries go through ResKonnect rather than classifieds." },
    ],
    helps: [
      "Finding private rooms and flats near campus and work",
      "Comparing rent, deposit and inclusions",
      "Understanding what to check before signing a lease",
      "Reaching landlords through ResKonnect",
    ],
    notDoing: [
      "We are not a rental agency and we do not manage leases, deposits or rental payments.",
      NOT_NSFAS,
      NO_GUARANTEE,
    ],
    listings: {
      heading: "Private rental listings",
      query: { audience: "private", limit: 6 },
      emptyText: "No private rentals are live in this view yet. Search all listings to see what is currently available.",
    },
    faqs: [
      { question: "Who are private rentals for?", answer: "Anyone paying their own rent — self-funded students, interns and working tenants. Funding accreditation is not required." },
      { question: "Do I need a payslip?", answer: "Landlords set their own requirements. Many ask for proof of income, a guarantor or a deposit." },
      { question: "Are utilities included?", answer: "It depends on the property. Each listing shows whether utilities are included." },
      { question: "Can I rent for less than a year?", answer: "Lease periods vary by property and are shown on the listing where the landlord has supplied them." },
    ],
    links: [
      { label: "Private rentals in Pretoria West", to: "/private-rentals/pretoria-west" },
      { label: "Bachelor rooms in Pretoria", to: "/private-rentals/bachelor-rooms-pretoria" },
      { label: "Student accommodation hub", to: "/student-accommodation" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "WIL placement support", to: "/opportunities/wil-placement-support" },
      { label: "List your property", to: "/partners/landlords" },
    ],
    cta: { label: "Browse private rentals", to: "/find" },
    crumbs: [HOME, RENT],
  },
  {
    path: "/private-rentals/pretoria-west",
    kind: "landing",
    title: "ResKonnect Private Rentals in Pretoria West | Rooms & Flats",
    description:
      "Private rental rooms and flats in Pretoria West for private-paying tenants. Compare rent, inclusions and availability on ResKonnect.",
    keywords: "private rental Pretoria West, rooms to rent Pretoria West, flat to rent Pretoria West",
    h1: "Private Rentals in Pretoria West",
    intro: [
      "Pretoria West has a deep private rental market alongside its student residences: rooms in shared houses, backyard units and small flats. If you are paying your own rent, these are usually more flexible than accredited residence stock.",
      "The listings below are the Pretoria West private rentals currently on ResKonnect.",
    ],
    audience: "Private-paying tenants who want to live in or near Pretoria West.",
    benefits: [
      { title: "Local stock", body: "Rentals concentrated in and around Pretoria West." },
      { title: "Flexible options", body: "Rooms, backyard units and small flats rather than residence-only formats." },
      { title: "Clear monthly cost", body: "Rent and inclusions listed per property." },
      { title: "Verified landlords", body: "Properties are onboarded through ResKonnect rather than posted anonymously." },
    ],
    helps: [
      "Finding private rooms and flats in Pretoria West",
      "Comparing rent against location and inclusions",
      "Knowing what to check before you pay a deposit",
      "Contacting the landlord through ResKonnect",
    ],
    notDoing: [
      "We are not a rental agency and do not handle leases or deposits.",
      NOT_NSFAS,
      NO_GUARANTEE,
    ],
    listings: {
      heading: "Pretoria West private rentals",
      query: { audience: "private", areaTerms: ["pretoria west", "pretoria-west"], limit: 6 },
      emptyText: "No Pretoria West private rentals are live right now. Browse all private rentals or search every listing.",
    },
    faqs: [
      { question: "How much is rent in Pretoria West?", answer: "It depends on whether you are renting a room in a shared house or a self-contained unit. Compare the monthly rent shown on each listing above." },
      { question: "Do I have to be a student?", answer: "No. Private rentals are open to any private-paying tenant." },
      { question: "What deposit will I need?", answer: "Deposits are set by the landlord. Ask before you commit and never pay before you have viewed the property and seen a lease." },
      { question: "Is Pretoria West safe?", answer: "Like any dense urban area, it varies street by street. Check access control, lighting and security on the specific property, and view it in person." },
    ],
    links: [
      { label: "All private rentals", to: "/private-rentals" },
      { label: "Bachelor rooms in Pretoria", to: "/private-rentals/bachelor-rooms-pretoria" },
      { label: "Pretoria West student accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "Guide: Pretoria West living", to: "/guides/student-accommodation-pretoria-west" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "List your property", to: "/partners/landlords" },
    ],
    cta: { label: "View Pretoria West rentals", to: "/find" },
    crumbs: [HOME, RENT, { name: "Pretoria West", path: "/private-rentals/pretoria-west" }],
  },
  {
    path: "/private-rentals/bachelor-rooms-pretoria",
    kind: "landing",
    title: "ResKonnect Bachelor Rooms & Flats to Rent in Pretoria",
    description:
      "Bachelor rooms and self-contained units to rent in Pretoria for private-paying tenants. Compare rent, inclusions and availability on ResKonnect.",
    keywords: "bachelor room Pretoria, bachelor flat to rent Pretoria, self contained room Pretoria",
    h1: "Bachelor Rooms & Flats to Rent in Pretoria",
    intro: [
      "A bachelor unit gives you your own space — usually a single room with its own kitchenette and bathroom — without the cost of a full one-bedroom flat. It suits students who want privacy and interns on placement.",
      "Browse the bachelor and self-contained listings currently available through ResKonnect in Pretoria.",
    ],
    audience: "Private-paying tenants in Pretoria who want a self-contained space rather than a shared house.",
    benefits: [
      { title: "Own space", body: "Self-contained units mean no shared kitchen or bathroom rota." },
      { title: "Cheaper than a one-bedroom", body: "Bachelor units typically rent below equivalent one-bedroom flats in the same area." },
      { title: "Inclusions listed", body: "See whether water, electricity and WiFi are part of the rent." },
      { title: "Direct enquiry", body: "Contact the landlord through ResKonnect." },
    ],
    helps: [
      "Finding bachelor and self-contained units in Pretoria",
      "Comparing rent against inclusions and location",
      "Understanding lease basics before you sign",
      "Enquiring safely",
    ],
    notDoing: [
      "We are not a rental agency and do not handle leases or deposits.",
      NOT_NSFAS,
      NO_GUARANTEE,
    ],
    listings: {
      heading: "Bachelor and self-contained listings",
      query: { audience: "private", areaTerms: ["pretoria", "tshwane"], limit: 6 },
      emptyText: "No bachelor units are live in this view right now. Browse all private rentals to see current stock.",
    },
    faqs: [
      { question: "What counts as a bachelor unit?", answer: "Generally one open room with a sleeping and living area, plus its own kitchenette and bathroom." },
      { question: "Are bachelor units furnished?", answer: "Some are, some are not. Furnishing is shown per listing." },
      { question: "Can two people share a bachelor?", answer: "That depends on the landlord and the lease. Ask before you move a second person in." },
      { question: "What should I check before paying?", answer: "View the unit in person, confirm what is included in the rent, read the lease, and never pay a deposit before you have both." },
    ],
    links: [
      { label: "All private rentals", to: "/private-rentals" },
      { label: "Private rentals in Pretoria West", to: "/private-rentals/pretoria-west" },
      { label: "Student accommodation in Pretoria West", to: "/student-accommodation/pretoria-west" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "Accommodation documents", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
      { label: "WIL placement support", to: "/opportunities/wil-placement-support" },
    ],
    cta: { label: "Browse bachelor units", to: "/find" },
    crumbs: [HOME, RENT, { name: "Bachelor rooms in Pretoria", path: "/private-rentals/bachelor-rooms-pretoria" }],
  },

  // ---------------- Applications ----------------
  {
    path: "/applications/application-readiness",
    kind: "landing",
    title: "ResKonnect Application Readiness for South African Students",
    description:
      "Get application-ready: certify your documents, check your APS, understand entry requirements and follow official portal steps for TVET, university and private colleges.",
    keywords: "application readiness, student application help, matric documents, APS",
    h1: "Application Readiness",
    intro: [
      "Most applications that fail do not fail on marks — they fail on missing documents, wrong document formats, late submissions or applying to the wrong programme. Application readiness is about fixing that before you submit.",
      "ResKonnect helps you get ready. You still apply on the institution's own official system.",
    ],
    audience: "Matriculants, gap-year students and anyone re-applying to a TVET college, university or private college.",
    benefits: [
      { title: "Document checklist", body: "Know exactly which documents you need and in what form before you start." },
      { title: "APS guidance", body: "Work out your APS so you apply for programmes you actually qualify for." },
      { title: "Official portal direction", body: "We point you to the institution's own application system, not a copy of it." },
      { title: "Deadline awareness", body: "Understand the sequence so you are not scrambling on closing day." },
    ],
    helps: [
      "Building your document checklist",
      "Estimating your APS before you choose programmes",
      "Understanding entry requirements in plain language",
      "Directing you to the correct official application portal",
    ],
    notDoing: [
      NOT_ADMISSIONS,
      "We do not submit applications for you, and we cannot influence admission decisions.",
      NOT_NSFAS,
    ],
    faqs: [
      { question: "Do you apply on my behalf?", answer: "No. ResKonnect prepares you and points you to the official portal. The application is submitted by you on the institution's system." },
      { question: "What documents do I usually need?", answer: "Typically a certified ID, your latest results or matric certificate, proof of residence and a passport photo. Requirements differ per institution." },
      { question: "How do I know if I qualify?", answer: "Check the programme's minimum requirements against your APS and subject-specific requirements." },
      { question: "When should I start?", answer: "As early as applications open. Late applications compete for fewer spaces." },
    ],
    links: [
      { label: "APS checker", to: "/applications/aps-checker" },
      { label: "TVET application readiness", to: "/applications/tvet-application-readiness" },
      { label: "University application readiness", to: "/applications/university-application-readiness" },
      { label: "TVET application checklist", to: "/guides/tvet-application-checklist" },
      { label: "University application checklist", to: "/guides/university-application-checklist" },
      { label: "Accommodation near campus", to: "/student-accommodation" },
    ],
    cta: { label: "Start with the APS checker", to: "/applications/aps-checker", secondaryLabel: "Applications hub", secondaryTo: "/applications" },
    crumbs: [HOME, APPS, { name: "Application readiness", path: "/applications/application-readiness" }],
  },
  {
    path: "/applications/tvet-application-readiness",
    kind: "landing",
    title: "ResKonnect TVET Application Readiness & Document Guidance",
    description:
      "Prepare your TVET college application: required documents, NC(V) and Report 191 basics, closing-date planning and official portal direction.",
    keywords: "TVET application, TVET college application requirements, NCV application, Report 191",
    h1: "TVET Application Readiness",
    intro: [
      "TVET college applications have their own rhythm: intakes open at different times to universities, and the documents colleges ask for are not identical. Getting this right early is the difference between a confirmed seat and a walk-in queue.",
      "This page covers what to prepare. The application itself is submitted on your college's official system.",
    ],
    audience: "School leavers and career changers applying to a TVET college for NC(V) or Report 191 programmes.",
    benefits: [
      { title: "Know the intake", body: "TVET intakes run on their own calendar — plan around the college's dates, not the university ones." },
      { title: "Right documents, first time", body: "Certified ID, latest results and proof of residence in the format the college accepts." },
      { title: "Programme fit", body: "Understand the difference between NC(V) and Report 191 before you choose." },
      { title: "Accommodation alongside", body: "Line up TVET-friendly accommodation while your application is in progress." },
    ],
    helps: [
      "Building your TVET document checklist",
      "Understanding NC(V) versus Report 191 pathways",
      "Planning around college closing dates",
      "Finding accommodation that accepts TVET students",
    ],
    notDoing: [
      NOT_ADMISSIONS,
      "We do not submit college applications or influence selection.",
      NOT_NSFAS,
    ],
    faqs: [
      { question: "What is the difference between NC(V) and Report 191?", answer: "NC(V) is a full-time vocational qualification usually taken after Grade 9, spanning levels 2 to 4. Report 191 (NATED) runs in trimesters or semesters and pairs theory with workplace experience." },
      { question: "Which documents do TVET colleges ask for?", answer: "Usually a certified copy of your ID, your most recent results, proof of residence and a passport photo. Confirm the exact list on your college's site." },
      { question: "Can ResKonnect apply for me?", answer: "No. We prepare you and direct you to the college's official application system." },
      { question: "Can I find accommodation before I am accepted?", answer: "Yes, and it is smart to start early. Most properties ask for proof of registration only at move-in." },
    ],
    links: [
      { label: "TVET application checklist", to: "/guides/tvet-application-checklist" },
      { label: "Application readiness hub", to: "/applications/application-readiness" },
      { label: "APS checker", to: "/applications/aps-checker" },
      { label: "TVET accommodation", to: "/student-accommodation/tvet" },
      { label: "Near Tshwane South TVET", to: "/student-accommodation/near-tshwane-south-tvet" },
      { label: "WIL placement support", to: "/opportunities/wil-placement-support" },
    ],
    cta: { label: "Open the applications hub", to: "/applications" },
    crumbs: [HOME, APPS, { name: "TVET readiness", path: "/applications/tvet-application-readiness" }],
  },
  {
    path: "/applications/university-application-readiness",
    kind: "landing",
    title: "ResKonnect University Application Readiness & APS Guidance",
    description:
      "Prepare your university application: APS calculation, subject requirements, certified documents, closing dates and official portal direction.",
    keywords: "university application, APS requirements, university entry requirements South Africa",
    h1: "University Application Readiness",
    intro: [
      "University applications are competitive and unforgiving about detail. Missing a subject requirement, uploading an uncertified document or submitting after the closing date all end the same way.",
      "Use this page to get ready, then apply on the university's own official portal.",
    ],
    audience: "Matriculants and re-applicants targeting a South African university or university of technology.",
    benefits: [
      { title: "APS first", body: "Work out your APS before you shortlist, so your choices are realistic." },
      { title: "Subject requirements", body: "Many programmes have specific subject and level requirements beyond the APS total." },
      { title: "Certified documents", body: "Know what must be certified and how recently." },
      { title: "Backup planning", body: "Have a second and third choice ready, including TVET pathways." },
    ],
    helps: [
      "Calculating and interpreting your APS",
      "Checking programme requirements against your subjects",
      "Preparing certified documents in the right format",
      "Finding accommodation near the campus you are applying to",
    ],
    notDoing: [
      NOT_ADMISSIONS,
      "We do not submit university applications or influence admission outcomes.",
      NOT_NSFAS,
    ],
    faqs: [
      { question: "How is APS calculated?", answer: "Most universities convert each subject percentage into a point score and add your best subjects, usually excluding Life Orientation or weighting it differently. Each university publishes its own method." },
      { question: "Do I need certified copies?", answer: "Most universities require certified copies of your ID and results. Certification is usually valid for three to six months." },
      { question: "Can I apply to more than one university?", answer: "Yes, and you should. Each application is submitted separately on that university's portal." },
      { question: "What if I do not meet the APS?", answer: "Consider extended or foundation programmes, a TVET pathway, or improving specific subjects. A backup plan is not a failure plan." },
    ],
    links: [
      { label: "University application checklist", to: "/guides/university-application-checklist" },
      { label: "APS checker", to: "/applications/aps-checker" },
      { label: "Application readiness hub", to: "/applications/application-readiness" },
      { label: "University accommodation", to: "/student-accommodation/university" },
      { label: "Accommodation near TUT", to: "/student-accommodation/near-tut" },
      { label: "TVET readiness", to: "/applications/tvet-application-readiness" },
    ],
    cta: { label: "Open the applications hub", to: "/applications" },
    crumbs: [HOME, APPS, { name: "University readiness", path: "/applications/university-application-readiness" }],
  },
  {
    path: "/applications/aps-checker",
    kind: "landing",
    title: "ResKonnect APS Checker & Admission Points Guidance",
    description:
      "Understand how your APS is calculated, what it means for your programme choices, and which documents you need before you apply.",
    keywords: "APS checker, admission point score, calculate APS, APS requirements",
    h1: "APS Checker & Admission Points Guidance",
    intro: [
      "Your Admission Point Score is the number most South African institutions use for a first-pass filter on applications. Knowing it before you choose programmes stops you from spending application fees on courses you cannot qualify for.",
      "This page explains how APS works and helps you check where you stand before you apply on an official portal.",
    ],
    audience: "Matriculants, and anyone re-applying who needs to know where their marks place them.",
    benefits: [
      { title: "Know your number", body: "Convert your subject percentages into a point score using the standard approach." },
      { title: "Apply realistically", body: "Match your score to programmes you have a genuine chance at." },
      { title: "Spot subject gaps", body: "Some programmes need specific subjects at a specific level, regardless of your total." },
      { title: "Plan a backup", body: "See TVET and alternative pathways if your score falls short." },
    ],
    helps: [
      "Explaining how APS is calculated",
      "Interpreting your score against typical programme requirements",
      "Highlighting subject-specific requirements to check",
      "Pointing you to the official portal for the institution you choose",
    ],
    notDoing: [
      "APS methods differ per institution — our guidance is indicative, and the institution's published method is the one that counts.",
      NOT_ADMISSIONS,
      NOT_NSFAS,
    ],
    body: [
      {
        heading: "How APS is normally calculated",
        paragraphs: [
          "Each subject percentage is converted into points on a scale (commonly 1 to 7, with some institutions awarding 8 for distinctions). Your best subjects are added together to produce your APS.",
          "Life Orientation is often excluded or capped, and some institutions weight designated subjects differently. Always check the published method for the university or college you are applying to.",
        ],
      },
      {
        heading: "APS is not the whole story",
        paragraphs: [
          "Many programmes carry subject-specific minimums — for example a required level in Mathematics or Physical Sciences — which apply even if your total APS is high.",
          "Selection also considers programme capacity, so meeting the minimum does not guarantee a place.",
        ],
      },
    ],
    faqs: [
      { question: "Is APS the same at every institution?", answer: "No. The scale and the treatment of Life Orientation differ. Use the institution's own published method for the final answer." },
      { question: "Does Life Orientation count?", answer: "Often it is excluded or capped at one point. Check the specific institution." },
      { question: "What is a good APS?", answer: "It depends entirely on the programme. Competitive programmes can require well above the general minimum." },
      { question: "Can I improve my APS?", answer: "Yes — through supplementary exams, rewriting subjects, or a bridging or foundation pathway." },
    ],
    links: [
      { label: "Application readiness hub", to: "/applications/application-readiness" },
      { label: "University application readiness", to: "/applications/university-application-readiness" },
      { label: "TVET application readiness", to: "/applications/tvet-application-readiness" },
      { label: "University application checklist", to: "/guides/university-application-checklist" },
      { label: "Applications hub", to: "/applications" },
      { label: "Student accommodation", to: "/student-accommodation" },
    ],
    cta: { label: "Use the applications checker", to: "/applications/checker", secondaryLabel: "Applications hub", secondaryTo: "/applications" },
    crumbs: [HOME, APPS, { name: "APS checker", path: "/applications/aps-checker" }],
  },

  // ---------------- Opportunities ----------------
  {
    path: "/opportunities/wil-placement-support",
    kind: "landing",
    title: "ResKonnect WIL Placement Support for South African Students",
    description:
      "Work Integrated Learning support: understand WIL requirements, prepare your CV and documents, and get help finding placement opportunities.",
    keywords: "WIL placement, work integrated learning, P1 P2 placement, internship support South Africa",
    h1: "WIL Placement Support",
    intro: [
      "Work Integrated Learning is a graduation requirement for many qualifications, and students routinely get stuck at this final step — the coursework is done, but the placement is not. ResKonnect supports students working through that stage.",
      "We help with readiness and connections. Placement decisions sit with the host organisation and your institution's WIL office.",
    ],
    audience: "Students who need P1/P2 or experiential training placement to complete their qualification, and recent graduates seeking work experience.",
    benefits: [
      { title: "Readiness first", body: "A clean CV, correct documents and a clear description of what your WIL requires." },
      { title: "Understand the requirement", body: "Know how many months you need and what your institution must sign off." },
      { title: "Submission support", body: "Submit your WIL request through ResKonnect so it is tracked, not lost in a chat." },
      { title: "Accommodation alongside", body: "If placement moves you to a new area, find accommodation on the same platform." },
    ],
    helps: [
      "Preparing your CV and WIL documents",
      "Explaining what your WIL requirement involves",
      "Logging a WIL placement support request",
      "Finding accommodation near a placement",
    ],
    notDoing: [
      "We do not guarantee placement, and we do not employ students.",
      "We do not sign off your WIL hours — that is your institution's WIL office.",
      NOT_ADMISSIONS,
    ],
    faqs: [
      { question: "What is WIL?", answer: "Work Integrated Learning is the workplace component of many South African qualifications, often called P1 and P2 or experiential training." },
      { question: "Can you guarantee me a placement?", answer: "No. We support your readiness and route your request to opportunities where they exist. The host organisation decides." },
      { question: "What do I need to submit?", answer: "Usually a CV, your academic record, your ID and a letter from your institution confirming the WIL requirement." },
      { question: "Do I get paid during WIL?", answer: "It depends entirely on the host organisation. Some placements offer a stipend, others do not." },
    ],
    links: [
      { label: "Opportunities hub", to: "/opportunities" },
      { label: "WIL support", to: "/opportunities/wil" },
      { label: "Bursaries", to: "/bursaries" },
      { label: "Private rentals", to: "/private-rentals" },
      { label: "Application readiness", to: "/applications/application-readiness" },
      { label: "Partner with ResKonnect", to: "/partners/institutions" },
    ],
    cta: { label: "Request WIL support", to: "/opportunities/wil", secondaryLabel: "Opportunities hub", secondaryTo: "/opportunities" },
    crumbs: [HOME, OPPS, { name: "WIL placement support", path: "/opportunities/wil-placement-support" }],
  },

  // ---------------- Guides ----------------
  {
    path: "/guides/how-to-find-safe-student-accommodation",
    kind: "guide",
    title: "ResKonnect How to Find Safe Student Accommodation in South Africa",
    description:
      "A practical guide to finding safe student accommodation: what to check on a viewing, warning signs, deposit safety and questions to ask the landlord.",
    keywords: "safe student accommodation, accommodation scams, what to check when viewing a room",
    h1: "How to Find Safe Student Accommodation",
    intro: [
      "Every year students lose deposits to adverts that were never real, or sign for rooms they have only seen in photographs. The pattern is predictable, which means it is avoidable.",
      "This guide covers what to verify before you pay anything, what to inspect on a viewing, and the questions worth asking before you sign.",
    ],
    audience: "Students and parents searching for accommodation, especially first-time renters.",
    benefits: [
      { title: "Verify before you pay", body: "Never transfer a deposit for a property you have not seen and a lease you have not read." },
      { title: "Inspect properly", body: "Security, water, electricity, damp, locks and lighting tell you more than the photographs." },
      { title: "Get it in writing", body: "Rent, inclusions, deposit terms and notice period all belong in the lease." },
      { title: "Use a traceable channel", body: "Enquiring through ResKonnect leaves a record instead of an anonymous chat." },
    ],
    helps: [
      "Knowing what to check before paying anything",
      "Spotting the common warning signs",
      "Understanding lease and deposit basics",
      "Searching verified listings instead of classifieds",
    ],
    notDoing: [
      "We cannot vet a property that is not listed with us, and we are not a party to your lease.",
      NO_GUARANTEE,
    ],
    body: [
      {
        heading: "Before you pay anything",
        paragraphs: [
          "View the property in person, or send someone you trust. Photographs are frequently reused from other listings.",
          "Confirm the person you are dealing with is the landlord or the appointed manager, and ask for a written lease before any money moves.",
          "Be cautious of pressure — 'three other students want it today' is the oldest lever there is.",
        ],
      },
      {
        heading: "What to check on the viewing",
        paragraphs: [
          "Security: perimeter, access control, lighting at night, and whether the door and windows lock properly.",
          "Services: does the water run, does the geyser work, is there prepaid electricity, and who pays for it.",
          "Condition: damp, mould, cracked windows and broken fittings. Photograph anything damaged on the day you move in.",
          "Surroundings: how you will get to campus, how far the nearest shop is, and how the street feels after dark.",
        ],
      },
      {
        heading: "Questions worth asking",
        paragraphs: [
          "What exactly is included in the monthly rent? What is the deposit and under what conditions is it refunded? What is the notice period? Who do I call when something breaks? Are visitors allowed?",
          "If the answers are vague or keep changing, treat that as information.",
        ],
      },
    ],
    faqs: [
      { question: "Should I pay a deposit before viewing?", answer: "No. Do not transfer money for a property you have not seen and a lease you have not read." },
      { question: "How do I know a listing is real?", answer: "Listings on ResKonnect are checked before publication. Off-platform adverts should be verified in person before any payment." },
      { question: "What if the residence keeps my deposit unfairly?", answer: "Your lease sets the terms. Document the condition of the room at move-in and move-out, and keep all written communication." },
      { question: "Is a written lease necessary?", answer: "Yes. A written lease protects both sides and is your only real record of what was agreed." },
    ],
    links: [
      { label: "Student accommodation hub", to: "/student-accommodation" },
      { label: "What documents do you need?", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
      { label: "Pretoria West guide", to: "/guides/student-accommodation-pretoria-west" },
      { label: "Private rentals", to: "/private-rentals" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "Search residences", to: "/find" },
    ],
    cta: { label: "Search verified listings", to: "/find" },
    crumbs: [HOME, GUIDES, { name: "Safe accommodation", path: "/guides/how-to-find-safe-student-accommodation" }],
  },
  {
    path: "/guides/student-accommodation-pretoria-west",
    kind: "guide",
    title: "ResKonnect Student Accommodation in Pretoria West: A Practical Guide",
    description:
      "What it is really like to live in Pretoria West as a student: areas, costs, transport, safety and how to secure a room before registration.",
    keywords: "Pretoria West student living, Pretoria West accommodation guide, TUT Pretoria West area",
    h1: "Student Accommodation in Pretoria West: A Practical Guide",
    intro: [
      "Pretoria West carries a large share of Tshwane's student accommodation, mostly because of TUT Pretoria West and the transport routes feeding it. It is busy, affordable relative to the eastern suburbs, and it moves fast around registration.",
      "This guide covers what to expect, what to budget for beyond rent, and how to secure a room without rushing into a bad lease.",
    ],
    audience: "Students moving to Pretoria West, and families helping with the decision.",
    benefits: [
      { title: "Know the area", body: "Understand how proximity to campus changes your daily cost and routine." },
      { title: "Budget realistically", body: "Rent is one line item — plan for electricity, data, transport and food." },
      { title: "Time it right", body: "Availability tightens sharply around registration." },
      { title: "Choose the right format", body: "Residence, shared house or bachelor unit each suit different students." },
    ],
    helps: [
      "Understanding the Pretoria West accommodation market",
      "Budgeting beyond the monthly rent",
      "Timing your search around registration",
      "Comparing verified Pretoria West listings",
    ],
    notDoing: [
      "We do not manage properties or leases in Pretoria West.",
      NO_GUARANTEE,
    ],
    body: [
      {
        heading: "What living in Pretoria West is like",
        paragraphs: [
          "It is a dense, working urban area with a large student population concentrated near campus. Shops, taxis and food are close by, and most students walk to class.",
          "Streets vary. A block can be quiet and well lit while the next one is not, so judge the specific property rather than the suburb as a whole.",
        ],
      },
      {
        heading: "What to budget for",
        paragraphs: [
          "Beyond rent, plan for prepaid electricity, water where it is not included, data, transport on the days you cannot walk, and groceries.",
          "A deposit is usually required upfront, often equal to one month's rent. Confirm the refund conditions before you pay.",
        ],
      },
      {
        heading: "Timing your search",
        paragraphs: [
          "The best stock is taken in the weeks before registration. If you can, view and secure a room before the rush starts.",
          "If you are searching late, widen slightly beyond walking distance rather than settling for a property you have doubts about.",
        ],
      },
    ],
    faqs: [
      { question: "Is Pretoria West affordable?", answer: "Relative to the eastern suburbs, generally yes — but prices vary widely by room type. Compare individual listings rather than area averages." },
      { question: "Can I walk to TUT Pretoria West?", answer: "Many properties are within walking distance. Check the address and stated distance on the specific listing." },
      { question: "What is the best time to look?", answer: "Before registration. Availability tightens quickly once the academic year starts." },
      { question: "Are there options for private-paying tenants?", answer: "Yes. Pretoria West has a substantial private rental market alongside student residences." },
    ],
    links: [
      { label: "Pretoria West accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "Near TUT Pretoria West", to: "/student-accommodation/near-tut-pretoria-west" },
      { label: "Private rentals in Pretoria West", to: "/private-rentals/pretoria-west" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "Accommodation documents", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
      { label: "Search residences", to: "/find" },
    ],
    cta: { label: "View Pretoria West listings", to: "/student-accommodation/pretoria-west" },
    crumbs: [HOME, GUIDES, { name: "Pretoria West guide", path: "/guides/student-accommodation-pretoria-west" }],
  },
  {
    path: "/guides/tvet-application-checklist",
    kind: "guide",
    title: "ResKonnect TVET College Application Checklist",
    description:
      "A step-by-step TVET college application checklist: documents, programme choice, intake timing and official portal steps.",
    keywords: "TVET application checklist, TVET college requirements, NCV documents",
    h1: "TVET College Application Checklist",
    intro: [
      "TVET applications are straightforward when you have the right documents ready and you apply within the intake window. They become stressful when you are chasing a certified copy on the closing day.",
      "Work through this checklist before you open the college's application portal.",
    ],
    audience: "Applicants to TVET colleges for NC(V) or Report 191 (NATED) programmes.",
    benefits: [
      { title: "Documents ready", body: "Everything certified and in the format the college accepts." },
      { title: "Programme chosen", body: "NC(V) or Report 191, with the right level for your schooling." },
      { title: "Intake understood", body: "TVET intakes do not follow the university calendar." },
      { title: "Portal step clear", body: "You apply on the college's own official system." },
    ],
    helps: [
      "Assembling your TVET document pack",
      "Choosing between NC(V) and Report 191",
      "Planning around the college intake",
      "Finding accommodation that accepts TVET students",
    ],
    notDoing: [NOT_ADMISSIONS, "We do not submit college applications.", NOT_NSFAS],
    body: [
      {
        heading: "Step 1 — Get your documents together",
        paragraphs: [
          "Certified copy of your ID (and your parent or guardian's ID if you are under 18), your most recent school results, proof of residence, and a recent passport photograph.",
          "Certification usually needs to be recent. Check the college's stated validity period before you certify.",
        ],
      },
      {
        heading: "Step 2 — Choose your programme",
        paragraphs: [
          "NC(V) runs at levels 2 to 4 and is usually entered after Grade 9. Report 191 (NATED) runs in trimesters or semesters and combines theory with workplace experience.",
          "Check the entry requirements for the specific programme, not just the college.",
        ],
      },
      {
        heading: "Step 3 — Apply on the official portal",
        paragraphs: [
          "Applications are submitted on the college's own system. Keep your reference number and any confirmation email.",
          "Follow up if you have heard nothing by the date the college indicated.",
        ],
      },
      {
        heading: "Step 4 — Sort accommodation",
        paragraphs: [
          "Start looking while your application is in progress. Most properties only ask for proof of registration at move-in.",
        ],
      },
    ],
    faqs: [
      { question: "When do TVET applications open?", answer: "Intake dates differ per college and per programme type. Check your college's published intake calendar." },
      { question: "Do I need matric for TVET?", answer: "Not always. NC(V) programmes are commonly entered after Grade 9, while some Report 191 programmes require Grade 12." },
      { question: "How many colleges can I apply to?", answer: "You can apply to more than one, each on its own portal. Track your reference numbers." },
      { question: "Does ResKonnect submit the application?", answer: "No. We prepare you and direct you to the official college system." },
    ],
    links: [
      { label: "TVET application readiness", to: "/applications/tvet-application-readiness" },
      { label: "TVET accommodation", to: "/student-accommodation/tvet" },
      { label: "Near Tshwane South TVET", to: "/student-accommodation/near-tshwane-south-tvet" },
      { label: "Application readiness hub", to: "/applications/application-readiness" },
      { label: "APS checker", to: "/applications/aps-checker" },
      { label: "University checklist", to: "/guides/university-application-checklist" },
    ],
    cta: { label: "Open the applications hub", to: "/applications" },
    crumbs: [HOME, GUIDES, { name: "TVET checklist", path: "/guides/tvet-application-checklist" }],
  },
  {
    path: "/guides/university-application-checklist",
    kind: "guide",
    title: "ResKonnect University Application Checklist",
    description:
      "A step-by-step university application checklist: APS, subject requirements, certified documents, deadlines and official portal steps.",
    keywords: "university application checklist, university documents, APS requirements South Africa",
    h1: "University Application Checklist",
    intro: [
      "University applications reward preparation and punish improvisation. Every year strong candidates are excluded for reasons that had nothing to do with their marks.",
      "Work through this checklist before you open the university's portal.",
    ],
    audience: "Matriculants and re-applicants applying to South African universities and universities of technology.",
    benefits: [
      { title: "APS calculated", body: "Know your score before you choose programmes." },
      { title: "Requirements checked", body: "Confirm subject-specific minimums, not just the APS total." },
      { title: "Documents certified", body: "Certified ID and results in the accepted format." },
      { title: "Deadlines mapped", body: "Different universities close on different dates." },
    ],
    helps: [
      "Working out your APS",
      "Checking programme requirements",
      "Preparing certified documents",
      "Planning realistic first, second and third choices",
    ],
    notDoing: [NOT_ADMISSIONS, "We do not submit university applications or influence outcomes.", NOT_NSFAS],
    body: [
      {
        heading: "Step 1 — Work out your APS",
        paragraphs: [
          "Convert your subject percentages to points using the university's published method, then total your best subjects.",
          "Do this before shortlisting so your choices are grounded.",
        ],
      },
      {
        heading: "Step 2 — Check requirements per programme",
        paragraphs: [
          "Look beyond the APS total: many programmes require a specific level in Mathematics, Physical Sciences or a language.",
          "Note whether the programme has additional selection steps such as a portfolio or an assessment.",
        ],
      },
      {
        heading: "Step 3 — Prepare your documents",
        paragraphs: [
          "Certified ID, latest results, proof of payment for the application fee where applicable, and a passport photograph.",
          "Scan everything clearly. Rejected uploads cost you days you may not have.",
        ],
      },
      {
        heading: "Step 4 — Apply and track",
        paragraphs: [
          "Apply on each university's own portal, save your reference numbers, and check your status regularly.",
          "Have a backup pathway ready, including TVET options.",
        ],
      },
    ],
    faqs: [
      { question: "How many universities should I apply to?", answer: "At least two or three, spread across different levels of competitiveness." },
      { question: "When do applications close?", answer: "Dates differ per university and per programme. Check each one directly and diarise the earliest." },
      { question: "Do I need certified copies?", answer: "Most universities require certified ID and results. Certification is usually accepted for three to six months." },
      { question: "What if I miss the deadline?", answer: "Look at late application windows where offered, and consider a TVET or bridging pathway for the year." },
    ],
    links: [
      { label: "University application readiness", to: "/applications/university-application-readiness" },
      { label: "APS checker", to: "/applications/aps-checker" },
      { label: "Application readiness hub", to: "/applications/application-readiness" },
      { label: "University accommodation", to: "/student-accommodation/university" },
      { label: "TVET checklist", to: "/guides/tvet-application-checklist" },
      { label: "Accommodation near TUT", to: "/student-accommodation/near-tut" },
    ],
    cta: { label: "Open the applications hub", to: "/applications" },
    crumbs: [HOME, GUIDES, { name: "University checklist", path: "/guides/university-application-checklist" }],
  },
  {
    path: "/guides/what-documents-do-you-need-for-student-accommodation",
    kind: "guide",
    title: "ResKonnect What Documents Do You Need for Student Accommodation?",
    description:
      "The documents residences and landlords normally ask for: ID, proof of registration, proof of funding, guarantor details and lease paperwork.",
    keywords: "student accommodation documents, residence application documents, proof of registration",
    h1: "What Documents Do You Need for Student Accommodation?",
    intro: [
      "Rooms are usually lost to slow paperwork rather than to price. Having your documents ready means you can confirm a room the same day you view it.",
      "This is the pack most residences and landlords in South Africa ask for.",
    ],
    audience: "Students and parents preparing to secure a room, at a residence or a private rental.",
    benefits: [
      { title: "Move fast", body: "A complete pack lets you secure a room before someone else does." },
      { title: "Fewer surprises", body: "Know which extras funded students and private tenants each need." },
      { title: "Cleaner handover", body: "Correct paperwork means a smoother move-in and a cleaner deposit refund later." },
      { title: "One place to store it", body: "Keep certified scans on your phone and in your email so you always have them." },
    ],
    helps: [
      "Listing the documents residences typically request",
      "Explaining what funded and private-paying students each need",
      "Preparing before you view a property",
      "Finding listings once your pack is ready",
    ],
    notDoing: [
      "Requirements differ per property — the residence's own list is the one that counts.",
      NOT_NSFAS,
    ],
    body: [
      {
        heading: "The standard pack",
        paragraphs: [
          "A certified copy of your ID or passport. Proof of registration or an acceptance letter from your institution. Proof of residence. A recent passport photograph. Your contact details and a next-of-kin contact.",
        ],
      },
      {
        heading: "If your accommodation is funded",
        paragraphs: [
          "Accredited residences generally ask for confirmation of your funding status from your institution or funder, in addition to the standard pack.",
          "ResKonnect does not provide NSFAS application services — confirm funding directly with NSFAS and your institution.",
        ],
      },
      {
        heading: "If you are paying privately",
        paragraphs: [
          "Landlords commonly ask for proof of income, or a guarantor with proof of income, plus a deposit.",
          "Read the lease before you sign, and photograph the condition of the room on the day you move in.",
        ],
      },
    ],
    faqs: [
      { question: "Do I need proof of registration before I can book?", answer: "Many properties let you enquire and reserve first, then require proof of registration at move-in. Confirm with the specific residence." },
      { question: "How recent must certification be?", answer: "Most properties and institutions accept certification from the last three to six months." },
      { question: "What is a guarantor?", answer: "Someone — usually a parent or guardian — who takes responsibility for the rent if you cannot pay. Private landlords often require one." },
      { question: "Can I email documents?", answer: "Yes, most properties accept clear scans. Only send documents to a verified contact for the property." },
    ],
    links: [
      { label: "Student accommodation hub", to: "/student-accommodation" },
      { label: "Find safe accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "NSFAS accredited accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "Private rentals", to: "/private-rentals" },
      { label: "Application readiness", to: "/applications/application-readiness" },
      { label: "Search residences", to: "/find" },
    ],
    cta: { label: "Search residences", to: "/find" },
    crumbs: [HOME, GUIDES, { name: "Accommodation documents", path: "/guides/what-documents-do-you-need-for-student-accommodation" }],
  },
];

export const SEO_LANDING_BY_PATH: Record<string, SeoLandingContent> = Object.fromEntries(
  SEO_LANDING_PAGES.map((p) => [p.path, p]),
);

export const SEO_LANDING_PATHS = SEO_LANDING_PAGES.map((p) => p.path);
