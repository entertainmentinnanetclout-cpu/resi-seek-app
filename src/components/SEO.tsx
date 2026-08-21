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
  publishedTime?: string;
  modifiedTime?: string;
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
  publishedTime,
  modifiedTime,
  jsonLd,
}) => {
  const location = useLocation();
  const defaultKeywords = "ResKonnect, Res Konnect, ResConnect, Res Connect, student accommodation, TUT accommodation, residence application, student housing, NSFAS accommodation, university applications, WIL, internships, student property South Africa";
  const currentPath = canonicalPath || location.pathname;
  const routeMeta = getRouteMeta(currentPath);
  const resolvedTitle = title || routeMeta?.title || "ResKonnect | Student Accommodation, Applications, AI & Opportunities";
  const resolvedDescription =
    description ||
    routeMeta?.description ||
    "Find student accommodation, prepare applications, access WIL and career opportunities, and explore student-housing intelligence with ResKonnect.";
  const resolvedKeywords = keywords || routeMeta?.keywords;
  const canonical = canonicalUrl(currentPath);
  const defaultImage = routeMeta?.ogImage || DEFAULT_OG_IMAGE;
  const shouldNoIndex = noIndex ?? isNoIndexPath(location.pathname);
  const robots = shouldNoIndex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <html lang="en-ZA" />
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      {/* Keywords are retained as a classification hint for internal tooling; major search engines do not rely on this tag for ranking. */}
      <meta name="keywords" content={resolvedKeywords ? `${defaultKeywords}, ${resolvedKeywords}` : defaultKeywords} />

      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="bingbot" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={imageUrl || defaultImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${resolvedTitle} — ResKonnect`} />
      <meta property="og:site_name" content="ResKonnect" />
      <meta property="og:locale" content="en_ZA" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={imageUrl || defaultImage} />
      <meta name="twitter:site" content="@ResKonnect" />

      <meta name="author" content="ResKonnect" />
      <meta name="application-name" content="ResKonnect" />
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
