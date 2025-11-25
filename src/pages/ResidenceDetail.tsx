
import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, DollarSign, Users, Bed, ShieldCheck, Wifi, Car, WashingMachine, Dumbbell, Utensils } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

const ResidenceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [residence, setResidence] = useState<any>(null);
  const [relatedResidences, setRelatedResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResidence = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('public_residences').select('*').eq('id', id).single();
        if (error) throw error;
        setResidence(data);

        if (data) {
          const { data: related, error: relatedError } = await supabase
            .from('public_residences')
            .select('*')
            .eq('campus', data.campus)
            .neq('id', data.id)
            .limit(5);
          if (relatedError) throw relatedError;
          setRelatedResidences(related || []);
        }

      } catch (error) {
        console.error('Error fetching residence:', error);
        toast.error('Failed to load residence details.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidence();
  }, [id]);

  if (loading) {
    return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  }

  if (!residence) {
    return <DashboardLayout><div className="p-8">Residence not found.</div></DashboardLayout>;
  }

  const accommodationSchema = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    "name": residence.name,
    "description": residence.description,
    "image": residence.image_url,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": residence.address,
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "postalCode": "0002",
      "addressCountry": "ZA"
    },
    "amenityFeature": residence.amenities?.map((amenity: string) => ({
      "@type": "LocationFeatureSpecification",
      "name": amenity,
      "value": true
    })),
    "url": `https://reskonnect.co.za/res/${residence.id}`
  };

  const amenityIcons: { [key: string]: React.ReactNode } = {
    "WiFi": <Wifi className="w-4 h-4" />,
    "Parking": <Car className="w-4 h-4" />,
    "Security": <ShieldCheck className="w-4 h-4" />,
    "Study Room": <Users className="w-4 h-4" />,
    "Laundry": <WashingMachine className="w-4 h-4" />,
    "Gym": <Dumbbell className="w-4 h-4" />,
    "Pool": <Users className="w-4 h-4" />,
    "Kitchen": <Utensils className="w-4 h-4" />
  };

  return (
    <DashboardLayout>
      <SEO
        title={`${residence.name} | ResKonnect`}
        description={residence.description}
        imageUrl={residence.image_url}
      >
        <script type="application/ld+json">
          {JSON.stringify(accommodationSchema)}
        </script>
      </SEO>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb className="mb-4">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/find">Residences</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink>{residence.name}</BreadcrumbLink>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                  <div>
                      <CardTitle className="text-3xl font-bold">{residence.name}</CardTitle>
                      <div className="flex items-center text-muted-foreground mt-2">
                          <MapPin className="w-4 h-4 mr-2" />
                          {residence.address}
                      </div>
                  </div>
                  <div className="mt-4 md:mt-0">
                      <Button size="lg">Apply Now</Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <img src={residence.image_url} alt={residence.name} className="w-full h-96 object-cover rounded-lg mb-8" />
                        <h3 className="text-xl font-bold mb-4">Description</h3>
                        <p className="text-muted-foreground mb-8">{residence.description}</p>
                        <h3 className="text-xl font-bold mb-4">Amenities</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {residence.amenities?.map((amenity: string) => (
                                <div key={amenity} className="flex items-center space-x-2">
                                    {amenityIcons[amenity] || <Bed className="w-4 h-4" />}
                                    <span>{amenity}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Card className="bg-card/50">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">Details</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Price</span>
                                        <span className="font-bold text-primary text-xl">R{residence.price.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Available Spots</span>
                                        <span className="font-bold">{residence.available_spots || 0} / {residence.capacity}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Distance</span>
                                        <span className="font-bold">{residence.distance_from_campus}km</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Room Type</span>
                                        <span className="font-bold capitalize">{residence.room_type}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </CardContent>
          </Card>

        <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Related Residences</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedResidences.map((res) => (
                    <Link to={`/res/${res.id}`} key={res.id}>
                        <Card className="hover:shadow-lg transition-shadow">
                            <img src={res.image_url} alt={res.name} className="w-full h-48 object-cover rounded-t-lg" />
                            <CardContent className="p-4">
                                <h3 className="text-lg font-bold">{res.name}</h3>
                                <p className="text-muted-foreground text-sm">{res.address}</p>
                                <div className="flex items-center justify-between mt-4">
                                    <span className="font-bold text-primary">R{res.price.toLocaleString()}</span>
                                    <Button size="sm" variant="outline">View</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>

        <div className="mt-12">
            <Card className="bg-card/50">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Your Home Away From Home</h3>
                    <p className="text-muted-foreground text-sm">
                    Located near leading campuses, this residence offers convenient student living with modern amenities, high-speed WiFi, laundry facilities, and a supportive community. We prioritize safety with 24/7 security and access control. Our goal is to provide a comfortable and conducive environment for your academic success.
                    </p>
                </CardContent>
            </Card>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default ResidenceDetail;
