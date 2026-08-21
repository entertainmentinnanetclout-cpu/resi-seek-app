import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { DEFAULT_OG_IMAGE, canonicalUrl, getRouteMeta, isNoIndexPath } from "@/lib/seo/seoConfig";
import { organizationSchema, webSiteSchema } from "@/lib/seo/jsonLd";

interface SEOProps {
  title?: string;
  description?: string;
  imageUrl?: string;
  /** Retained for page-template compatibility; modern search engines do not use meta keywords for ranking. */
  keywords?: string;
  canonicalPath?: string;
  type?: "website" | "article" | "product";
  noIndex?: boolean;
  /** Structured data emitted alongside the metadata. */
  jsonLd?: object | object[];
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  imageUrl,
  canonicalPath,
  type = "website",
  noIndex,
  jsonLd,
}) => {
  const location = useLocation();
  const currentPath = canonicalPath || location.pathname;
  const routeMeta = getRouteMeta(currentPath);
  const resolvedTitle = title || routeMeta?.title || "ResKonnect | Student Accommodation & Application Readiness";
  const resolvedDescription =
    description ||
    routeMeta?.description ||
    "Find student accommodation, prepare applications, discover opportunities and explore student-housing intelligence with ResKonnect.";
  const canonical = canonicalUrl(currentPath);
  const defaultImage = routeMeta?.ogImage || DEFAULT_OG_IMAGE;
  const shouldNoIndex = noIndex ?? isNoIndexPath(location.pathname);
  const pageSchemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const schemas = currentPath === "/"
    ? [organizationSchema(), webSiteSchema(), ...pageSchemas]
    : pageSchemas;
  const robotsDirective = shouldNoIndex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />

      {/* Search crawler directives */}
      <meta name="robots" content={robotsDirective} />
      <meta name="googlebot" content={robotsDirective} />
      <meta name="bingbot" content={robotsDirective} />

      {/* Canonical and language signals */}
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en-ZA" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={imageUrl || defaultImage} />
      <meta property="og:site_name" content="ResKonnect" />
      <meta property="og:locale" content="en_ZA" />

      {/* Social discovery */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={imageUrl || defaultImage} />
      <meta name="twitter:site" content="@ResKonnect" />

      <meta name="author" content="ResKonnect" />
      <meta name="geo.region" content="ZA-GT" />
      <meta name="geo.placename" content="Pretoria" />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
