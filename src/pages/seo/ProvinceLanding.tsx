import React from 'react';
import { useParams } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import DashboardLayout from '@/components/DashboardLayout';
import { residences } from '@/data/residences'; // Assuming you have this data file
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";

const ProvinceLanding: React.FC = () => {
    const { province } = useParams<{ province: string }>();
    const provinceName = province ? province.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

    const filteredResidences = residences.filter(r => r.province.toLowerCase() === provinceName.toLowerCase());
    const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);

    const title = `${provinceName} Student Accommodation | ResKonnect`;
    const description = `Find student accommodation in ${provinceName} with ResKonnect. Browse verified residences listed on our platform, compare options, and start your application online. Capacity info: ${bedCount} beds listed.`;

    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `${provinceName} Student Residences`,
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
                            <BreadcrumbLink>{provinceName}</BreadcrumbLink>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <h1 className="text-3xl font-bold mb-4">{provinceName} Student Accommodation</h1>
                <p className="text-lg text-muted-foreground mb-8">
                    {provinceName} has a variety of student residences. ResKonnect lists local residences
                    such as {filteredResidences.slice(0, 3).map(r => r.name).join(', ')}, and more.
                </p>
                <SEOTextBlock
                    title={`Student Living in ${provinceName}`}
                    content={[
                        `Discover a wide range of student accommodation options in ${provinceName}. Whether you are looking for a single room, a shared apartment, or a residence with specific amenities, ResKonnect can help you find the perfect place to live while you study.`,
                        `Our platform connects you with verified residences, ensuring a safe and seamless booking experience. Explore your options and secure your student home in ${provinceName} today.`
                    ]}
                />
            </div>
        </DashboardLayout>
    );
};

export default ProvinceLanding;
