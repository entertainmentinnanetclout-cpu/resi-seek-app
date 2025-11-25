import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  imageUrl?: string;
  keywords?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description, imageUrl, keywords }) => {
  const defaultKeywords = "ResKonnect, student accommodation, TUT, residence application, student housing, find a res, marketplace, campus life, student jobs";
  const siteUrl = "https://www.reskonnect.co.za"; // Corrected domain

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={`${defaultKeywords}, ${keywords || ""}`} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={siteUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      {imageUrl && <meta property="twitter:image" content={imageUrl} />}

      {/* Other meta tags */}
      <meta name="author" content="ResKonnect" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={siteUrl} />
    </Helmet>
  );
};

export default SEO;
