import {useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {Download,ShieldCheck} from "lucide-react";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
type Invoice={
 id:string;invoice_number:string;product_code:string;quantity:number;billing_unit:string;
 subtotal_cents:number;unit_price_cents:number;tax_rate_percent:number;tax_inclusive:boolean;
 tax_cents:number;total_cents:number;currency:string;status:string;due_date:string;issued_at:string;
 settlement_method:string|null;issuer_snapshot:Record<string,any>;recipient_snapshot:Record<string,any>;
};
const money=(n:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n/100);
export default function ResKonnectInvoiceDocument(){
 const {invoiceId}=useParams<{invoiceId:string}>(),{user}=useAuth();
 const [invoice,setInvoice]=useState<Invoice|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  if(!user||!invoiceId){setLoading(false);return;}
  let active=true;setLoading(true);
  void (supabase as any).from("reskonnect_commercial_invoices")
   .select("id,invoice_number,product_code,quantity,billing_unit,subtotal_cents,unit_price_cents,tax_rate_percent,tax_inclusive,tax_cents,total_cents,currency,status,due_date,issued_at,settlement_method,issuer_snapshot,recipient_snapshot")
   .eq("id",invoiceId).maybeSingle()
   .then(({data,error}:any)=>{if(!active)return;setInvoice(data);setError(error?.message||(!data?"Invoice not available to this account":""));setLoading(false);});
  return()=>{active=false;};
 },[invoiceId,user?.id]);
 const issuer=invoice?.issuer_snapshot||{},buyer=invoice?.recipient_snapshot||{};
 const subtotal=invoice?(invoice.tax_inclusive?invoice.subtotal_cents-invoice.tax_cents:invoice.subtotal_cents):0;
 return <DashboardLayout>
  <SEO noIndex title="ResKonnect Official Invoice" description="Secure official commercial billing invoice."/>
  <style>{'@media print{@page{size:A4;margin:14mm}body *{visibility:hidden!important}#rk-print-invoice,#rk-print-invoice *{visibility:visible!important}#rk-print-invoice{position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important;background:#fff!important;color:#000!important}#rk-print-invoice .rk-hide-print{display:none!important}}'}</style>
  <main className="mx-auto max-w-4xl px-4 py-10">
   <div className="rk-hide-print mb-5 flex flex-wrap justify-between gap-3"><Button variant="outline" asChild><Link to="/residence/billing">Back to billing</Link></Button>
    {invoice&&<Button onClick={()=>window.print()}><Download className="mr-2 h-4 w-4"/>Print / save PDF</Button>}</div>
   {loading?<p role="status" className="py-16 text-center text-muted-foreground">Loading secure invoice…</p>
    :!user?<div className="rounded-2xl border p-8 text-center"><h1 className="text-xl font-black">Sign in to view your invoice</h1><Button asChild className="mt-4"><Link to={"/auth?returnTo="+encodeURIComponent("/commercial/invoice/"+invoiceId)}>Sign in</Link></Button></div>
    :!invoice?<div className="rounded-2xl border p-8 text-center"><h1 className="text-xl font-black">Invoice unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error||"You do not have permission to view this record."}</p></div>
    :<article id="rk-print-invoice" className="overflow-hidden rounded-2xl border bg-white text-[#001630] shadow-xl">
      <header className="bg-[#000F2F] px-7 py-8 text-white sm:px-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E09008]">Official commercial invoice</p>
       <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><h1 className="text-4xl font-black tracking-tight">ResKonnect<span className="text-[#E09008]">.</span></h1>
        <div className="text-right"><p className="text-sm font-bold">{invoice.invoice_number}</p><p className="mt-1 text-xs text-white/65">Issued {new Date(invoice.issued_at).toLocaleDateString("en-ZA")}</p></div></div>
      </header>
      <div className="space-y-8 p-7 sm:p-10">
       <div className="flex flex-wrap items-start justify-between gap-6"><div className="space-y-1 text-sm"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Issued by</p>
         <p className="font-black">{issuer.legal_name}</p><p className="whitespace-pre-line text-slate-600">{issuer.registered_address}</p><p>{issuer.billing_email}</p>
         {issuer.company_registration&&<p>Registration: {issuer.company_registration}</p>}
         {issuer.vat_number&&<p>VAT registration: {issuer.vat_number}</p>}</div>
        <div className="space-y-1 text-sm"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Bill to</p>
         <p className="font-black">{buyer.legal_name}</p><p className="whitespace-pre-line text-slate-600">{buyer.billing_address}</p><p>{buyer.billing_email}</p>
         {buyer.vat_number&&<p>VAT registration: {buyer.vat_number}</p>}</div></div>
       <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4"><div><p className="text-xs text-slate-500">Invoice number</p><p className="font-bold">{invoice.invoice_number}</p></div>
         <div><p className="text-xs text-slate-500">Due date</p><p className="font-bold">{invoice.due_date}</p></div>
         <div><p className="text-xs text-slate-500">Currency</p><p className="font-bold">{invoice.currency}</p></div>
         <div><p className="text-xs text-slate-500">Status</p><Badge variant={invoice.status==="paid"?"default":"outline"}>{invoice.status.replaceAll("_"," ")}</Badge></div></div>
       <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">
        <thead className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="py-3 pr-2">Service</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit price</th><th className="py-3 pl-3 text-right">Amount</th></tr></thead>
        <tbody><tr className="border-b"><td className="py-4 pr-2 font-semibold">{invoice.product_code.replaceAll("_"," ")}</td><td className="p-3 text-right">{invoice.quantity}</td><td className="p-3 text-right">{money(invoice.unit_price_cents)}</td><td className="py-3 pl-3 text-right">{money(invoice.subtotal_cents)}</td></tr></tbody>
       </table></div>
       <div className="ml-auto max-w-xs space-y-3 text-sm"><div className="flex justify-between gap-5"><span>Amount excluding VAT</span><strong>{money(subtotal)}</strong></div>
        <div className="flex justify-between gap-5"><span>VAT ({invoice.tax_rate_percent}%)</span><strong>{money(invoice.tax_cents)}</strong></div>
        <div className="flex justify-between gap-5 border-t-2 border-[#E09008] pt-3 text-lg font-black"><span>Total due</span><span>{money(invoice.total_cents)}</span></div>
        <p className="text-right text-xs text-slate-500">Tax is {invoice.tax_inclusive?"included in":"added to"} the configured service price.</p></div>
       {invoice.status!=="paid"&&issuer.bank_payment_instructions&&<div className="rounded-xl border border-[#E09008]/40 bg-amber-50 p-4"><h3 className="font-bold">Approved EFT payment instructions</h3><p className="mt-2 whitespace-pre-line text-sm">{issuer.bank_payment_instructions}</p><p className="mt-2 text-xs">Use the exact invoice number as your payment reference. Payment remains under finance review until independently verified.</p></div>}
       {invoice.status==="paid"&&<p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4"/>Marked paid after {invoice.settlement_method==="manual_verified_eft"?"manual bank verification":"finance reconciliation"}.</p>}
       <footer className="border-t pt-5 text-xs leading-5 text-slate-500">ResKonnect official business invoice · All figures in South African rand (ZAR). A reservation interest or sponsorship does not guarantee accommodation placement or university accreditation. Retain this document for your records.</footer>
      </div>
    </article>}
  </main>
 </DashboardLayout>;
}
