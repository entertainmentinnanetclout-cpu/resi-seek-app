import fs from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const SITE = "https://www.reskonnect.org";

const pages = [
  [
    "/",
    "Student Accommodation, Applications & WIL | ResKonnect",
    "Search student housing in Pretoria, Soshanguve, Ga-Rankuwa, Mbombela and Polokwane. Explore rooms, NSFAS funding checks, applications, bursaries and WIL on ResKonnect.",
    "Building Africa's First AI/SI-Powered Student Platform",
  ],
  [
    "/living",
    "ResKonnect Living | Student Accommodation & Private Rentals",
    "Browse student accommodation, private residences, NSFAS-related accommodation information and private rental support through ResKonnect.",
    "ResKonnect Living",
  ],
  [
    "/student-accommodation",
    "Student Accommodation South Africa | ResKonnect",
    "Find student accommodation by university, TVET college, campus, suburb, budget, room type and availability with ResKonnect.",
    "Find Student Accommodation in South Africa",
  ],
  [
    "/student-accommodation/pretoria",
    "Student Accommodation Pretoria | TUT, UP, UNISA & SMU | ResKonnect",
    "Explore student accommodation across Pretoria, including areas serving TUT, UP, UNISA and SMU, with campus and location context from ResKonnect.",
    "Student Accommodation in Pretoria",
  ],
  [
    "/student-accommodation/pretoria-west",
    "Student Accommodation Pretoria West | ResKonnect",
    "Find student accommodation in Pretoria West near TUT with ResKonnect.",
    "Student Accommodation in Pretoria West",
  ],
  [
    "/student-accommodation/near-tut",
    "Student Accommodation Near TUT | ResKonnect",
    "Find student accommodation near Tshwane University of Technology campuses through ResKonnect.",
    "Student Accommodation Near TUT",
  ],
  [
    "/student-accommodation/nsfas-accredited",
    "NSFAS Accommodation | ResKonnect",
    "Explore student accommodation that accepts NSFAS-funded students and verify current accreditation information before applying.",
    "NSFAS Student Accommodation",
  ],
  [
    "/applications",
    "Student Applications, APS & Course Match | ResKonnect",
    "Prepare university, TVET and private-college applications with APS guidance, Course Match, document readiness and official application-route support.",
    "Applications, APS and Course Match",
  ],
  [
    "/applications/university",
    "University Applications South Africa | ResKonnect",
    "Prepare university applications with qualification guidance, APS readiness, documents and official application portal direction.",
    "University Applications",
  ],
  [
    "/applications/tvet",
    "TVET College Applications South Africa | ResKonnect",
    "Prepare TVET college applications with course guidance, document readiness and official application links.",
    "TVET College Applications",
  ],
  [
    "/applications/aps-checker",
    "APS Checker South Africa | ResKonnect",
    "Check application readiness and understand APS requirements for South African higher-education applications.",
    "APS Checker & Application Readiness",
  ],
  [
    "/opportunities",
    "Student Opportunities, Bursaries & WIL | ResKonnect Opportunity",
    "Explore verified current bursaries, graduate programmes, WIL and student opportunities through the ResKonnect Opportunity Engine, with signed-in relevance guidance and official application routes.",
    "Verified Opportunities. Better Next Steps.",
  ],
  [
    "/opportunities/wil",
    "WIL Placement Support South Africa | ResKonnect",
    "Access Work Integrated Learning placement support, readiness guidance and employer-linked opportunities.",
    "WIL Placement Support",
  ],
  [
    "/opportunities/internships",
    "Student Internships & Graduate Opportunities | ResKonnect",
    "Find published student internships, graduate opportunities and workplace-experience programmes with closing-date and application-route context.",
    "Student Internships & Graduate Opportunities",
  ],
  [
    "/opportunities/seta",
    "SETA WIL & Internship Opportunities | ResKonnect",
    "Discover published SETA-linked WIL, internship and workplace-experience opportunities for students and graduates.",
    "SETA & Workplace Experience Opportunities",
  ],
  [
    "/properties",
    "Student Housing Property Intelligence | ResKonnect",
    "Explore student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence on ResKonnect.",
    "Student Housing Property Intelligence",
  ],
  [
    "/property-auctions",
    "Student Accommodation Property Auctions | ResKonnect",
    "Track third-party property auctions and distressed opportunities relevant to student housing, with source and verification context from ResKonnect.",
    "Student Accommodation Property Auctions",
  ],
  [
    "/student-accommodation-for-sale",
    "Student Accommodation for Sale | ResKonnect",
    "Explore student residences, houses, flats and buildings marketed for sale where there is a credible student-housing investment case.",
    "Student Accommodation for Sale",
  ],
  [
    "/development-opportunities",
    "Student Housing Development Opportunities | ResKonnect",
    "Explore buildings, houses and development sites with potential for lawful student-housing conversion, subject to independent planning and compliance checks.",
    "Student Housing Development Opportunities",
  ],
  [
    "/ai",
    "ResKonnect AI | Grounded Student Guidance & Service Intelligence",
    "Use ResKonnect AI across Living, applications and opportunities with verified platform context and account-aware next-step guidance when signed in.",
    "ResKonnect AI: Grounded Guidance Across Your Student Journey",
  ],
  [
    "/partners",
    "ResKonnect Partners | Landlords, Institutions & Businesses",
    "Partner with ResKonnect across student accommodation, applications, opportunities and digital student-journey services.",
    "Partner With ResKonnect",
  ],
  [
    "/partners/landlords",
    "Student Accommodation Provider Services | ResKonnect",
    "Recruit students, manage applications and access compliance-readiness support through the ResKonnect landlord operating system.",
    "Student Accommodation Provider Services",
  ],
  [
    "/accreditation-readiness",
    "NSFAS Accommodation Accreditation Readiness | ResKonnect",
    "Prepare student accommodation for the NSFAS/DHET accreditation process with document-readiness review, property pre-inspection, remediation tracking and renewal control.",
    "Student Accommodation Accreditation Readiness",
  ],
  [
    "/bursaries",
    "Student Bursaries & Funding Opportunities | ResKonnect",
    "Browse open bursaries and student funding opportunities with closing dates, requirements and official application links.",
    "Bursaries & Student Funding",
  ],
  [
    "/campus-news",
    "ResKonnect Campus News | Student Updates & Notices",
    "Read student-focused campus news, registration updates, accommodation notices and institution announcements.",
    "Campus News & Student Updates",
  ],
];

