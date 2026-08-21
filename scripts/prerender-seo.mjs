import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const SITE = 'https://www.reskonnect.org';

const pages = [
  ['/', 'ResKonnect | Student Accommodation, Applications, AI & Opportunities', 'Find student accommodation, prepare university and TVET applications, access WIL and career opportunities, and explore student-housing property intelligence with ResKonnect.', 'Connecting Residents. Advancing Futures.'],
  ['/student-accommodation', 'Student Accommodation South Africa | ResKonnect', 'Find student accommodation, private rentals and NSFAS accommodation options near universities and TVET campuses across South Africa.', 'Find Student Accommodation in South Africa'],
  ['/student-accommodation/pretoria', 'Student Accommodation Pretoria | ResKonnect', 'Find student accommodation across Pretoria, including residences and private student housing connected to major universities, TVET colleges and campus areas.', 'Student Accommodation in Pretoria'],
  ['/student-accommodation/pretoria-west', 'Student Accommodation Pretoria West | ResKonnect', 'Find student accommodation in Pretoria West near TUT with ResKonnect.', 'Student Accommodation in Pretoria West'],
  ['/student-accommodation/near-tut', 'Student Accommodation Near TUT | ResKonnect', 'Find student accommodation near Tshwane University of Technology campuses through ResKonnect.', 'Student Accommodation Near TUT'],
  ['/student-accommodation/nsfas-accredited', 'NSFAS Accommodation | ResKonnect', 'Explore student accommodation that accepts NSFAS-funded students and verify current accreditation information before applying.', 'NSFAS Student Accommodation'],
  ['/living', 'ResKonnect Living | Student Accommodation & Private Rentals', 'Find student accommodation, private rentals, rooms and housing support near universities and TVET campuses.', 'ResKonnect Living'],
  ['/applications', 'University & TVET Applications South Africa | ResKonnect', 'Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application direction.', 'Applications & Course Readiness'],
  ['/applications/university', 'University Applications South Africa | ResKonnect', 'Prepare university applications with qualification guidance, APS readiness, documents and official application portal direction.', 'University Applications'],
  ['/applications/tvet', 'TVET College Applications South Africa | ResKonnect', 'Prepare TVET college applications with course guidance, document readiness and official application links.', 'TVET College Applications'],
  ['/applications/aps-checker', 'APS Checker South Africa | ResKonnect', 'Check application readiness and understand APS requirements for South African higher-education applications.', 'APS Checker & Application Readiness'],
  ['/opportunities', 'WIL, Internships & Student Opportunities South Africa | ResKonnect', 'Discover WIL placements, internships, SETA programmes, graduate opportunities and student career pathways.', 'Student Opportunities'],
  ['/opportunities/wil', 'WIL Placement Support South Africa | ResKonnect', 'Access Work Integrated Learning placement support, readiness guidance and employer-linked opportunities.', 'WIL Placement Support'],
  ['/opportunities/internships', 'Student Internships South Africa | ResKonnect Opportunities', 'Discover internship, graduate and workplace-experience opportunities for South African students and graduates.', 'Student Internships & Graduate Opportunities'],
  ['/opportunities/seta', 'SETA Opportunities for Students & Graduates | ResKonnect', 'Find SETA-linked WIL, internship, workplace-experience and graduate opportunities.', 'SETA & Workplace Experience Opportunities'],
  ['/properties', 'Student Housing Property & Investment Opportunities | ResKonnect', 'Discover student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence.', 'Student Housing Property Opportunities'],
  ['/property-auctions', 'Student Accommodation Property Auctions South Africa | ResKonnect', 'Track third-party student housing auctions, sale-in-execution opportunities and properties suitable for student accommodation.', 'Student Accommodation Property Auctions'],
  ['/student-accommodation-for-sale', 'Student Accommodation for Sale South Africa | ResKonnect', 'Explore student residences, houses, flats and buildings for sale with student-housing investment potential.', 'Student Accommodation for Sale'],
  ['/development-opportunities', 'Student Housing Development Opportunities | ResKonnect', 'Find houses, buildings and land with student-accommodation conversion or development potential and due-diligence indicators.', 'Student Housing Development Opportunities'],
  ['/ai', 'ResKonnect AI | Student, Course & Property Intelligence', 'Explore ResKonnect AI for student guidance, course matching, application readiness, opportunity discovery and property intelligence.', 'AI Built Around the Student Journey'],
  ['/partners', 'ResKonnect Partners | Landlords, Institutions & Businesses', 'Partner with ResKonnect across student living, applications, opportunity access and property services.', 'Partner With ResKonnect'],
  ['/partners/landlords', 'List Student Accommodation | ResKonnect for Landlords', 'List and manage student accommodation, improve occupancy and connect with student demand through ResKonnect.', 'For Student Accommodation Providers'],
  ['/bursaries', 'Bursaries & Student Funding South Africa | ResKonnect', 'Browse bursaries and student funding opportunities with requirements, closing dates and official application direction.', 'Bursaries & Student Funding'],
  ['/campus-news', 'Campus News & Student Updates | ResKonnect', 'Read student-focused campus news, registration updates, accommodation notices and institution announcements.', 'Campus News & Student Updates'],
];

const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canonical = (route) => `${SITE}${route === '/' ? '' : route}`;
const fileName = (route) => route === '/' ? 'home' : route.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');

const base = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');
await fs.mkdir(path.join(DIST, '_seo'), { recursive: true });

for (const [route, title, description, h1] of pages) {
  const url = canonical(route);
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${esc(url)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?\s*>/i, `<meta name="twitter:description" content="${esc(description)}" />`)
    .replace('<div id="root"></div>', `<div id="root"><main data-seo-prerender="true"><header><p>ResKonnect — Living • AI • Opportunity</p><h1>${esc(h1)}</h1><p>${esc(description)}</p></header><nav aria-label="Primary search topics"><a href="/student-accommodation">Student Accommodation</a> · <a href="/applications">Applications</a> · <a href="/opportunities">WIL & Opportunities</a> · <a href="/properties">Student Housing Property</a> · <a href="/ai">ResKonnect AI</a></nav></main></div>`);

  const schema = { '@context':'https://schema.org', '@type':'WebPage', name:h1, description, url, isPartOf:{ '@type':'WebSite', name:'ResKonnect', url:SITE } };
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>\n</head>`);
  await fs.writeFile(path.join(DIST, '_seo', `${fileName(route)}.html`), html);
}

console.log(`Prerendered ${pages.length} strategic ResKonnect search pages.`);
