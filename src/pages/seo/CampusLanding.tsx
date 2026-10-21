import React from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SEOJsonLd from "@/components/SEOJsonLd";
import SEOTextBlock from "@/components/SEOTextBlock";
import PublicLayout from "@/components/PublicLayout";
import { residences } from "@/data/residences";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, WalletCards, GraduationCap } from "lucide-react";

const CampusLanding: React.FC = () => {
  const { campus } = useParams<{ campus: string }>();
  const campusName = campus
    ? campus.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()).replace("Tut", "TUT")
    : "";

  const filteredResidences = residences.filter(r =>
    r.campus.toLowerCase().includes(campusName.toLowerCase().replace("tut ", "")),
  );
  const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);
  const fundingContextCount = filteredResidences.filter(r => r.nsfas_accredited).length;

  const title = `${campusName} Accommodation | ${bedCount}+ Beds Near Campus | ResKonnect`;
  const description = `Find student accommodation near ${campusName}. Browse ${filteredResidences.length} verified listings with ${bedCount}+ beds and clear funding and accreditation status.`;

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${campusName} Student Residences`,
    numberOfItems: filteredResidences.length,
    itemListElement: filteredResidences.map((residence, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Accommodation",
        name: residence.name,
        address: {
          "@type": "PostalAddress",
          streetAddress: residence.address,
          addressLocality: "Pretoria",
          addressRegion: "Gauteng",
          addressCountry: "ZA",
        },
        url: `https://www.reskonnect.org/res/${residence.id}`,
      },
    })),
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "ResKonnect Student Accommodation",
    description: `Student accommodation services near ${campusName}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Pretoria",
      addressRegion: "Gauteng",
      addressCountry: "ZA",
    },
    areaServed: campusName,
    url: `https://www.reskonnect.org/tut-${campus}-accommodation`,
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
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/student-accommodation-gauteng">Gauteng</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink>{campusName}</BreadcrumbLink></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4"><GraduationCap className="w-8 h-8 text-primary" /></div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{campusName} Accommodation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            {filteredResidences.length} verified listings with {bedCount}+ beds near campus
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
              <WalletCards className="w-5 h-5 text-green-700" />
              <span className="font-semibold">{fundingContextCount} with NSFAS funding context</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-lg">
              <Bed className="w-5 h-5 text-blue-700" />
              <span className="font-semibold">{bedCount}+ Beds</span>
            </div>
          </div>
          <p className="mx-auto mb-6 max-w-3xl text-xs leading-5 text-muted-foreground">
            Funding context is not proof of current official accreditation. Check the live NSFAS status page for evidence-controlled accreditation and validity details.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><Link to="/find">Find Your Residence</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/student-accommodation/nsfas-accredited">Check NSFAS status</Link></Button>
          </div>
        </div>

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
                        <span className="flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded" title="Legacy funding indicator. Check the live status page for verified official accreditation evidence.">
                          <WalletCards className="w-3 h-3 mr-1" />
                          NSFAS funding context
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
                    <Button variant="outline" className="w-full" asChild><Link to={`/res/${residence.id}`}>View & Apply</Link></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No verified listings are loaded for this campus yet. Use Find My Res to search the live accommodation inventory.</p>
                <Button asChild><Link to="/find">Search Accommodation</Link></Button>
              </CardContent>
            </Card>
          )}
        </section>

        <SEOTextBlock
          title={`Living Near ${campusName}`}
          content={[
            `ResKonnect helps students compare accommodation near ${campusName} using current property details such as location, price, room type and availability.`,
            "Funding acceptance and official accreditation are not treated as the same thing. Check the evidence-controlled NSFAS status page when current accreditation is important to your placement.",
            `Amenities vary by property and can include WiFi, access control, study areas and communal facilities. Read the actual listing and verify the funding route that applies before committing.`,
          ]}
        />
      </div>
    </PublicLayout>
  );
};

export default CampusLanding;
