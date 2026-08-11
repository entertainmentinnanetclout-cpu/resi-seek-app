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
import { MapPin, Bed, ShieldCheck, CheckCircle2 } from "lucide-react";

const NsfAsLanding: React.FC = () => {
  const filteredResidences = residences.filter(r => r.nsfas_accredited);
  const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);

  const title = "NSFAS Accredited Accommodation | Verified & Safe | ResKonnect";
  const description = `Find NSFAS accredited student accommodation with ResKonnect. Browse ${filteredResidences.length} verified NSFAS approved residences with ${bedCount}+ beds. Apply online and secure your funded accommodation today!`;

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "NSFAS Accredited Student Residences",
    "numberOfItems": filteredResidences.length,
    "itemListElement": filteredResidences.map((residence, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Accommodation",
        "name": residence.name,
        "address": residence.address,
        "url": `https://www.reskonnect.org/res/${residence.id}`
      }
    }))
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is NSFAS accredited accommodation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "NSFAS accredited accommodation refers to student residences that meet the National Student Financial Aid Scheme's standards for safety, quality, and proximity to educational institutions. These residences are approved for funding through NSFAS allowances."
        }
      },
      {
        "@type": "Question",
        "name": "How do I apply for NSFAS accommodation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "To apply for NSFAS accommodation on ResKonnect, create an account, browse our NSFAS approved listings, and submit your application online. Once approved, your accommodation allowance can be used to pay for your residence."
        }
      },
      {
        "@type": "Question",
        "name": "How much does NSFAS accommodation cost?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "NSFAS provides accommodation allowances that vary by institution and location. The allowance typically covers the full cost of accredited accommodation, including rent and basic utilities."
        }
      }
    ]
  };

  const nsfasBenefits = [
    "Direct payment from NSFAS to landlord",
    "Verified safety and quality standards",
    "Proximity to your campus",
    "No upfront payment required",
    "All-inclusive pricing",
    "24/7 security included"
  ];

  return (
    <PublicLayout>
      <SEO 
        title={title} 
        description={description}
        keywords="NSFAS accommodation, NSFAS accredited residence, NSFAS approved housing, student funding accommodation, NSFAS housing allowance"
      />
      <SEOJsonLd schema={[itemListSchema, faqSchema]} />
      
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
              <BreadcrumbLink>NSFAS Accommodation</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full mb-4">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-semibold">NSFAS Verified</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">NSFAS Accredited Accommodation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            {filteredResidences.length} verified NSFAS approved residences with {bedCount}+ beds available
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">Find NSFAS Housing</Link>
          </Button>
        </div>

        {/* Benefits Section */}
        <section className="mb-12">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-center">Why Choose NSFAS Accredited?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {nsfasBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Residences Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">NSFAS Approved Residences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResidences.map((residence) => (
              <Card key={residence.id} className="hover:shadow-lg transition-shadow border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold">{residence.name}</h3>
                    <span className="flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      NSFAS
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{residence.address}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Bed className="w-4 h-4 mr-2" />
                    <span>{residence.bedCount} beds available</span>
                  </div>
                  <Button variant="outline" className="w-full border-green-300 hover:bg-green-50" asChild>
                    <Link to="/auth">Apply Now</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">What is NSFAS accredited accommodation?</h3>
                <p className="text-muted-foreground">
                  NSFAS accredited accommodation refers to student residences that meet the National Student Financial Aid Scheme's standards for safety, quality, and proximity to educational institutions.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">How do I apply for NSFAS accommodation?</h3>
                <p className="text-muted-foreground">
                  Create an account on ResKonnect, browse our NSFAS approved listings, and submit your application online. Once approved, your accommodation allowance can be used to pay for your residence.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">How much does NSFAS accommodation cost?</h3>
                <p className="text-muted-foreground">
                  NSFAS provides accommodation allowances that typically cover the full cost of accredited accommodation, including rent and basic utilities. No upfront payment is usually required.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <SEOTextBlock
          title="Your Guide to NSFAS Housing"
          content={[
            `Finding NSFAS accredited accommodation is simple with ResKonnect. We have a dedicated section for residences that meet the standards set by the National Student Financial Aid Scheme, ensuring you find a safe, comfortable, and approved place to live.`,
            `All our NSFAS listings have been verified to meet the scheme's requirements for student housing. This includes safety certifications, proximity to campuses, and quality standards that protect funded students.`,
            `Browse our listings of NSFAS accredited properties and apply with confidence, knowing that your chosen residence is recognized and supported by NSFAS. Start your search today and secure your funded accommodation.`
          ]}
        />
      </div>
    </PublicLayout>
  );
};

export default NsfAsLanding;