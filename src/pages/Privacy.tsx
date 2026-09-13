import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy | ResKonnect"
        description="How ResKonnect collects, uses, shares, protects and deletes personal information across the website and Android app."
        canonicalPath="/privacy"
      />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: 13 September 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6 dark:prose-invert">
            <section>
              <h2 className="mb-3 text-xl font-semibold">1. Scope</h2>
              <p className="text-muted-foreground">This policy applies to the ResKonnect website, Android app and connected ResKonnect services. ResKonnect processes personal information in accordance with applicable South African law, including POPIA, and applies data-minimisation and access-control measures appropriate to the service being used.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">2. Information we may collect</h2>
              <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li><strong>Account and contact data:</strong> name, email address, phone number, authentication identifiers and account-security status.</li>
                <li><strong>Student and application data:</strong> student or identity number where required, institution, campus, course, year/stage of study, funding context, accommodation preferences and application history.</li>
                <li><strong>Documents and user content:</strong> files you choose to upload, such as identity, registration, funding, application, payment or WIL documents, profile images, messages and service-request content.</li>
                <li><strong>Location:</strong> approximate or precise foreground location only when you choose a location-enabled function such as ResMap, nearby accommodation, routing or live navigation. ResKonnect does not request Android background location for the first Android release.</li>
                <li><strong>Camera/media:</strong> camera access only when you start a capture feature such as 360 Studio or choose to capture/upload content. Standard Android document/media pickers may also be used.</li>
                <li><strong>Usage and device information:</strong> app interactions, searches, feature usage, diagnostic/security events, referral/attribution information and technical information needed to operate and secure the platform.</li>
                <li><strong>Commercial information:</strong> order, discount, marketplace, payment-reference or proof-of-payment information when you use a relevant commercial service.</li>
              </ul>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">3. Why we use information</h2>
              <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Provide account, accommodation, application, WIL, opportunity, mapping and customer-service functions.</li>
                <li>Verify information and documents where verification is part of a service.</li>
                <li>Route applications or authorised records to the relevant residence, institution, partner or service team.</li>
                <li>Provide account-aware assistance, recommendations and next-step guidance.</li>
                <li>Prevent fraud, secure accounts, investigate abuse and maintain audit records.</li>
                <li>Communicate service updates and respond to support requests.</li>
                <li>Measure product performance and improve ResKonnect services.</li>
              </ul>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">4. Service providers and third parties</h2>
              <p className="text-muted-foreground">ResKonnect uses service providers to operate the platform. Depending on the feature you use, these can include Supabase for authentication/database/storage, Vercel for web hosting and delivery, Google services for sign-in or mapping, Twilio for authorised WhatsApp/phone-verification communications, and AI providers such as OpenAI for governed AI functions. We remain responsible for configuring these integrations and limiting the information sent to what is needed for the relevant function.</p>
              <p className="mt-3 text-muted-foreground">We may share relevant application information with an accommodation provider, institution, employer/programme partner or other service party when you initiate or authorise a workflow that requires that party. Limited roommate profile information is shown only when you opt into roommate features. We may also disclose information where required by law or to protect users, ResKonnect or others.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">5. AI processing</h2>
              <p className="text-muted-foreground">ResKonnect uses AI-assisted functions for guidance, search, summaries, customer support and internal operations. AI outputs do not replace official admission, funding, accommodation, employment or legal decisions. Protected account information is supplied only where the user is authenticated and the product is authorised to use that context. Users should not submit passwords or one-time passwords to AI or chat tools.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">6. Security</h2>
              <p className="text-muted-foreground">We use technical and organisational safeguards including authenticated access, row-level database controls, secure transport, role-based permissions, multi-factor controls for privileged functions, audit/security events and restricted server-side credentials. No internet-connected service can guarantee absolute security, so ResKonnect also monitors and improves controls as the platform changes.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">7. Retention</h2>
              <p className="text-muted-foreground">Information is retained only for as long as reasonably necessary for the service, legal obligations, fraud prevention, accounting, active transactions, disputes, audit requirements or other lawful purposes. When data no longer needs to identify you, it may be deleted or de-identified. A completed account-deletion request does not require ResKonnect to erase records that must lawfully be retained, but retained records will not be kept merely to maintain an active account.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">8. Your rights and account deletion</h2>
              <p className="text-muted-foreground">Subject to applicable law, you may request access, correction or deletion of personal information and may object to certain processing. ResKonnect provides an account-deletion request inside the signed-in profile and on a public web resource that remains available even after the Android app is uninstalled.</p>
              <Button asChild variant="outline" className="mt-3"><Link to="/delete-account">Open account & data deletion</Link></Button>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">9. Cookies, local storage and app storage</h2>
              <p className="text-muted-foreground">The website and app may use cookies, local/session storage or equivalent application storage for authentication state, preferences, security, attribution and resilient product operation. Sensitive server API responses are not intentionally persisted in the service-worker cache.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">10. Children</h2>
              <p className="text-muted-foreground">ResKonnect is designed for tertiary education, student-living and related applicant services and is not directed at children as a general-audience child service. Where an applicant is legally a minor, additional consent or institutional requirements may apply to particular services.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">11. Policy changes</h2>
              <p className="text-muted-foreground">We may update this policy when services, providers, legal requirements or data practices materially change. The current version and update date will remain available at this page.</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-semibold">12. Contact</h2>
              <p className="text-muted-foreground">For privacy-related requests or questions, contact ResKonnect at <strong>reskonnect@gmail.com</strong>, Pretoria, South Africa. Account deletion can be initiated directly at the link above.</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
