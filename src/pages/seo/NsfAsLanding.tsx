import React from 'react';
import SEO from '@/components/SEO';
import SEOJsonLd from '@/components/SEOJsonLd';
import SEOTextBlock from '@/components/SEOTextBlock';
import DashboardLayout from '@/components/DashboardLayout';
import { residences } from '@/data/residences'; // Assuming you have this data file
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";

const NsfAsLanding: React.FC = () => {
    const filteredResidences = residences.filter(r => r.nsfas_accredited);
    const bedCount = filteredResidences.reduce((acc, r) => acc + r.bedCount, 0);

    const title = "NSFAS Accredited Accommodation | ResKonnect";
    const description = `Find NSFAS accredited accommodation with ResKonnect. Browse verified residences that meet NSFAS standards and start your application online. Capacity info: ${bedCount} beds listed.`;

    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "NSFAS Accredited Student Residences",
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
                            <BreadcrumbLink>NSFAS Accredited Accommodation</BreadcrumbLink>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <h1 className="text-3xl font-bold mb-4">NSFAS Accredited Accommodation</h1>
                <p className="text-lg text-muted-foreground mb-8">
                    ResKonnect lists NSFAS accredited residences such as {filteredResidences.slice(0, 3).map(r => r.name).join(', ')}, and more.
                </p>
                <SEOTextBlock
                    title="Your Guide to NSFAS Housing"
                    content={[
                        `Finding accommodation that is accredited by NSFAS is simple with ResKonnect. We have a dedicated section for residences that meet the standards set by the National Student Financial Aid Scheme, ensuring you find a safe, comfortable, and approved place to live.`,
                        `Browse our listings of NSFAS accredited properties and apply with confidence, knowing that your chosen residence is recognized and supported by NSFAS.`
                    ]}
                />
            </div>
        </DashboardLayout>
    );
};

export default NsfAsLanding;
