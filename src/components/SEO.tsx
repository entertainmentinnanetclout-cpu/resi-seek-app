import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { DEFAULT_OG_IMAGE, canonicalUrl, getRouteMeta, isNoIndexPath } from "@/lib/seo/seoConfig";

interface SEOProps {
  title?: string;
  description?: string;
  imageUrl?: string;
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
  keywords,
  canonicalPath,
  type = "website",
  noIndex,
  jsonLd,
}) => {
  const location = useLocation();
  const defaultKeywords = "ResKonnect, student accommodation, TUT, residence application, student housing, find a res, Pretoria student residence, NSFAS accommodation, Tshwane accommodation, university housing South Africa";
  const currentPath = canonicalPath || location.pathname;
  const routeMeta = getRouteMeta(currentPath);
  const resolvedTitle = title || routeMeta?.title || "ResKonnect | Student Accommodation & Application Readiness";
  const resolvedDescription =
    description ||
    routeMeta?.description ||
    "Find verified student accommodation, prepare your applications and access WIL support with ResKonnect.";
  const resolvedKeywords = keywords || routeMeta?.keywords;
  const canonical = canonicalUrl(currentPath);
  const defaultImage = routeMeta?.ogImage || DEFAULT_OG_IMAGE;
  const shouldNoIndex = noIndex ?? isNoIndexPath(location.pathname);
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="keywords" content={resolvedKeywords ? `${defaultKeywords}, ${resolvedKeywords}` : defaultKeywords} />
      
      {/* Robots */}
      <meta name="robots" content={shouldNoIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={imageUrl || defaultImage} />
      <meta property="og:site_name" content="ResKonnect" />
      <meta property="og:locale" content="en_ZA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={imageUrl || defaultImage} />
      <meta name="twitter:site" content="@ResKonnect" />

      {/* Other meta tags */}
      <meta name="author" content="ResKonnect" />
      <meta name="geo.region" content="ZA-GT" />
      <meta name="geo.placename" content="Pretoria" />
      <link rel="canonical" href={canonical} />
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
