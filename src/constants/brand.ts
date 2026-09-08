// Canonical ResKonnect brand system. Single source of truth for names, copy,
// logos and contact details. Do not hardcode brand strings elsewhere.
import fullLogo from "@/assets/RESKONNECT LOGO OFFICIAL VERSION 2.png";
import iconLogo from "@/assets/reskonnect-icon-only-transparent-512.png";
import iconLogoSmall from "@/assets/reskonnect-icon-only-transparent-128.png";
import appIcon from "@/assets/reskonnect-app-icon-1024.png";

export const BRAND = {
  name: "ResKonnect",
  descriptor: "LIVING • DIMPHO AI • RESMAP 3D • OPPORTUNITY",
  tagline: "Connecting Residents. Advancing Futures.",
  journeyLine: "From search to placement, from study to opportunity.",
  positioning:
    "An Africa-built student accommodation technology platform combining verified accommodation discovery, guaranteed accommodation placement for eligible placement clients, Dimpho AI, live ResMap navigation and photorealistic 3D exploration.",
  hero: {
    headline: "The next generation of student accommodation discovery — built in Africa.",
    subcopy:
      "Find, explore and secure student accommodation through one intelligent platform with Dimpho AI, ResMap 3D, live navigation, verified listings and an accommodation placement guarantee for eligible placement clients.",
    primaryCta: { label: "Find My Res", to: "/findmyres" },
    secondaryCtas: [
      { label: "Explore ResMap 3D", to: "/findmyres?view=map&mode=3d" },
      { label: "Partner With ResKonnect", to: "/partners" },
    ],
    searchPlaceholder:
      "Search by campus, area, residence, institution, or ask Dimpho...",
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
