import SEO from "@/components/SEO";
import CommunicationEmailWorkspace from "@/components/communications/CommunicationEmailWorkspace";

export default function ResidenceCommunications() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SEO noIndex title="Email & Gmail | Residence Portal | ResKonnect"
        description="Manage Gmail connectivity and protected email communication for your residence." />
      <div>
        <p className="text-sm font-bold text-primary">Landlord Portal · Communications</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Email & Gmail</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Send applicants reservation updates, feedback and accommodation enquiry responses from your connected Gmail.
          ResKonnect resolves the recipient securely without revealing personal email addresses to landlords.
        </p>
      </div>
      <CommunicationEmailWorkspace mode="landlord"/>
    </div>
  );
}
