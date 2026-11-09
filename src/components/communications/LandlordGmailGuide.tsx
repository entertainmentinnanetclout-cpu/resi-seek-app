import {CheckCircle2,ExternalLink,Link2,Mail,ShieldCheck} from "lucide-react";
import {Button} from "@/components/ui/button";

type Props={
 connected:boolean;
 email:string|null;
 busy:boolean;
 onConnect:()=>void;
 onRefresh:()=>void;
};

/** Landlords authorize their own sender mailbox using ResKonnect's Google OAuth app. */
export default function LandlordGmailGuide({connected,email,busy,onConnect,onRefresh}:Props){
 const steps=[
  {title:"Choose your residence email",copy:"Use the inbox you want students to see, e.g. bookings@yourresidence.co.za."},
  {title:"Connect with Google",copy:"Select Connect Gmail below. You will be redirected securely to Google."},
  {title:"Choose account and allow sending",copy:"Sign in to that mailbox and approve ResKonnect's send-only permission. No email password is shared with ResKonnect."},
  {title:"Return and verify",copy:"When Google returns you here, check that the linked email shown below is correct."}
 ];
 return <section className="overflow-hidden rounded-2xl border border-[#d9dfe8] bg-white text-[#10213a] shadow-sm" aria-label="Connect residence email in four steps">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ebf0] px-5 py-4">
   <div>
    <p className="text-[11px] font-medium uppercase tracking-[.17em] text-[#9c782e]">Landlord email setup</p>
    <h3 className="mt-1 text-lg font-semibold tracking-tight">Connect your email in 4 simple steps</h3>
    <p className="mt-1 max-w-2xl text-sm text-[#657287]">ResKonnect provides the Google application. You only connect your own Gmail or Google Workspace mailbox.</p>
   </div>
   <div className="flex items-center gap-2 text-xs">
    {connected?<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Connected</span>:
     <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800"><Mail className="h-4 w-4"/>Not connected</span>}
   </div>
  </div>
  <ol className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Google email connection steps">
   {steps.map((step,i)=><li key={step.title} className="min-w-0 rounded-xl border border-[#e7e9ef] bg-[#fcfcfd] p-4">
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#dbb35e] bg-[#fffaf0] text-sm font-semibold text-[#8e6c26]">{i+1}</span>
    <p className="mt-3 text-sm font-semibold text-[#122540]">{step.title}</p>
    <p className="mt-1.5 text-xs leading-5 text-[#627085]">{step.copy}</p>
   </li>)}
  </ol>
  <div className="flex flex-wrap items-center gap-3 border-t border-[#e8ebf0] bg-[#fbfbfc] px-5 py-4">
   {connected?<div className="flex min-w-0 items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700"/><span className="break-all">Sending from <strong className="font-semibold">{email||"your connected mailbox"}</strong></span></div>:
   <Button type="button" onClick={onConnect} disabled={busy} className="bg-[#0b2444] text-white hover:bg-[#15385f]"><Link2 className="mr-2 h-4 w-4"/>Connect Gmail securely</Button>}
   <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={busy}>Check connection</Button>
   <a className="inline-flex items-center gap-1 text-xs font-medium text-[#1c4b81] underline underline-offset-4" href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Open Gmail <ExternalLink className="h-3 w-3"/></a>
   <a className="inline-flex items-center gap-1 text-xs font-medium text-[#1c4b81] underline underline-offset-4" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Manage Google permissions <ExternalLink className="h-3 w-3"/></a>
  </div>
  <div className="flex items-start gap-2 border-t border-[#e8ebf0] px-5 py-3 text-xs leading-5 text-[#64748b]">
   <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#977338]"/>
   <span>Only the Google mailbox you authorize can send on your behalf. Google may show an <strong>unverified app</strong> warning while ResKonnect's application is awaiting Google's OAuth approval. This is not a problem with your mailbox, and the warning cannot be removed by a landlord or by clicking inside ResKonnect. Contact ResKonnect onboarding support instead of bypassing an unexpected Google security warning. Do not share your password or verification codes.</span>
  </div>
  <details className="group border-t border-[#e8ebf0] px-5 py-4 text-xs text-[#52637d]">
    <summary className="cursor-pointer font-semibold text-[#10213a]">ResKonnect administrator: Google app verification and inbox delivery checklist</summary>
    <div className="mt-3 space-y-3 leading-6">
      <p>The OAuth client is owned by ResKonnect. Landlords do not need their own Google Cloud API keys. The Gmail send-only permission is a <strong>sensitive scope</strong>, so an external production application must complete Google's review before the verification warning disappears.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li><a className="font-medium text-[#1c4b81] underline" href="https://console.cloud.google.com/auth/branding" target="_blank" rel="noopener noreferrer">Open Google Auth Platform · Branding</a>. Select the ResKonnect Google project; set the app name, support contact, authorized domain and public <a href="https://www.reskonnect.org/privacy" className="underline">Privacy Policy</a> and <a href="https://www.reskonnect.org/terms" className="underline">Terms</a>. Verify domain ownership and publish the branding.</li>
        <li><a className="font-medium text-[#1c4b81] underline" href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noopener noreferrer">Open Audience</a>. Use the External production app configuration when onboarding landlords outside one Workspace organization; keep test accounts separate.</li>
        <li><a className="font-medium text-[#1c4b81] underline" href="https://console.cloud.google.com/auth/data-access" target="_blank" rel="noopener noreferrer">Open Data Access</a>. Declare the exact scopes used by ResKonnect: <code>openid</code>, <code>email</code> and <code>gmail.send</code>. The integration does not request inbox read access.</li>
        <li><a className="font-medium text-[#1c4b81] underline" href="https://console.cloud.google.com/auth/verification" target="_blank" rel="noopener noreferrer">Open Verification Center</a>. Submit Google's sensitive-scope review with a real connection-flow demonstration and justification, then respond to Google's review requests. Google—not ResKonnect—decides when the warning can be removed.</li>
      </ol>
      <p>Inbox placement is a separate issue. Use the actual connected mailbox as the sender; for a residence domain, configure SPF, DKIM and DMARC with its mail provider, and check Gmail's <a className="text-[#1c4b81] underline" href="https://support.google.com/mail/answer/81126" target="_blank" rel="noopener noreferrer">sender guidelines</a>. Avoid misleading sender names and only send relevant, consented case notices. Delivery to Inbox cannot be guaranteed.</p>
    </div>
  </details>
 </section>;
}
