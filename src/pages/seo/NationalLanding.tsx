import React from 'react';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import DashboardLayout from '@/components/DashboardLayout';
import { residences } from '@/data/residences'; // Assuming you have this data file
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";

const NationalLanding: React.FC = () => {
    const bedCount = residences.reduce((acc, r) => acc + r.bedCount, 0);

    const title = "South Africa Student Accommodation | ResKonnect";
    const description = `Find student accommodation across South Africa with ResKonnect. Browse verified residences, compare options, and start your application online. Capacity info: ${bedCount} beds listed.`;

    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "South Africa Student Residences",
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
                            <BreadcrumbLink>South Africa Student Accommodation</BreadcrumbLink>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <h1 className="text-3xl font-bold mb-4">South Africa Student Accommodation</h1>
                <p className="text-lg text-muted-foreground mb-8">
                    South Africa has a variety of student residences. ResKonnect lists local residences
                    such as {residences.slice(0, 3).map(r => r.name).join(', ')}, and more.
                </p>
                <SEOTextBlock
                    title="Nationwide Student Housing"
                    content={[
                        `ResKonnect is your ultimate resource for finding student accommodation anywhere in South Africa. We offer a comprehensive database of residences, making it easy to find a place that fits your budget and lifestyle, no matter where you choose to study.`,
                        `From Cape Town to Johannesburg, and everywhere in between, our platform connects you with safe and reliable student housing. Start your search today and find your home away from home.`
                    ]}
                />
            </div>
        </DashboardLayout>
    );
};

export default NationalLanding;
