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
   <span>Only the Google account you approve can send from that address. If Google says the app is unavailable or not verified, ask ResKonnect onboarding support to check the Google app publishing and verification settings. Do not share your password or verification codes.</span>
  </div>
 </section>;
}
