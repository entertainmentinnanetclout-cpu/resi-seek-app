import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import PublicLayout from '@/components/PublicLayout';
import { residences } from '@/data/residences';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, ShieldCheck, Building2 } from "lucide-react";

const NationalLanding: React.FC = () => {
  const bedCount = residences.reduce((acc, r) => acc + r.bedCount, 0);
  const nsfasCount = residences.filter(r => r.nsfas_accredited).length;

  const title = "South Africa Student Accommodation | 1000+ Verified Residences | ResKonnect";
  const description = `Find student accommodation across South Africa with ResKonnect. Browse ${residences.length}+ verified residences with ${bedCount}+ beds. NSFAS approved options available in Gauteng, Western Cape, KZN & more.`;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ResKonnect",
    "url": "https://reskonnect.co.za",
    "logo": "https://reskonnect.co.za/logo.png",
    "description": "South Africa's leading student accommodation platform",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "addressCountry": "ZA"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+27-63-732-3192",
      "contactType": "customer service",
      "email": "Reskonnect@gmail.com"
    }
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "South Africa Student Residences",
    "numberOfItems": residences.length,
    "itemListElement": residences.map((residence, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Accommodation",
        "name": residence.name,
        "address": residence.address,
        "url": `https://reskonnect.co.za/res/${residence.id}`
      }
    }))
  };

  const provinces = [
    { name: "Gauteng", slug: "gauteng", count: residences.filter(r => r.province === "Gauteng").length },
    { name: "Western Cape", slug: "western-cape", count: 0 },
    { name: "KwaZulu-Natal", slug: "kwazulu-natal", count: 0 },
    { name: "Limpopo", slug: "limpopo", count: 0 },
  ];

  return (
    <PublicLayout>
      <SEO 
        title={title} 
        description={description}
        keywords="South Africa student accommodation, university housing SA, NSFAS accommodation, student res South Africa, college housing"
      />
      <SEOJsonLd schema={[organizationSchema, itemListSchema]} />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink>South Africa Accommodation</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">South Africa Student Accommodation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Find your perfect student home from {residences.length}+ verified residences with {bedCount}+ beds nationwide
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="font-semibold">{residences.length}+ Residences</span>
            </div>
            <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-green-700" />
              <span className="font-semibold">{nsfasCount} NSFAS Approved</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-lg">
              <Bed className="w-5 h-5 text-blue-700" />
              <span className="font-semibold">{bedCount}+ Beds</span>
            </div>
          </div>
          <Button size="lg" asChild>
            <Link to="/auth">Start Your Search</Link>
          </Button>
        </div>

        {/* Browse by Province */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Browse by Province</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {provinces.map((prov) => (
              <Link key={prov.slug} to={`/student-accommodation-${prov.slug}`}>
                <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold mb-2">{prov.name}</h3>
                    <p className="text-sm text-muted-foreground">{prov.count || "Coming Soon"}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Residences */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Residences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {residences.slice(0, 6).map((residence) => (
              <Card key={residence.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold">{residence.name}</h3>
                    {residence.nsfas_accredited && (
                      <span className="flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        NSFAS
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{residence.address}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Bed className="w-4 h-4 mr-2" />
                    <span>{residence.bedCount} beds available</span>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/auth">View Details</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <SEOTextBlock
          title="Nationwide Student Housing"
          content={[
            `ResKonnect is South Africa's leading platform for student accommodation. We connect students from all nine provinces with verified, safe, and affordable housing options near their universities and colleges.`,
            `Our platform features NSFAS accredited residences, making it easy for funded students to find approved accommodation. We partner with trusted landlords who meet our strict safety and quality standards.`,
            `Whether you're studying in Gauteng, Western Cape, KwaZulu-Natal, or anywhere else in South Africa, ResKonnect makes finding student accommodation simple. Browse our listings, compare options, and apply online today.`
          ]}
        />
      </div>
    </PublicLayout>
  );
};

export default NationalLanding;