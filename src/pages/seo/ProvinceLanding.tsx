import React from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import PublicLayout from '@/components/PublicLayout';
import { residences } from '@/data/residences';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, ShieldCheck } from "lucide-react";

const ProvinceLanding: React.FC = () => {
  const { province } = useParams<{ province: string }>();
  const provinceName = province ? province.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

  const filteredResidences = residences.filter(r => r.province.toLowerCase() === provinceName.toLowerCase());
  const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);

  const title = `${provinceName} Student Accommodation | ${bedCount}+ Beds | ResKonnect`;
  const description = `Find verified student accommodation in ${provinceName}, South Africa. Browse ${filteredResidences.length} residences with ${bedCount}+ beds. NSFAS approved options available. Apply online today!`;

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${provinceName} Student Residences`,
    "numberOfItems": filteredResidences.length,
    "itemListElement": filteredResidences.map((residence, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Accommodation",
        "name": residence.name,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": residence.address,
          "addressRegion": provinceName,
          "addressCountry": "ZA"
        },
        "url": `https://reskonnect.co.za/res/${residence.id}`
      }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://reskonnect.co.za" },
      { "@type": "ListItem", "position": 2, "name": `${provinceName} Accommodation`, "item": `https://reskonnect.co.za/student-accommodation-${province}` }
    ]
  };

  return (
    <PublicLayout>
      <SEO 
        title={title} 
        description={description}
        keywords={`${provinceName} student accommodation, ${provinceName} university housing, student res ${provinceName}, NSFAS ${provinceName}`}
      />
      <SEOJsonLd schema={[itemListSchema, breadcrumbSchema]} />
      
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
              <BreadcrumbLink>{provinceName} Accommodation</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{provinceName} Student Accommodation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Discover {filteredResidences.length} verified student residences with {bedCount}+ available beds
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">Browse All Residences</Link>
          </Button>
        </div>

        {/* Featured Residences */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Residences in {provinceName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResidences.map((residence) => (
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
          title={`Student Living in ${provinceName}`}
          content={[
            `${provinceName} is home to some of South Africa's leading universities and colleges, making it a prime location for students seeking quality accommodation. ResKonnect connects you with verified residences that meet safety standards and offer modern amenities.`,
            `Whether you're looking for NSFAS accredited accommodation or premium student housing, our platform makes it easy to compare options and apply online. We list residences near major institutions including TUT, UP, and other universities in ${provinceName}.`,
            `Our ${provinceName} residences offer a range of room types from single rooms to shared apartments, with amenities like WiFi, study areas, security, and more. Start your search today and find your perfect student home.`
          ]}
        />
      </div>
    </PublicLayout>
  );
};

export default ProvinceLanding;