import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {BadgeCheck,Banknote,Building2,CalendarDays,CheckCircle2,FileText,Receipt,RefreshCw,ShieldCheck,Sparkles,WalletCards} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "@/contexts/AuthContext";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import ResKonnectBillingProfileForm from "./ResKonnectBillingProfileForm";

type Product={code:string;name:string;description:string;billing_unit:string;unit_price_cents:number|null;vat_rate_percent:number|null;tax_inclusive:boolean;is_active:boolean};
type Issuer={legal_name:string;billing_email:string;registered_address:string;company_registration:string;vat_number:string;bank_payment_instructions:string};
type Invoice={id:string;invoice_number:string;residence_id:string;product_code:string;quantity:number;total_cents:number;status:string;due_date:string;issued_at:string;payment_reference:string|null};
type Promotion={id:string;residence_id:string;title:string;description:string;placement:string;funding_basis:string;invoice_id:string|null;status:string;starts_at:string;ends_at:string};
const emptyIssuer:Issuer={legal_name:"",billing_email:"",registered_address:"",company_registration:"",vat_number:"",bank_payment_instructions:""};
const money=(cents:number|null|undefined)=>cents==null?"Not configured":new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(cents/100);
const datePlus=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const datetimeLocal=(days:number)=>{const d=new Date(Date.now()+days*86400000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function ProductEditor({product,onSaved,userId}:{product:Product;onSaved:()=>void;userId?:string}){
 const [price,setPrice]=useState(product.unit_price_cents===null?"":String(product.unit_price_cents/100));
 const [tax,setTax]=useState(product.vat_rate_percent===null?"":String(product.vat_rate_percent));
 const [active,setActive]=useState(product.is_active),[inclusive,setInclusive]=useState(product.tax_inclusive),[saving,setSaving]=useState(false);
 useEffect(()=>{setPrice(product.unit_price_cents==null?"":String(product.unit_price_cents/100));setTax(product.vat_rate_percent==null?"":String(product.vat_rate_percent));setActive(product.is_active);setInclusive(product.tax_inclusive);},[product]);
 const save=async()=>{
  if(!userId)return;
  const cents=price.trim()===""?null:Math.round(Number(price)*100);
  const rate=tax.trim()===""?null:Number(tax);
  if(cents!==null&&(!Number.isSafeInteger(cents)||cents<0))return toast.error("Enter a valid non-negative ZAR price.");
  if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))return toast.error("VAT rate must be configured explicitly between 0% and 100%.");
  if(active&&(cents==null||cents<=0||rate===null))return toast.error("Set an approved positive price and explicit tax rate before activating this product.");
  setSaving(true);
  const {error}=await (supabase as any).from("reskonnect_commercial_products").update({
   unit_price_cents:cents,vat_rate_percent:rate,tax_inclusive:inclusive,is_active:active,updated_by:userId,updated_at:new Date().toISOString()
  }).eq("code",product.code);
  setSaving(false);
  if(error)return toast.error(error.message);
  toast.success("Commercial product settings updated");onSaved();
 };
 return <div className="space-y-3 rounded-2xl border p-4">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-bold">{product.name}</h4><p className="mt-1 text-xs text-muted-foreground">{product.description}</p><p className="mt-1 text-xs text-muted-foreground">{product.billing_unit.replaceAll("_"," ")}</p></div>
   <Badge variant={active?"default":"secondary"}>{active?"Enabled":"Disabled"}</Badge></div>
  <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Approved price (R)</Label><Input inputMode="decimal" type="number" step="0.01" min="0" value={price} placeholder="Set price" onChange={e=>setPrice(e.target.value)}/></div>
  <div className="space-y-1"><Label>Approved VAT rate (%)</Label><Input type="number" step="0.01" min="0" max="100" value={tax} placeholder="No assumption" onChange={e=>setTax(e.target.value)}/></div></div>
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={inclusive} onCheckedChange={v=>setInclusive(v===true)}/> Price includes configured VAT</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={v=>setActive(v===true)}/> Activate this offering</label></div>
   <Button disabled={saving} size="sm" onClick={()=>void save()}>{saving?"Saving…":"Save product"}</Button></div>
 </div>;
}
export default function ResKonnectCommercialAdmin(){
 const {user}=useAuth(),[products,setProducts]=useState<Product[]>([]);
 const [residences,setResidences]=useState<{id:string;name:string}[]>([]),[selectedResidence,setSelectedResidence]=useState("");
 const [residenceSearch,setResidenceSearch]=useState("");
 const [issuer,setIssuer]=useState<Issuer>(emptyIssuer),[savingIssuer,setSavingIssuer]=useState(false);
 const [invoices,setInvoices]=useState<Invoice[]>([]),[invoicePage,setInvoicePage]=useState(0),[invoiceCount,setInvoiceCount]=useState(0);
 const [promotions,setPromotions]=useState<Promotion[]>([]),[busy,setBusy]=useState(false);
 const [productCode,setProductCode]=useState(""),[quantity,setQuantity]=useState("1"),[dueDate,setDueDate]=useState(datePlus(14));
 const [reconcileId,setReconcileId]=useState<string|null>(null),[bankReference,setBankReference]=useState(""),[auditNote,setAuditNote]=useState(""),[bankVerified,setBankVerified]=useState(false);
 const [sponsorTitle,setSponsorTitle]=useState(""),[sponsorDescription,setSponsorDescription]=useState("");
 const [sponsorPlacement,setSponsorPlacement]=useState("find"),[sponsorBasis,setSponsorBasis]=useState("complimentary"),[sponsorInvoice,setSponsorInvoice]=useState("");
 const [start,setStart]=useState(datetimeLocal(1)),[end,setEnd]=useState(datetimeLocal(15));
 const [paidSponsorInvoices,setPaidSponsorInvoices]=useState<{id:string;invoice_number:string}[]>([]);
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [p,i,r,pr]=await Promise.all([
   db.from("reskonnect_commercial_products").select("*").order("name"),
   db.from("reskonnect_commercial_issuer").select("*").maybeSingle(),
   db.from("residences").select("id,name").order("name").limit(1000),
   db.from("reskonnect_commercial_promotions").select("*").order("updated_at",{ascending:false}).limit(80)
  ]);
  if(p.error)toast.error(p.error.message);else setProducts(p.data||[]);
  if(i.data)setIssuer({legal_name:i.data.legal_name||"",billing_email:i.data.billing_email||"",registered_address:i.data.registered_address||"",company_registration:i.data.company_registration||"",vat_number:i.data.vat_number||"",bank_payment_instructions:i.data.bank_payment_instructions||""});
  if(!r.error)setResidences(r.data||[]);
  if(!pr.error)setPromotions(pr.data||[]);
 },[]);
 const loadInvoices=useCallback(async()=>{
  let q=(supabase as any).from("reskonnect_commercial_invoices")
    .select("id,invoice_number,residence_id,product_code,quantity,total_cents,status,due_date,issued_at,payment_reference",{count:"exact"})
    .order("issued_at",{ascending:false}).range(invoicePage*40,invoicePage*40+39);
  if(selectedResidence)q=q.eq("residence_id",selectedResidence);
  const {data,error,count}=await q;
  if(error)toast.error(error.message);else{setInvoices(data||[]);setInvoiceCount(count||0);}
 },[selectedResidence,invoicePage]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{void loadInvoices();},[loadInvoices]);
 useEffect(()=>{if(!selectedResidence)return;void (supabase as any).from("reskonnect_commercial_invoices").select("id,invoice_number")
 .eq("residence_id",selectedResidence).eq("product_code","sponsored_feature").eq("status","paid").limit(100)
 .then(({data}:any)=>setPaidSponsorInvoices(data||[]));},[selectedResidence,invoiceCount]);
 const matchedResidences=useMemo(()=>residences.filter(r=>r.name.toLowerCase().includes(residenceSearch.toLowerCase())).slice(0,35),[residences,residenceSearch]);
 const saveIssuer=async()=>{
  if(!user?.id)return;
  if(issuer.legal_name.trim().length<3||issuer.registered_address.trim().length<10||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issuer.billing_email))
    return toast.error("Issuer legal name, registered address and valid email are required.");
  setSavingIssuer(true);
  const {error}=await (supabase as any).from("reskonnect_commercial_issuer").upsert({singleton:true,...issuer,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"singleton"});
  setSavingIssuer(false);
  if(error)return toast.error(error.message);
  toast.success("Legal invoice issuer saved");void refresh();
 };
 const issueInvoice=async()=>{
  if(!selectedResidence||!productCode)return toast.error("Select a residence and an active offering.");
  const n=Number(quantity);
  if(!Number.isInteger(n)||n<1||n>10000)return toast.error("Enter a valid quantity.");
  setBusy(true);
  const {data,error}=await (supabase as any).rpc("reskonnect_issue_invoice",{
   p_residence_id:selectedResidence,p_product_code:productCode,p_quantity:n,p_due_date:dueDate
  });
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Immutable invoice issued. No payment has been charged.");void loadInvoices();
 };
 const reconcile=async(action:string)=>{
  if(!reconcileId)return;
  if(auditNote.trim().length<15)return toast.error("Document your reconciliation decision in at least 15 characters.");
  if(action==="verify_paid"&&!bankVerified)return toast.error("Check the actual bank records before confirming a payment.");
  setBusy(true);
  const {error}=await (supabase as any).rpc("reskonnect_reconcile_invoice",{
   p_invoice_id:reconcileId,p_action:action,p_bank_reference:bankReference,
   p_reconciliation_note:auditNote,p_verified_from_bank:action==="verify_paid"&&bankVerified
  });
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Invoice reconciliation audit saved");setReconcileId(null);setBankReference("");setAuditNote("");setBankVerified(false);void loadInvoices();
 };
 const createSponsor=async()=>{
  if(!user?.id||!selectedResidence||sponsorTitle.trim().length<4)return toast.error("Select a residence and enter a promotion title.");
  if(sponsorBasis==="paid_invoice"&&!sponsorInvoice)return toast.error("A verified paid promotion invoice is required.");
  if(!start||!end||new Date(start)>=new Date(end))return toast.error("Enter a valid promotion period.");
  setBusy(true);
  const {error}=await (supabase as any).from("reskonnect_commercial_promotions").insert({
   residence_id:selectedResidence,title:sponsorTitle.trim(),description:sponsorDescription.trim(),
   placement:sponsorPlacement,funding_basis:sponsorBasis,invoice_id:sponsorBasis==="paid_invoice"?sponsorInvoice:null,
   starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),status:"draft",created_by:user.id
  });
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Sponsored placement drafted, awaiting explicit approval.");setSponsorTitle("");setSponsorDescription("");void refresh();
 };
 const approveSponsor=async(promotion:Promotion,action:"approved"|"paused"|"cancelled")=>{
  if(action==="approved"&&!window.confirm("Approve this clearly disclosed Sponsored placement? Confirm residence images and the commercial basis were checked."))return;
  setBusy(true);
  const {error}=await (supabase as any).from("reskonnect_commercial_promotions").update({status:action,updated_at:new Date().toISOString()}).eq("id",promotion.id);
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Promotion status recorded");void refresh();
 };
 return <div className="space-y-7">
  <div className="rounded-2xl border bg-gradient-to-br from-[#000F2F] to-[#124270] p-5 text-white">
   <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F5B32F]"><ShieldCheck className="h-4 w-4"/>Finance-controlled commercial operations</div>
   <h2 className="mt-2 text-2xl font-black">ResKonnect Billing & Sponsorship OS</h2>
   <p className="mt-2 max-w-3xl text-sm text-white/75">Admin-approved pricing, VAT configuration, printable branded invoices, bank-verified EFT reconciliation and disclosed promotions. Card charges and recurring subscription collections remain disabled until merchant credentials and legal pricing are approved.</p>
  </div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5"/>ResKonnect legal invoice issuer</CardTitle>
   <p className="text-sm text-muted-foreground">Invoices cannot be issued until these legal details are configured. VAT registration is not assumed.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
   {([["legal_name","Legal issuer name"],["billing_email","Billing email"],["registered_address","Registered business address"],["company_registration","Registration number (optional)"],["vat_number","VAT number (if registered)"],["bank_payment_instructions","Verified EFT payment instructions (optional)"]] as const).map(([key,label])=><div key={key} className="space-y-1"><Label>{label}</Label><Input value={issuer[key]} maxLength={500} onChange={e=>setIssuer(old=>({...old,[key]:e.target.value}))}/></div>)}
   <div className="sm:col-span-2"><Button disabled={savingIssuer} onClick={()=>void saveIssuer()}>{savingIssuer?"Saving…":"Save issuer settings"}</Button></div>
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5"/>Approved commercial products</CardTitle>
   <p className="text-sm text-muted-foreground">All products initially disabled and unpriced. You must enter an authorized price and an explicit tax rate before enabling any offering.</p></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2">
   {products.map(product=><ProductEditor key={product.code} product={product} onSaved={()=>void refresh()} userId={user?.id}/>)}
  </CardContent></Card>
  <Card><CardHeader><CardTitle>Choose a residence for billing and sponsorships</CardTitle></CardHeader><CardContent className="space-y-3">
   <Input placeholder="Filter residences by name…" value={residenceSearch} onChange={e=>setResidenceSearch(e.target.value)}/>
   <Select value={selectedResidence||"none"} onValueChange={v=>{setSelectedResidence(v==="none"?"":v);setInvoicePage(0);}}>
    <SelectTrigger><SelectValue placeholder="Select residence"/></SelectTrigger><SelectContent>
     <SelectItem value="none">Select a residence</SelectItem>{matchedResidences.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
    </SelectContent></Select>
   {selectedResidence&&<ResKonnectBillingProfileForm key={selectedResidence} residenceId={selectedResidence} onSaved={()=>void loadInvoices()}/>}
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5"/>Issue a verified-price invoice</CardTitle>
   <p className="text-xs text-muted-foreground">Requires configured issuer, residence billing profile and active commercial product. Issuing an invoice does not debit the landlord or automatically enroll them in a recurring service.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-4">
   <div className="space-y-1 sm:col-span-2"><Label>Active offering</Label><Select value={productCode||"none"} onValueChange={v=>setProductCode(v==="none"?"":v)}>
    <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Choose offering</SelectItem>{products.filter(p=>p.is_active).map(p=><SelectItem key={p.code} value={p.code}>{p.name} · {money(p.unit_price_cents)}</SelectItem>)}</SelectContent></Select>
   </div>
   <div className="space-y-1"><Label>Quantity</Label><Input type="number" min="1" max="10000" value={quantity} onChange={e=>setQuantity(e.target.value)}/></div>
   <div className="space-y-1"><Label>Due date</Label><Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
   <div className="sm:col-span-4"><Button disabled={busy||!selectedResidence||!productCode} onClick={()=>void issueInvoice()}>Issue immutable invoice</Button></div>
  </CardContent></Card>
  <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Invoices & payment reconciliation</CardTitle><Button variant="outline" onClick={()=>void loadInvoices()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div></CardHeader><CardContent className="space-y-3">
   {invoices.length===0?<p className="text-sm text-muted-foreground">No invoices in this view. Nothing has been billed by the new commercial module.</p>:invoices.map(inv=><div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
    <div><p className="font-bold">{inv.invoice_number} · {money(inv.total_cents)}</p><p className="text-xs text-muted-foreground">{inv.product_code.replaceAll("_"," ")} · {new Date(inv.issued_at).toLocaleDateString("en-ZA")} · Due {inv.due_date}</p></div>
    <div className="flex flex-wrap gap-2"><Badge variant={inv.status==="paid"?"default":"outline"}>{inv.status.replaceAll("_"," ")}</Badge>
      <Button size="sm" variant="outline" asChild><Link to={"/commercial/invoice/"+inv.id}><FileText className="mr-1 h-4 w-4"/>Invoice PDF / print</Link></Button>
      {["issued","payment_review"].includes(inv.status)&&<Button size="sm" onClick={()=>{setReconcileId(inv.id);setBankReference(inv.payment_reference||"");setAuditNote("");setBankVerified(false);}}>Reconcile</Button>}
    </div></div>)}
   <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{invoiceCount} invoice(s) · page {invoicePage+1}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={invoicePage===0} onClick={()=>setInvoicePage(p=>p-1)}>Previous</Button><Button size="sm" variant="outline" disabled={(invoicePage+1)*40>=invoiceCount} onClick={()=>setInvoicePage(p=>p+1)}>Next</Button></div></div>
   {reconcileId&&<div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-50/30 p-4 dark:bg-amber-950/10">
     <h4 className="font-bold">Independent EFT reconciliation</h4><p className="text-xs text-muted-foreground">Bank records must be checked outside ResKonnect. A student or landlord cannot mark a payment as paid.</p>
     <div className="space-y-1"><Label>Bank transaction reference</Label><Input value={bankReference} onChange={e=>setBankReference(e.target.value)} placeholder="Verified bank payment reference"/></div>
     <div className="space-y-1"><Label>Finance audit note (minimum 15 characters)</Label><Textarea rows={3} value={auditNote} onChange={e=>setAuditNote(e.target.value)} placeholder="Evidence checked, payment amount, bank transaction date"/></div>
     <label className="flex items-start gap-2 text-sm"><Checkbox checked={bankVerified} onCheckedChange={v=>setBankVerified(v===true)}/><span>I have independently verified the actual bank credit against this invoice, not just the payer's reference.</span></label>
     <div className="flex flex-wrap gap-2"><Button disabled={busy||!bankVerified} onClick={()=>void reconcile("verify_paid")}><BadgeCheck className="mr-2 h-4 w-4"/>Confirm bank-verified payment</Button>
      <Button variant="outline" disabled={busy} onClick={()=>void reconcile("request_recheck")}>Request recheck</Button>
      <Button variant="destructive" disabled={busy} onClick={()=>void reconcile("void")}>Void unpaid invoice</Button><Button variant="ghost" onClick={()=>setReconcileId(null)}>Cancel</Button></div>
    </div>}
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Sponsored residence placements</CardTitle>
   <p className="text-sm text-muted-foreground">Always displayed with an explicit Sponsored label. Paid placements require independently reconciled invoices; complimentary placements require manual approval.</p></CardHeader><CardContent className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Campaign title</Label><Input value={sponsorTitle} onChange={e=>setSponsorTitle(e.target.value)} placeholder="Residence discovery campaign"/></div>
    <div className="space-y-1"><Label>Placement</Label><Select value={sponsorPlacement} onValueChange={setSponsorPlacement}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="find">Find accommodation</SelectItem><SelectItem value="home">Homepage</SelectItem></SelectContent></Select></div>
    <div className="space-y-1"><Label>Start date and time</Label><Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></div>
    <div className="space-y-1"><Label>End date and time</Label><Input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></div>
    <div className="space-y-1"><Label>Financial basis</Label><Select value={sponsorBasis} onValueChange={setSponsorBasis}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="complimentary">Complimentary (admin approved)</SelectItem><SelectItem value="paid_invoice">Paid (verified invoice)</SelectItem></SelectContent></Select></div>
    {sponsorBasis==="paid_invoice"&&<div className="space-y-1"><Label>Paid sponsorship invoice</Label><Select value={sponsorInvoice||"none"} onValueChange={v=>setSponsorInvoice(v==="none"?"":v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Choose paid invoice</SelectItem>{paidSponsorInvoices.map(inv=><SelectItem key={inv.id} value={inv.id}>{inv.invoice_number}</SelectItem>)}</SelectContent></Select></div>}
    <div className="space-y-1 sm:col-span-2"><Label>Campaign description</Label><Textarea value={sponsorDescription} maxLength={1000} onChange={e=>setSponsorDescription(e.target.value)} rows={2}/></div>
   </div>
   <Button disabled={busy||!selectedResidence} onClick={()=>void createSponsor()}>Create approval draft</Button>
   <div className="space-y-2">{promotions.length===0?<p className="text-sm text-muted-foreground">No sponsored placements created yet.</p>:promotions.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-3">
    <div><strong>{p.title}</strong><p className="text-xs text-muted-foreground">{p.placement} · {p.funding_basis.replaceAll("_"," ")} · {new Date(p.starts_at).toLocaleDateString("en-ZA")} – {new Date(p.ends_at).toLocaleDateString("en-ZA")}</p></div>
    <div className="flex flex-wrap gap-2"><Badge>{p.status==="approved"?"Sponsored · Approved":p.status}</Badge>
     {p.status!=="approved"&&p.status!=="cancelled"&&<Button size="sm" disabled={busy} onClick={()=>void approveSponsor(p,"approved")}>Approve</Button>}
     {p.status==="approved"&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void approveSponsor(p,"paused")}>Pause</Button>}
     {p.status!=="cancelled"&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void approveSponsor(p,"cancelled")}>Cancel</Button>}
    </div></div>)}</div>
  </CardContent></Card>
 </div>;
}
