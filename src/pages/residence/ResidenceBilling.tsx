import {useCallback,useEffect,useState} from "react";
import {Link,useOutletContext} from "react-router-dom";
import {Banknote,CheckCircle2,FileText,RefreshCw,ShieldCheck,Sparkles} from "lucide-react";
import {toast} from "sonner";
import SEO from "@/components/SEO";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import ResKonnectBillingProfileForm from "@/components/commerce/ResKonnectBillingProfileForm";
import type {ResidencePortalContext} from "./ResidenceLayout";

type Invoice={id:string;invoice_number:string;product_code:string;quantity:number;total_cents:number;status:string;due_date:string;issued_at:string;payment_reference:string|null};
type Plan={code:string;name:string;description:string;unit_price_cents:number|null;billing_unit:string;vat_rate_percent:number|null;tax_inclusive:boolean};
type Promotion={id:string;title:string;placement:string;status:string;starts_at:string;ends_at:string};
const money=(x:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(x/100);
export default function ResidenceBilling(){
 const {residence}=useOutletContext<ResidencePortalContext>();
 const [invoices,setInvoices]=useState<Invoice[]>([]),[plans,setPlans]=useState<Plan[]>([]);
 const [promotions,setPromotions]=useState<Promotion[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [paymentId,setPaymentId]=useState<string|null>(null),[reference,setReference]=useState("");
 const [page,setPage]=useState(0),[total,setTotal]=useState(0);
 const load=useCallback(async()=>{
  if(!residence?.id)return;setLoading(true);
  const db=supabase as any;
  const [inv,p,pr]=await Promise.all([
   db.from("reskonnect_commercial_invoices")
    .select("id,invoice_number,product_code,quantity,total_cents,status,due_date,issued_at,payment_reference",{count:"exact"})
    .eq("residence_id",residence.id).order("issued_at",{ascending:false}).range(page*30,page*30+29),
   db.from("reskonnect_commercial_products").select("code,name,description,unit_price_cents,billing_unit,vat_rate_percent,tax_inclusive").eq("is_active",true).order("name"),
   db.from("reskonnect_commercial_promotions").select("id,title,placement,status,starts_at,ends_at").eq("residence_id",residence.id).order("starts_at",{ascending:false}).limit(30)
  ]);
  if(inv.error)toast.error(inv.error.message);else{setInvoices(inv.data||[]);setTotal(inv.count||0);}
  if(!p.error)setPlans(p.data||[]);
  if(!pr.error)setPromotions(pr.data||[]);
  setLoading(false);
 },[residence?.id,page]);
 useEffect(()=>{void load();},[load]);
 const sendReference=async()=>{
  if(!paymentId||reference.trim().length<6)return toast.error("Enter your actual EFT reference (at least six characters).");
  setBusy(true);
  const {error}=await (supabase as any).rpc("reskonnect_submit_invoice_payment_reference",{p_invoice_id:paymentId,p_reference:reference.trim()});
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Payment reference received for finance review. This is not confirmation of payment.");
  setPaymentId(null);setReference("");void load();
 };
 if(!residence)return <p className="py-12 text-center text-sm text-muted-foreground">Loading your residence billing workspace…</p>;
 return <div className="mx-auto max-w-6xl space-y-5 pb-16">
  <SEO noIndex title={"Billing & Sponsorship | "+residence.name+" | ResKonnect"} description="Manage your ResKonnect residence billing details, invoices and approved sponsorships."/>
  <div className="rounded-2xl bg-[#000F2F] p-5 text-white"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F5B32F]"><ShieldCheck className="h-4 w-4"/>Verified ResKonnect commercial operations</p><h1 className="mt-2 text-3xl font-black">Billing & Sponsorships</h1>
   <p className="mt-2 text-sm text-white/70">Transparent prices, protected invoices and manual EFT reconciliation. No card billing or recurring subscription is enabled by completing a billing profile.</p></div>
  <ResKonnectBillingProfileForm residenceId={residence.id} onSaved={()=>void load()}/>
  <Card><CardHeader><CardTitle>Available ResKonnect offerings</CardTitle><p className="text-xs text-muted-foreground">Only services formally configured and activated by ResKonnect appear here. This is informational; activation and billing require separate authorization.</p></CardHeader><CardContent>
   {plans.length===0?<div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Commercial pricing is not currently published. No listing or payment subscription has been activated.</div>:<div className="grid gap-3 sm:grid-cols-2">{plans.map(plan=><div key={plan.code} className="rounded-xl border p-4">
    <p className="font-bold">{plan.name}</p><p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
    <p className="mt-3 text-xl font-black">{money(plan.unit_price_cents||0)}</p><p className="text-xs text-muted-foreground">{plan.billing_unit.replaceAll("_"," ")} · configured VAT {plan.vat_rate_percent ?? 0}% {plan.tax_inclusive?"included":"excluded"}</p>
   </div>)}</div>}
  </CardContent></Card>
  <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>Your official invoices</CardTitle><Button size="sm" variant="outline" disabled={loading} onClick={()=>void load()}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button></div>
   <p className="text-xs text-muted-foreground">An EFT reference is evidence for review, not a verified payment. Only ResKonnect finance can mark an actual bank-confirmed invoice as paid.</p></CardHeader><CardContent className="space-y-3">
   {loading?<p className="text-sm text-muted-foreground">Loading invoices…</p>:invoices.length===0?<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">You have not been issued any ResKonnect commercial invoices.</p>:invoices.map(inv=><div key={inv.id} className="space-y-2 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{inv.invoice_number}</p><p className="text-xs text-muted-foreground">{inv.product_code.replaceAll("_"," ")} · Due {inv.due_date}</p></div>
     <div className="text-right"><p className="text-lg font-black">{money(inv.total_cents)}</p><Badge variant={inv.status==="paid"?"default":"outline"}>{inv.status.replaceAll("_"," ")}</Badge></div></div>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to={"/commercial/invoice/"+inv.id}><FileText className="mr-2 h-4 w-4"/>View / save invoice PDF</Link></Button>
     {["issued","payment_review"].includes(inv.status)&&<Button size="sm" onClick={()=>{setPaymentId(inv.id);setReference(inv.payment_reference||"");}}><Banknote className="mr-2 h-4 w-4"/>Submit EFT reference</Button>}</div>
   </div>)}
   {paymentId&&<div className="space-y-3 rounded-xl border border-amber-500/30 p-4">
    <Label htmlFor="rk-eft-ref">Actual bank EFT reference</Label><Input id="rk-eft-ref" value={reference} maxLength={140} onChange={e=>setReference(e.target.value)} placeholder="Transaction reference from your bank"/>
    <p className="text-xs text-muted-foreground">Your reference goes to ResKonnect finance for independent verification. Never share banking PINs or passwords.</p>
    <div className="flex gap-2"><Button disabled={busy} onClick={()=>void sendReference()}>{busy?"Submitting…":"Request reconciliation"}</Button><Button variant="outline" onClick={()=>setPaymentId(null)}>Cancel</Button></div>
   </div>}
   <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{total} invoices · Page {page+1}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button size="sm" variant="outline" disabled={(page+1)*30>=total} onClick={()=>setPage(p=>p+1)}>Next</Button></div></div>
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Promotional placements</CardTitle>
    <p className="text-xs text-muted-foreground">These are labelled Sponsored wherever shown publicly. Placement approvals and financial records are controlled by ResKonnect.</p>
  </CardHeader><CardContent>{promotions.length===0?<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No sponsored listing placements have been requested or approved for this residence.</p>
   :<div className="space-y-2">{promotions.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
    <div><strong>{p.title}</strong><p className="mt-1 text-xs text-muted-foreground">{p.placement} · {new Date(p.starts_at).toLocaleDateString("en-ZA")} – {new Date(p.ends_at).toLocaleDateString("en-ZA")}</p></div>
    <Badge variant={p.status==="approved"?"default":"outline"}>{p.status==="approved"?"Sponsored · Approved":p.status}</Badge>
   </div>)}</div>}
  </CardContent></Card>
 </div>;
}