// Curated, evidence-led city and topic content shared with the React routes.
// Do not invent city stock, monthly rents, official NSFAS decisions or room availability.
const discoveryPages = JSON.parse(await fs.readFile(path.resolve("src/data/seo/discoveryPages.json"), "utf8"));
const discoveryByPath = new Map(discoveryPages.map((entry) => [entry.path, entry]));
for (const entry of discoveryPages) pages.push([entry.path, entry.title, entry.description, entry.h1]);

const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const canonical = (route) => `${SITE}${route === "/" ? "" : route}`;
const fileName = (route) =>
  route === "/"
    ? "home"
    : route
        .replace(/^\//, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");

const replaceOrInsert = (html, regex, tag) =>
  regex.test(html)
    ? html.replace(regex, tag)
    : html.replace("</head>", `  ${tag}\n  </head>`);

const base = await fs.readFile(path.join(DIST, "index.html"), "utf8");
await fs.mkdir(path.join(DIST, "_seo"), { recursive: true });

for (const [route, title, description, h1] of pages) {
  const url = canonical(route);
  let html = base.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${esc(title)}</title>`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="description" content="[^"]*"\s*\/?\s*>/i,
    `<meta name="description" content="${esc(description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/?\s*>/i,
    `<link rel="canonical" href="${esc(url)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/?\s*>/i,
    `<meta property="og:url" content="${esc(url)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/?\s*>/i,
    `<meta property="og:title" content="${esc(title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/?\s*>/i,
    `<meta property="og:description" content="${esc(description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/?\s*>/i,
    `<meta name="twitter:title" content="${esc(title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/?\s*>/i,
    `<meta name="twitter:description" content="${esc(description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="robots" content="[^"]*"\s*\/?\s*>/i,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
  );

  const discovery = discoveryByPath.get(route);
  const discoverHtml = discovery ? [
    '<div style="margin-top:28px;max-width:980px;font-size:1rem;line-height:1.75">',
    ...discovery.intro.map((text)=>'<p style="margin-top:12px">'+esc(text)+'</p>'),
    '<section style="margin-top:24px"><h2>What you can compare</h2><ul>',
    ...discovery.benefits.map((item)=>'<li style="margin-top:8px"><strong>'+esc(item.title)+'</strong> — '+esc(item.body)+'</li>'),
    '</ul></section>',
    ...discovery.body.flatMap((block)=>['<section style="margin-top:24px"><h2>'+esc(block.heading)+'</h2>',...block.paragraphs.map(t=>'<p>'+esc(t)+'</p>'),'</section>']),
    '<section style="margin-top:24px"><h2>Practical questions</h2>',
    ...discovery.faqs.flatMap((f)=>['<h3>'+esc(f.question)+'</h3><p>'+esc(f.answer)+'</p>']),
    '</section><section style="margin-top:24px"><h2>Continue searching</h2>',
    '<p><a href="'+esc(discovery.cta.to)+'">'+esc(discovery.cta.label)+'</a></p><ul>',
    ...discovery.links.map((link)=>'<li><a href="'+esc(link.to)+'">'+esc(link.label)+'</a></li>'),
    '</ul></section>',
    '</div>'
  ].join("") : "";
  const homeCityHtml = route === "/" ? '<section aria-label="Explore student accommodation and opportunities" style="margin-top:30px;padding:26px;border:1px solid #dbe5f2;border-radius:14px"><h2>Student accommodation by city</h2><p>ResKonnect has published residence records in Pretoria, Soshanguve, Ga-Rankuwa, Mbombela and Polokwane. Rent, room type and official funding eligibility should be checked on the individual property rather than inferred from the city name.</p><ul>'+
    ["pretoria","soshanguve","ga-rankuwa","mbombela","polokwane"].map(c=>'<li><a href="/student-accommodation/'+c+'">'+(c==="ga-rankuwa"?"Ga-Rankuwa":c[0].toUpperCase()+c.slice(1))+' student accommodation</a></li>').join("")+
    '</ul><h2>What do you need?</h2><ul><li><a href="/student-accommodation/single-rooms">Single student rooms</a></li><li><a href="/student-accommodation/nsfas-no-top-up">NSFAS no-top-up checklist</a></li><li><a href="/student-accommodation/r1500-to-budget">R1,500 rent budget guide</a></li><li><a href="/student-accommodation/private-paying">Private-paying accommodation</a></li><li><a href="/student-accommodation/room-types">Student housing types</a></li><li><a href="/applications">University and TVET applications</a></li><li><a href="/opportunities/wil">WIL placements</a></li><li><a href="/bursaries">Bursaries</a></li><li><a href="/properties">Student housing property intelligence</a></li></ul><p>Our vision is to build Africa’s first AI/SI-powered student journey platform. AI means Artificial Intelligence and SI means Service Intelligence. This is a vision, not a verified market-first award or ranking.</p></section>' : "";
  const googlePublicInfo = route === "/" ? '<section aria-label="About ResKonnect and Google Gmail" style="margin-top:32px;padding:24px;background:#f3f7fd;border-radius:14px;line-height:1.7"><h2>What ResKonnect does</h2><p>ResKonnect is a South African student living, applications and opportunity platform. Students can explore accommodation, understand application requirements and use guidance services. Authorised residence owners, managers and administrators manage accommodation enquiries, application decisions, reservation steps and resident communications in their own role-protected portal.</p><h2>Why ResKonnect requests Gmail permission</h2><p>Gmail connection is optional and only for authorised residence teams or ResKonnect staff. After a user connects their own Google account, the Gmail send-only permission (gmail.send) enables that user to send reviewed case notices, missing-document requests, booking confirmations and move-in instructions from the connected mailbox. ResKonnect does not request permission to read, search, edit or delete Gmail messages. Users can disconnect Gmail at any time.</p><p><a href="/partners/landlords">Residence team services</a> · <a href="/residence/login">Landlord sign-in</a> · <a href="/privacy">Privacy Policy and Google user data</a> · <a href="/terms">Terms of Service</a> · <a href="mailto:reskonnect@gmail.com">Contact ResKonnect</a></p></section>' : "";
  const initial = `<div id="root"><main data-seo-prerender="true" style="max-width:1120px;margin:0 auto;padding:48px 24px;font-family:Inter,Arial,sans-serif;color:#111827"><header><p style="font-weight:700;letter-spacing:.04em">ResKonnect — Living • AI • Opportunity</p><h1 style="font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;margin:16px 0">${esc(h1)}</h1><p style="max-width:760px;font-size:1.125rem;line-height:1.7;color:#4b5563">${esc(description)}</p></header><nav aria-label="Primary search topics" style="margin-top:28px;display:flex;gap:16px;flex-wrap:wrap"><a href="/living">Living</a><a href="/ai">ResKonnect AI</a><a href="/opportunities">Opportunity</a><a href="/apply">Applications & Course Match</a><a href="/partners">Partners</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></nav>${homeCityHtml}${discoverHtml}${googlePublicInfo}</main></div>`;
  html = html.replace('<div id="root"></div>', initial);

  const schema = {
    "@context": "https://schema.org",
    "@type": discovery ? (discovery.kind === "guide" ? "Article" : "CollectionPage") : "WebPage",
    name: h1,
    description,
    url,
    inLanguage: "en-ZA",
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
    ...(discovery ? { about: [{ "@type": "Thing", name: "Student accommodation" }, { "@type": "Place", name: discovery.crumbs?.at(-1)?.name || "South Africa" }] } : {}),
  };
  if (discovery) {
    schema.breadcrumb = { "@type": "BreadcrumbList", itemListElement: discovery.crumbs.map((crumb, index) => ({
      "@type": "ListItem", position: index + 1, name: crumb.name,
      item: canonical(crumb.path),
    })) };
  }
  html = html.replace(
    "</head>",
    `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>\n</head>`,
  );
  await fs.writeFile(path.join(DIST, "_seo", `${fileName(route)}.html`), html);
}


const googleOAuthPolicySections = [
  {
    "heading": "1. Scope and organisation",
    "paragraphs": [
      "ResKonnect is a South African student accommodation, application and opportunity platform. This privacy policy applies to the publicly accessible ResKonnect website, the Android app and associated services, including the optional residence Gmail connection. ResKonnect may process personal information under South Africa’s Protection of Personal Information Act (POPIA).",
      "ResKonnect can be contacted at reskonnect@gmail.com, Pretoria, South Africa."
    ]
  },
  {
    "heading": "2. Information collected",
    "paragraphs": [
      "For accounts and application services, we may process names, email addresses, phone numbers, authentication identifiers, education and funding information, accommodation preferences, applications and documents chosen by users.",
      "Other services may process optional foreground location, camera or user-selected media, device/security events, service analytics, commercial references and user-entered support requests. Access depends on the feature and permissions the user chooses."
    ]
  },
  {
    "heading": "3. Uses of personal information",
    "paragraphs": [
      "Information supports accounts, student accommodation search, applications, document verification, reservations, opportunities, customer support, fraud prevention, audit trails and service updates. Optional marketing measurement requires the corresponding choice. Private application data is only shared with authorised service staff, relevant accommodation providers, institutions and other partners where necessary for the requested workflow."
    ]
  },
  {
    "heading": "4. Connected Google Gmail accounts — access and permissions",
    "paragraphs": [
      "Authorised residence owners, managers and ResKonnect staff may optionally use Google OAuth to connect their own Gmail or Google Workspace mailbox. The requested Google account identity information identifies the connected person and mailbox. The Google Gmail API scope https://www.googleapis.com/auth/gmail.send is used only to send messages that an authorised person reviews and initiates from the ResKonnect residence communications interface.",
      "Typical messages include application acknowledgements, missing-document requests, application decisions, reservation confirmations, viewing arrangements and move-in instructions. ResKonnect does not request permission to read, search, modify or delete Gmail inbox messages. It does not silently send marketing campaigns using these permissions."
    ]
  },
  {
    "heading": "5. Storage, sharing, retention and security of Google user data",
    "paragraphs": [
      "ResKonnect stores the connected Google account identifier, email sending address and a restricted server-side OAuth refresh credential for the duration of the authorised connection. Credentials are not exposed in public pages or shared with residence applicants. Messages are transmitted through Google’s Gmail API; operational correspondence audit records may include recipient, residence or case reference, subject, sending status and Gmail provider message identifier.",
      "Access is limited to authorised functions and relevant residence roles. The Google connection and related user data are not sold, used for third-party advertising or provided to AI systems for general model training. We use infrastructure providers for secure storage, application hosting and delivery of the requested services. Operational records are retained only for applicable service, accounting, security, dispute or legal requirements, then deleted or de-identified when no longer needed."
    ]
  },
  {
    "heading": "6. Disconnecting Gmail and revoking consent",
    "paragraphs": [
      "Users may disconnect the Gmail integration in Residence Communications or revoke the app’s access in their Google Account connections. ResKonnect attempts to revoke Google's authorisation and removes the locally stored sending credential. Disconnection prevents future sending through ResKonnect; emails already sent remain in the sender and recipient mailboxes, and necessary service audit records may remain under the lawful retention policy.",
      "Google Account connections: https://myaccount.google.com/connections"
    ]
  },
  {
    "heading": "7. Other service providers and disclosures",
    "paragraphs": [
      "ResKonnect uses service providers as required, including Supabase for authentication, database and storage; Vercel for hosting; Google services for authorised Gmail sending and maps; Twilio for appropriate communications; and approved AI services for explicitly invoked functionality. We limit disclosed information to what each requested function reasonably requires.",
      "Application documents and case details may be shared with the provider, institution or service personnel responsible for the workflow. Legal or security disclosures may occur where lawful."
    ]
  },
  {
    "heading": "8. Security and rights",
    "paragraphs": [
      "ResKonnect uses secure transport, server-managed secrets, role-based access rules, database security controls, security monitoring and audit events. No online service can guarantee absolute security.",
      "Subject to POPIA and other applicable law, users may request access, correction or deletion of personal information, and object to some processing, by contacting reskonnect@gmail.com. Account and data deletion requests may also be submitted through the public account-deletion page at https://www.reskonnect.org/delete-account."
    ]
  },
  {
    "heading": "9. Cookies, retention and policy changes",
    "paragraphs": [
      "Authentication, preferences, fraud prevention, diagnostics and service delivery may use cookies or local storage. Optional Meta marketing measurement is not intended to collect personal application documents or identity numbers, and preferences may be changed in the app. Records are kept only as long as reasonably needed for valid service purposes, mandatory legal obligations and legitimate security/audit needs.",
      "The privacy policy may be updated when features or data practices change. The date and latest policy remain available on this page."
    ]
  },
  {
    "heading": "10. Contact",
    "paragraphs": [
      "For questions, Google user-data access inquiries, connection deletion or privacy complaints, contact ResKonnect at reskonnect@gmail.com, Pretoria, South Africa."
    ]
  }
];
const privacySectionsHtml = googleOAuthPolicySections.map((section) =>
  '<section style="margin:28px 0" aria-label="'+esc(section.heading)+'"><h2 style="font-size:1.35rem;line-height:1.35;color:#10213a">'+esc(section.heading)+'</h2>'+
  section.paragraphs.map((paragraph)=>'<p style="font-size:1rem;line-height:1.8;color:#435169;margin:12px 0">'+esc(paragraph)+'</p>').join("")+
  '</section>'
).join("");
let privacyHtml = base.replace(/<title>[\s\S]*?<\/title>/i,"<title>Privacy Policy and Google Gmail data | ResKonnect</title>");
privacyHtml = replaceOrInsert(privacyHtml,/<meta name="description" content="[^"]*"\s*\/?\s*>/i,
 '<meta name="description" content="How ResKonnect handles account, student and connected Google Gmail data, including permissions, secure storage, deletion, retention and contact." />');
