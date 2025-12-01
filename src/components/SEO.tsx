import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  imageUrl?: string;
  keywords?: string;
  canonicalPath?: string;
  type?: "website" | "article" | "product";
  noIndex?: boolean;
}

const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  imageUrl, 
  keywords,
  canonicalPath,
  type = "website",
  noIndex = false
}) => {
  const location = useLocation();
  const defaultKeywords = "ResKonnect, student accommodation, TUT, residence application, student housing, find a res, Pretoria student residence, NSFAS accommodation, Tshwane accommodation, university housing South Africa";
  const siteUrl = "https://reskonnect.co.za";
  const currentPath = canonicalPath || location.pathname;
  const canonicalUrl = `${siteUrl}${currentPath === "/" ? "" : currentPath}`;
  const defaultImage = `${siteUrl}/og-image.png`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords ? `${defaultKeywords}, ${keywords}` : defaultKeywords} />
      
      {/* Robots */}
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl || defaultImage} />
      <meta property="og:site_name" content="ResKonnect" />
      <meta property="og:locale" content="en_ZA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl || defaultImage} />
      <meta name="twitter:site" content="@ResKonnect" />

      {/* Other meta tags */}
      <meta name="author" content="ResKonnect" />
      <meta name="geo.region" content="ZA-GT" />
      <meta name="geo.placename" content="Pretoria" />
      <link rel="canonical" href={canonicalUrl} />
    </Helmet>
  );
};

export default SEO;
