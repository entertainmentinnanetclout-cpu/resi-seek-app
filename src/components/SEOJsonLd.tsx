import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOJsonLdProps {
  schema: object | object[];
}

const SEOJsonLd: React.FC<SEOJsonLdProps> = ({ schema }) => {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default SEOJsonLd;
