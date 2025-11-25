import React from 'react';
import { useParams } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import DashboardLayout from '@/components/DashboardLayout';
import { residences } from '@/data/residences'; // Assuming you have this data file
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";

const CampusLanding: React.FC = () => {
    const { campus } = useParams<{ campus: string }>();
    const campusName = campus ? campus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace('Tut', 'TUT') : '';

    // This is a simplified filtering logic. You might need a more robust way to associate residences with campuses.
    const filteredResidences = residences.filter(r => r.campus.toLowerCase() === campusName.toLowerCase());
    const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);

    const title = `${campusName} Accommodation | ResKonnect`;
    const description = `Find student accommodation near ${campusName} with ResKonnect. Browse verified residences, compare options, and start your application online. Capacity info: ${bedCount} beds listed.`;

    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `${campusName} Student Residences`,
        "itemListElement": filteredResidences.map((residence, index) => ({
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

    return (
        <DashboardLayout>
            <SEO title={title} description={description} />
            <SEOJsonLd schema={itemListSchema} />
            <div className="p-4 md:p-8">
                <Breadcrumb className="mb-4">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink>{campusName}</BreadcrumbLink>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <h1 className="text-3xl font-bold mb-4">{campusName} Accommodation</h1>
                <p className="text-lg text-muted-foreground mb-8">
                    {campusName} has a variety of student residences. ResKonnect lists local residences
                    such as {filteredResidences.slice(0, 3).map(r => r.name).join(', ')}, and more.
                </p>
                <SEOTextBlock
                    title={`Living Near ${campusName}`}
                    content={[
                        `Explore a range of student accommodation conveniently located near ${campusName}. ResKonnect offers a variety of choices to suit your needs, from single rooms to shared apartments, helping you find a comfortable and secure home for your studies.`,
                        `Our platform simplifies the process of finding and applying for accommodation. Browse our listings and find your ideal student residence near ${campusName} today.`
                    ]}
                />
            </div>
        </DashboardLayout>
    );
};

export default CampusLanding;