privacyHtml = replaceOrInsert(privacyHtml,/<link rel="canonical" href="[^"]*"\s*\/?\s*>/i,
 '<link rel="canonical" href="https://www.reskonnect.org/privacy" />');
privacyHtml = replaceOrInsert(privacyHtml,/<meta property="og:url" content="[^"]*"\s*\/?\s*>/i,
 '<meta property="og:url" content="https://www.reskonnect.org/privacy" />');
privacyHtml = replaceOrInsert(privacyHtml,/<meta property="og:title" content="[^"]*"\s*\/?\s*>/i,
 '<meta property="og:title" content="ResKonnect Privacy Policy and Google Gmail data" />');
privacyHtml = replaceOrInsert(privacyHtml,/<meta property="og:description" content="[^"]*"\s*\/?\s*>/i,
 '<meta property="og:description" content="Privacy policy for ResKonnect, including how optional Gmail send-only OAuth access is used, secured, retained and disconnected." />');
privacyHtml=privacyHtml.replace('<div id="root"></div>',
 '<div id="root"><main data-seo-prerender="true" style="max-width:920px;margin:0 auto;padding:40px 24px;font-family:Inter,Arial,sans-serif;color:#10213a">'+
 '<nav aria-label="Public ResKonnect pages" style="display:flex;gap:20px;flex-wrap:wrap"><a href="/">ResKonnect Home</a><a href="/about">About</a><a href="/partners/landlords">Residence Portal</a><a href="/terms">Terms of Service</a></nav>'+
 '<header style="padding:24px 0;border-bottom:1px solid #e0e7f0"><p style="font-weight:700;color:#2459bd">ResKonnect</p><h1 style="font-size:2.6rem;margin:12px 0">Privacy Policy</h1><p>Last updated: 9 November 2026</p><p style="line-height:1.7">How we access, use, store, share, retain and delete personal information, including Google user data used for optional Gmail sending by authorised residence teams.</p></header>'+
 privacySectionsHtml+
 '<footer style="border-top:1px solid #e0e7f0;padding:28px 0"><a href="/">Homepage</a> · <a href="/terms">Terms</a> · <a href="/delete-account">Account deletion</a> · <a href="mailto:reskonnect@gmail.com">Privacy contact</a></footer>'+
 '</main></div>');
await fs.writeFile(path.join(DIST,"_seo","privacy.html"),privacyHtml);

console.log(`Prerendered ${pages.length} strategic ResKonnect search pages plus the public privacy policy.`);
