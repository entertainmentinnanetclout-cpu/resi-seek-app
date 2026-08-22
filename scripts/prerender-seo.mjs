import fs from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const SITE = "https://www.reskonnect.org";

const pages = [
  ["/", "ResKonnect | Student Accommodation, Applications & Opportunities", "Find student accommodation, prepare applications, discover WIL and student opportunities, and explore student-housing property intelligence with ResKonnect.", "Living, AI and Opportunity in one student platform"],
  ["/living", "ResKonnect Living | Student Accommodation & Private Rentals", "Browse student accommodation, private residences, NSFAS-related accommodation information and private rental support through ResKonnect.", "ResKonnect Living"],
  ["/student-accommodation", "Student Accommodation South Africa | ResKonnect", "Find student accommodation by university, TVET college, campus, suburb, budget, room type and availability with ResKonnect.", "Find Student Accommodation in South Africa"],
  ["/student-accommodation/pretoria", "Student Accommodation Pretoria | TUT, UP, UNISA & SMU | ResKonnect", "Explore student accommodation across Pretoria, including areas serving TUT, UP, UNISA and SMU, with campus and location context from ResKonnect.", "Student Accommodation in Pretoria"],
  ["/student-accommodation/pretoria-west", "Student Accommodation Pretoria West | ResKonnect", "Find student accommodation in Pretoria West near TUT with ResKonnect.", "Student Accommodation in Pretoria West"],
  ["/student-accommodation/near-tut", "Student Accommodation Near TUT | ResKonnect", "Find student accommodation near Tshwane University of Technology campuses through ResKonnect.", "Student Accommodation Near TUT"],
  ["/student-accommodation/nsfas-accredited", "NSFAS Accommodation | ResKonnect", "Explore student accommodation that accepts NSFAS-funded students and verify current accreditation information before applying.", "NSFAS Student Accommodation"],
  ["/applications", "Student Applications, APS & Course Match | ResKonnect", "Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application-route support.", "Applications, APS and Course Match"],
  ["/applications/university", "University Applications South Africa | ResKonnect", "Prepare university applications with qualification guidance, APS readiness, documents and official application portal direction.", "University Applications"],
  ["/applications/tvet", "TVET College Applications South Africa | ResKonnect", "Prepare TVET college applications with course guidance, document readiness and official application links.", "TVET College Applications"],
  ["/applications/aps-checker", "APS Checker South Africa | ResKonnect", "Check application readiness and understand APS requirements for South African higher-education applications.", "APS Checker & Application Readiness"],
  ["/opportunities", "Student WIL, Internships & Opportunities | ResKonnect", "Discover WIL placements, internships, SETA-linked programmes, bursaries and graduate opportunities through ResKonnect.", "Student Opportunities"],
  ["/opportunities/wil", "WIL Placement Support South Africa | ResKonnect", "Access Work Integrated Learning placement support, readiness guidance and employer-linked opportunities.", "WIL Placement Support"],
  ["/opportunities/internships", "Student Internships & Graduate Opportunities | ResKonnect", "Find published student internships, graduate opportunities and workplace-experience programmes with closing-date and application-route context.", "Student Internships & Graduate Opportunities"],
  ["/opportunities/seta", "SETA WIL & Internship Opportunities | ResKonnect", "Discover published SETA-linked WIL, internship and workplace-experience opportunities for students and graduates.", "SETA & Workplace Experience Opportunities"],
  ["/properties", "Student Housing Property Intelligence | ResKonnect", "Explore student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence on ResKonnect.", "Student Housing Property Intelligence"],
  ["/property-auctions", "Student Accommodation Property Auctions | ResKonnect", "Track third-party property auctions and distressed opportunities relevant to student housing, with source and verification context from ResKonnect.", "Student Accommodation Property Auctions"],
  ["/student-accommodation-for-sale", "Student Accommodation for Sale | ResKonnect", "Explore student residences, houses, flats and buildings marketed for sale where there is a credible student-housing investment case.", "Student Accommodation for Sale"],
  ["/development-opportunities", "Student Housing Development Opportunities | ResKonnect", "Explore buildings, houses and development sites with potential for lawful student-housing conversion, subject to independent planning and compliance checks.", "Student Housing Development Opportunities"],
  ["/ai", "ResKonnect AI | Student, Application & Property Intelligence", "Use source-aware ResKonnect AI for student guidance, Course Match, application readiness and student-housing property intelligence.", "AI Built Around the Student Journey"],
  ["/partners", "ResKonnect Partners | Landlords, Institutions & Businesses", "Partner with ResKonnect across student accommodation, applications, opportunities and digital student-journey services.", "Partner With ResKonnect"],
  ["/partners/landlords", "List Student Accommodation | ResKonnect for Landlords", "List and manage student accommodation, improve occupancy and connect with student demand through ResKonnect.", "For Student Accommodation Providers"],
  ["/bursaries", "Student Bursaries & Funding Opportunities | ResKonnect", "Browse open bursaries and student funding opportunities with closing dates, requirements and official application links.", "Bursaries & Student Funding"],
  ["/campus-news", "ResKonnect Campus News | Student Updates & Notices", "Read student-focused campus news, registration updates, accommodation notices and institution announcements.", "Campus News & Student Updates"],
];

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const canonical = (route) => `${SITE}${route === "/" ? "" : route}`;
const fileName = (route) => route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

const replaceOrInsert = (html, regex, tag) => regex.test(html)
  ? html.replace(regex, tag)
  : html.replace("</head>", `  ${tag}\n  </head>`);

const base = await fs.readFile(path.join(DIST, "index.html"), "utf8");
await fs.mkdir(path.join(DIST, "_seo"), { recursive: true });

for (const [route, title, description, h1] of pages) {
  const url = canonical(route);
  let html = base.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = replaceOrInsert(html, /<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${esc(description)}" />`);
  html = replaceOrInsert(html, /<link rel="canonical" href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${esc(url)}" />`);
  html = replaceOrInsert(html, /<meta property="og:url" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${esc(url)}" />`);
  html = replaceOrInsert(html, /<meta property="og:title" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${esc(title)}" />`);
  html = replaceOrInsert(html, /<meta property="og:description" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${esc(description)}" />`);
  html = replaceOrInsert(html, /<meta name="twitter:title" content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = replaceOrInsert(html, /<meta name="twitter:description" content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = replaceOrInsert(html, /<meta name="robots" content="[^"]*"\s*\/?\s*>/i, '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />');

  const initial = `<div id="root"><main data-seo-prerender="true" style="max-width:1120px;margin:0 auto;padding:48px 24px;font-family:Inter,Arial,sans-serif;color:#111827"><header><p style="font-weight:700;letter-spacing:.04em">ResKonnect — Living • AI • Opportunity</p><h1 style="font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;margin:16px 0">${esc(h1)}</h1><p style="max-width:760px;font-size:1.125rem;line-height:1.7;color:#4b5563">${esc(description)}</p></header><nav aria-label="Primary search topics" style="margin-top:28px;display:flex;gap:16px;flex-wrap:wrap"><a href="/student-accommodation">Student Accommodation</a><a href="/applications">Applications</a><a href="/opportunities">WIL & Opportunities</a><a href="/properties">Student Housing Property</a><a href="/ai">ResKonnect AI</a></nav></main></div>`;
  html = html.replace('<div id="root"></div>', initial);

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: h1,
    description,
    url,
    inLanguage: "en-ZA",
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
  };
  html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>\n</head>`);
  await fs.writeFile(path.join(DIST, "_seo", `${fileName(route)}.html`), html);
}

console.log(`Prerendered ${pages.length} strategic ResKonnect search pages.`);
