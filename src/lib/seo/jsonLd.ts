// JSON-LD builders. Every builder emits only real, verifiable data.
// There are deliberately NO rating, review or partner-relationship fields here.
import { SITE_NAME, SITE_URL, canonicalUrl } from "./seoConfig";

const CONTACT_EMAIL = "reskonnect@gmail.com";
const CONTACT_PHONE = "+27637323192";
const BRAND_ALIASES = ["Res Konnect", "ResConnect", "Res Connect", "Resconnect"];

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: BRAND_ALIASES,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description:
      "ResKonnect is a South African student journey platform for accommodation, application readiness, AI-powered guidance, WIL opportunities, and student-housing property intelligence.",
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    areaServed: { "@type": "Country", name: "South Africa" },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE,
        availableLanguage: ["en"],
        areaServed: "ZA",
      },
    ],
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: BRAND_ALIASES,
    url: SITE_URL,
    inLanguage: "en-ZA",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/find?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: canonicalUrl(c.path),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Semantic FAQ schema helper retained for consumers that understand Schema.org.
 * Google no longer exposes FAQ rich results, so this is not emitted by default page templates.
 */
export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  path: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: canonicalUrl(opts.path),
    inLanguage: "en-ZA",
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  if (opts.image) schema.image = opts.image;
  if (opts.datePublished) schema.datePublished = opts.datePublished;
  if (opts.dateModified) schema.dateModified = opts.dateModified;
  return schema;
}

export interface ResidenceLike {
  name: string;
  slug?: string | null;
  id: string;
  address?: string | null;
  description?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  price?: number | null;
  available_spots?: number | null;
  province?: string | null;
}

/**
 * LodgingBusiness + Offer built strictly from real residence fields.
 * Missing fields are omitted rather than invented. No ratings, no reviews.
 */
export function lodgingBusinessSchema(residence: ResidenceLike) {
  const url = canonicalUrl(`/find-my-res/${residence.slug || residence.id}`);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: residence.name,
    url,
  };

  if (residence.description) schema.description = residence.description;

  const image = residence.image_url || residence.images?.[0];
  if (image) schema.image = image;

  if (residence.address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: residence.address,
      addressRegion: residence.province || undefined,
      addressCountry: "ZA",
    };
  }

  const price = Number(residence.price);
  if (Number.isFinite(price) && price > 0) {
    schema.makesOffer = {
      "@type": "Offer",
      price: String(price),
      priceCurrency: "ZAR",
      url,
      availability:
        typeof residence.available_spots === "number"
          ? residence.available_spots > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut"
          : undefined,
    };
  }

  return schema;
}
