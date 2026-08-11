// Canonical ResKonnect brand system. Single source of truth for names, copy,
// logos and contact details. Do not hardcode brand strings elsewhere.
import fullLogo from "@/assets/RESKONNECT LOGO OFFICIAL VERSION 2.png";
import iconLogo from "@/assets/reskonnect-icon-only-transparent-512.png";
import iconLogoSmall from "@/assets/reskonnect-icon-only-transparent-128.png";
import appIcon from "@/assets/reskonnect-app-icon-1024.png";

export const BRAND = {
  name: "ResKonnect",
  descriptor: "LIVING • AI • OPPORTUNITY",
  tagline: "Connecting Residents. Advancing Futures.",
  journeyLine: "From matric to move-in, from study to opportunity.",
  hero: {
    headline: "Your stay. Your studies. Your future. Connected.",
    subcopy:
      "One connected platform for student accommodation, private rentals, applications guidance, WIL support, and partner solutions.",
    primaryCta: { label: "Get Started", to: "/get-started" },
    secondaryCtas: [
      { label: "Find Accommodation", to: "/find" },
      { label: "Partner With ResKonnect", to: "/partners" },
    ],
    searchPlaceholder:
      "Search by campus, area, residence, institution, or service...",
  },
  logos: {
    full: fullLogo,
    icon: iconLogo,
    iconSmall: iconLogoSmall,
    appIcon,
  },
  contact: {
    phone: "063 732 3192",
    phoneRaw: "0637323192",
    whatsapp: "27637323192",
    email: "reskonnect@gmail.com",
    website: "www.reskonnect.co.za",
    websiteUrl: "https://reskonnect.co.za",
  },
  compliance: {
    admissions:
      "ResKonnect is not an admissions office and does not replace official institution application systems. We assist with guidance, readiness checks, document preparation, accommodation matching, WIL support, and partner solutions.",
    nsfas:
      "ResKonnect does not provide NSFAS application services. NSFAS may only appear as a funding or accommodation accreditation context where relevant.",
  },
} as const;

export const BRAND_COLORS = {
  deepNavy: "#071326",
  commandNavy: "#0B1220",
  richBlue: "#2563EB",
  accentBlue: "#2F6EDB",
  gold: "#F5B32F",
  green: "#12A870",
  red: "#EF4444",
  softSurface: "#F8FAFC",
  cardBorder: "#E5E7EB",
  white: "#FFFFFF",
} as const;

export default BRAND;
