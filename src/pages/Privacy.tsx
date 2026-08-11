import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy | ResKonnect"
        description="Learn how ResKonnect protects and handles your personal information."
      />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                ResKonnect is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in compliance with the Protection of Personal Information Act (POPIA).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Personal Information:</strong> Name, email address, phone number, student number, and identity document details.</li>
                <li><strong>Academic Information:</strong> Institution, campus, course, and year of study.</li>
                <li><strong>Documents:</strong> ID copies, proof of registration, and proof of funding for verification purposes.</li>
                <li><strong>Usage Data:</strong> Information about how you use our platform, including search preferences and application history.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>To provide and maintain our service</li>
                <li>To process your accommodation applications</li>
                <li>To match you with suitable roommates (if opted in)</li>
                <li>To communicate important updates and notifications</li>
                <li>To verify your student status</li>
                <li>To improve our platform and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
              <p className="text-muted-foreground">
                We share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li><strong>With Accommodation Providers:</strong> When you submit an application, relevant information is shared with the property owner/manager.</li>
                <li><strong>With Potential Roommates:</strong> Only if you opt into the Roommate Finder feature, limited profile information is shared.</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and access controls.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights Under POPIA</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Access:</strong> Request access to your personal information.</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information.</li>
                <li><strong>Deletion:</strong> Request deletion of your information (subject to legal retention requirements).</li>
                <li><strong>Objection:</strong> Object to the processing of your information for direct marketing.</li>
                <li><strong>Complaint:</strong> Lodge a complaint with the Information Regulator.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information only for as long as necessary to fulfill the purposes for which it was collected, comply with legal obligations, and resolve disputes. Inactive accounts may be deleted after 2 years of inactivity.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, and personalize content. You can manage cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Third-Party Services</h2>
              <p className="text-muted-foreground">
                Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of significant changes via email or platform notifications. Your continued use of the platform after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground">
                For privacy-related inquiries or to exercise your rights, please contact our Information Officer at:
              </p>
              <ul className="list-none pl-0 text-muted-foreground space-y-1 mt-2">
                <li>Email: reskonnect@gmail.com</li>
                <li>Address: ResKonnect, Pretoria, South Africa</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;