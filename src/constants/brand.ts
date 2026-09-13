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
  journeyLine: "From search to placement, from study to opportunity.",
  positioning:
    "An integrated Living, AI and Opportunity platform connecting student accommodation, intelligent guidance, applications, education pathways, WIL, bursaries and verified opportunities through one ResKonnect journey.",
  hero: {
    headline: "Everything students need to move forward. Connected.",
    subcopy:
      "ResKonnect connects Living, intelligent guidance and real opportunities in one platform — helping students move from searching to taking action faster.",
    primaryCta: { label: "Explore ResKonnect", to: "/get-started" },
    secondaryCtas: [
      { label: "Ask ResKonnect AI", to: "/ai" },
      { label: "Find Accommodation", to: "/findmyres" },
    ],
    searchPlaceholder:
      "Search accommodation, courses, bursaries, opportunities or ResKonnect services...",
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
    website: "www.reskonnect.org",
    websiteUrl: "https://www.reskonnect.org",
  },
  compliance: {
    admissions:
      "ResKonnect is not an admissions office and does not replace official institution application systems. We assist with guidance, readiness checks, document preparation, accommodation placement, WIL support, and partner solutions.",
    accommodationPlacement:
      "ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide the required documents and accept an available suitable accommodation match. The guarantee is for accommodation placement; it does not guarantee a particular building, room, rent amount, institution admission, NSFAS funding, WIL placement or employment outcome where those decisions depend on third parties or live inventory.",
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
