import { Link } from "react-router-dom";
import { BRAND } from "@/constants/brand";

const columns = [
  {
    title: "Living",
    links: [
      { label: "Find My Res", to: "/find" },
      { label: "Student Accommodation", to: "/living/student-accommodation" },
      { label: "Private Rentals", to: "/living/private-rentals" },
      { label: "For Parents", to: "/living/parents" },
    ],
  },
  {
    title: "Applications",
    links: [
      { label: "Application Readiness", to: "/applications" },
      { label: "APS & Documents", to: "/applications/checker" },
      { label: "TVET Readiness", to: "/applications/tvet" },
      { label: "University Readiness", to: "/applications/university" },
    ],
  },
  {
    title: "Opportunities",
    links: [
      { label: "Opportunities Hub", to: "/opportunities" },
      { label: "WIL Support", to: "/opportunities/wil" },
      { label: "Bursaries", to: "/bursaries" },
      { label: "Campus News", to: "/campus-news" },
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
];

const SiteFooter = () => (
  <footer className="mt-auto bg-brand-navy text-white/80">
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <img src={BRAND.logos.full} alt={BRAND.name} className="h-12 w-auto object-contain" />
          <p className="mt-3 text-[10px] tracking-[0.3em] text-white/60">{BRAND.descriptor}</p>
          <p className="mt-3 max-w-xs text-sm text-white/70">
            {BRAND.tagline} {BRAND.journeyLine}
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-semibold text-white">{col.title}</h4>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-white/70 transition-colors hover:text-brand-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 border-t border-white/10 pt-8 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
          <ul className="space-y-1.5 text-sm text-white/70">
            <li>
              <a href={`https://wa.me/${BRAND.contact.whatsapp}`} className="hover:text-brand-gold">
                WhatsApp / Phone: {BRAND.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.contact.email}`} className="hover:text-brand-gold">
                {BRAND.contact.email}
              </a>
            </li>
            <li>{BRAND.contact.website}</li>
          </ul>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-white/55">
          <p>{BRAND.compliance.admissions}</p>
          <p>{BRAND.compliance.nsfas}</p>
        </div>
      </div>
    </div>

    <div className="bg-brand-navy-command">
      <div className="container mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;