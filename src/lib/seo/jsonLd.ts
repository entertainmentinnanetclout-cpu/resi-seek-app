// JSON-LD builders. Every builder emits only real, verifiable data.
// There are deliberately NO rating, review or partner-relationship fields here.
import { SITE_NAME, SITE_URL, canonicalUrl } from "./seoConfig";

const CONTACT_EMAIL = "reskonnect@gmail.com";
const CONTACT_PHONE = "+27637323192";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "RESKONNECT",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description:
      "ResKonnect is a student journey platform for accommodation, application readiness, WIL support, and partner solutions.",
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    areaServed: "ZA",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE,
        availableLanguage: ["en"],
      },
    ],
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
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

/** Only call this with FAQs that are actually rendered on the page. */
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
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
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