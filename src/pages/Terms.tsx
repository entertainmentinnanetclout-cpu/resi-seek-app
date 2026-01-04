import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Terms and Conditions | ResKonnect"
        description="Read the terms and conditions for using ResKonnect student accommodation platform."
      />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms and Conditions</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using ResKonnect, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground">
                ResKonnect is a platform that connects students with accommodation providers. We facilitate the search, comparison, and application process for student housing. We do not own or manage any properties listed on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>You must provide accurate and truthful information during registration and application processes.</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                <li>You must be a registered student at a recognized South African tertiary institution to use certain features.</li>
                <li>You agree not to misuse the platform or engage in fraudulent activities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Privacy and Data Protection</h2>
              <p className="text-muted-foreground">
                Your privacy is important to us. We collect and process personal data in accordance with the Protection of Personal Information Act (POPIA). Please refer to our Privacy Policy for detailed information on how we handle your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Accommodation Listings</h2>
              <p className="text-muted-foreground">
                While we strive to ensure all listings are accurate and verified, ResKonnect does not guarantee the accuracy, quality, or availability of any accommodation. Users should conduct their own due diligence before entering into any rental agreements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                ResKonnect shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of our platform or any accommodation arrangements made through it. Our role is solely to facilitate connections between students and accommodation providers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, trademarks, and intellectual property on ResKonnect are owned by or licensed to us. You may not reproduce, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Modifications to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notifications.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Governing Law</h2>
              <p className="text-muted-foreground">
                These terms are governed by the laws of the Republic of South Africa. Any disputes shall be resolved in the courts of South Africa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these Terms and Conditions, please contact us at support@reskonnect.co.za
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;