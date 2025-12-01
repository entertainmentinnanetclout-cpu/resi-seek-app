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
import { MapPin, Bed, ShieldCheck, GraduationCap } from "lucide-react";

const CampusLanding: React.FC = () => {
  const { campus } = useParams<{ campus: string }>();
  const campusName = campus 
    ? campus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace('Tut', 'TUT') 
    : '';

  // Filter residences for this campus
  const filteredResidences = residences.filter(r => 
    r.campus.toLowerCase().includes(campusName.toLowerCase().replace('tut ', ''))
  );
  const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);
  const nsfasCount = filteredResidences.filter(r => r.nsfas_accredited).length;

  const title = `${campusName} Accommodation | ${bedCount}+ Beds Near Campus | ResKonnect`;
  const description = `Find student accommodation near ${campusName}. Browse ${filteredResidences.length} verified residences with ${bedCount}+ beds. ${nsfasCount} NSFAS approved options. Walking distance to campus!`;

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${campusName} Student Residences`,
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
          "addressLocality": "Pretoria",
          "addressRegion": "Gauteng",
          "addressCountry": "ZA"
        },
        "url": `https://reskonnect.co.za/res/${residence.id}`
      }
    }))
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "ResKonnect Student Accommodation",
    "description": `Student accommodation services near ${campusName}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "addressCountry": "ZA"
    },
    "areaServed": campusName,
    "url": `https://reskonnect.co.za/tut-${campus}-accommodation`
  };

  return (
    <PublicLayout>
      <SEO 
        title={title} 
        description={description}
        keywords={`${campusName} accommodation, ${campusName} student housing, res near ${campusName}, NSFAS ${campusName}, TUT accommodation`}
      />
      <SEOJsonLd schema={[itemListSchema, localBusinessSchema]} />
      
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
              <BreadcrumbLink asChild>
                <Link to="/student-accommodation-gauteng">Gauteng</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink>{campusName}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{campusName} Accommodation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            {filteredResidences.length} verified residences with {bedCount}+ beds within walking distance
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
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
            <Link to="/auth">Find Your Residence</Link>
          </Button>
        </div>

        {/* Residences Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Residences Near {campusName}</h2>
          {filteredResidences.length > 0 ? (
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
                      <Link to="/auth">View & Apply</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  We're expanding to this campus soon! Sign up to be notified when residences become available.
                </p>
                <Button asChild>
                  <Link to="/auth">Get Notified</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <SEOTextBlock
          title={`Living Near ${campusName}`}
          content={[
            `Finding accommodation near ${campusName} is easy with ResKonnect. We list verified student residences within walking distance of the campus, saving you time and transport costs.`,
            `Our ${campusName} listings include both NSFAS accredited and private accommodation options. Each residence is vetted for safety, amenities, and student-friendly policies.`,
            `Amenities typically include WiFi, 24-hour security, study areas, and communal facilities. Browse our ${campusName} residences today and secure your spot for the upcoming academic year.`
          ]}
        />
      </div>
    </PublicLayout>
  );
};

export default CampusLanding;