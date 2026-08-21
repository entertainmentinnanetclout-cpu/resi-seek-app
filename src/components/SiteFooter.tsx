import { Link } from "react-router-dom";
import { BRAND } from "@/constants/brand";

const columns = [
  {
    title: "Living",
    links: [
      { label: "ResKonnect Living", to: "/living" },
      { label: "Find My Res", to: "/find" },
      { label: "Student Accommodation", to: "/student-accommodation" },
      { label: "Student Accommodation Pretoria", to: "/student-accommodation/pretoria" },
      { label: "Pretoria West Accommodation", to: "/student-accommodation/pretoria-west" },
      { label: "Accommodation Near TUT", to: "/student-accommodation/near-tut" },
      { label: "NSFAS Accommodation", to: "/student-accommodation/nsfas-accredited" },
      { label: "Private Rentals", to: "/private-rentals" },
    ],
  },
  {
    title: "Applications",
    links: [
      { label: "ResKonnect Applications", to: "/applications" },
      { label: "University Applications", to: "/applications/university" },
      { label: "TVET Applications", to: "/applications/tvet" },
      { label: "Private College Applications", to: "/applications/private-college" },
      { label: "Application Readiness", to: "/applications/application-readiness" },
      { label: "APS Checker", to: "/applications/aps-checker" },
    ],
  },
  {
    title: "Opportunities",
    links: [
      { label: "Student Opportunities", to: "/opportunities" },
      { label: "WIL Placement Support", to: "/opportunities/wil" },
      { label: "Student Internships", to: "/opportunities/internships" },
      { label: "SETA Opportunities", to: "/opportunities/seta" },
      { label: "Bursaries", to: "/bursaries" },
      { label: "Campus News", to: "/campus-news" },
    ],
  },
  {
    title: "Property & AI",
    links: [
      { label: "Property Intelligence", to: "/properties" },
      { label: "Student Accommodation for Sale", to: "/student-accommodation-for-sale" },
      { label: "Property Auctions", to: "/property-auctions" },
      { label: "Development Opportunities", to: "/development-opportunities" },
      { label: "ResKonnect AI", to: "/ai" },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Partner With ResKonnect", to: "/partners" },
      { label: "List Your Property", to: "/partners/landlords" },
      { label: "Institutions & Business", to: "/partners/institutions" },
      { label: "Become a Recruiter", to: "/recruit" },
    ],
  },
  {
    title: "Guides",
    links: [
      { label: "Find Safe Student Accommodation", to: "/guides/how-to-find-safe-student-accommodation" },
      { label: "Pretoria West Accommodation Guide", to: "/guides/student-accommodation-pretoria-west" },
      { label: "TVET Application Checklist", to: "/guides/tvet-application-checklist" },
      { label: "University Application Checklist", to: "/guides/university-application-checklist" },
      { label: "Accommodation Documents", to: "/guides/what-documents-do-you-need-for-student-accommodation" },
    ],
  },
];

const SiteFooter = () => (
  <footer className="mt-auto border-t border-border bg-muted/40 text-muted-foreground">
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-7">
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <img src={BRAND.logos.full} alt={`${BRAND.name} — student living, AI and opportunity`} className="h-12 w-auto object-contain" />
          <p className="mt-3 text-[10px] tracking-[0.3em] text-muted-foreground">{BRAND.descriptor}</p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {BRAND.tagline} {BRAND.journeyLine}
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-semibold text-foreground">{col.title}</h4>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted-foreground transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 border-t border-border pt-8 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Contact</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              <a href={`https://wa.me/${BRAND.contact.whatsapp}`} className="hover:text-primary">
                WhatsApp / Phone: {BRAND.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.contact.email}`} className="hover:text-primary">
                {BRAND.contact.email}
              </a>
            </li>
            <li>{BRAND.contact.website}</li>
          </ul>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground/80">
          <p>{BRAND.compliance.admissions}</p>
          <p>{BRAND.compliance.nsfas}</p>
        </div>
      </div>
    </div>

    <div className="border-t border-border bg-background">
      <div className="container mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;