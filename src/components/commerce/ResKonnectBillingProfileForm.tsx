import {useCallback,useEffect,useState} from "react";
import {FileText,Save,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

type Profile={legal_name:string;billing_email:string;billing_address:string;company_registration:string;vat_number:string};
const EMPTY:Profile={legal_name:"",billing_email:"",billing_address:"",company_registration:"",vat_number:""};
export default function ResKonnectBillingProfileForm({residenceId,onSaved}:{residenceId:string;onSaved?:()=>void}){
 const [data,setData]=useState<Profile>(EMPTY),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{
  if(!residenceId)return;setLoading(true);
  const {data,error}=await (supabase as any).from("reskonnect_commercial_billing_profiles").select("legal_name,billing_email,billing_address,company_registration,vat_number").eq("residence_id",residenceId).maybeSingle();
  if(error)toast.error(error.message);
  setData(data?{legal_name:data.legal_name||"",billing_email:data.billing_email||"",billing_address:data.billing_address||"",company_registration:data.company_registration||"",vat_number:data.vat_number||""}:EMPTY);
  setLoading(false);
 },[residenceId]);
 useEffect(()=>{void load();},[load]);
 const save=async()=>{
  if(data.legal_name.trim().length<3||data.billing_address.trim().length<8||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.billing_email))
   return toast.error("Provide a legal business name, valid billing email and billing address.");
  setSaving(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setSaving(false);return toast.error("Please sign in again.");}
  const {error}=await (supabase as any).from("reskonnect_commercial_billing_profiles")
   .upsert({residence_id:residenceId,...data,legal_name:data.legal_name.trim(),billing_email:data.billing_email.trim(),billing_address:data.billing_address.trim(),
     updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"residence_id"});
  setSaving(false);
  if(error)return toast.error(error.message);
  toast.success("Billing profile saved securely");onSaved?.();
 };
 return <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>Residence billing profile</CardTitle>
 <p className="text-sm text-muted-foreground">Legal invoice recipient information. A billing profile does not activate a subscription or authorize a payment.</p></CardHeader><CardContent className="space-y-4">
  {loading?<p role="status" className="text-sm text-muted-foreground">Loading billing details…</p>:<>
   <div className="grid gap-4 sm:grid-cols-2">{([
    ["legal_name","Legal landlord / company name"],["billing_email","Billing email"],
    ["company_registration","Company registration (optional)"],["vat_number","VAT number (if registered)"]
   ] as const).map(([key,label])=><div key={key} className="space-y-1.5"><Label htmlFor={"rk-billing-"+key}>{label}</Label><Input id={"rk-billing-"+key} value={data[key]} maxLength={key==="billing_email"?254:180} onChange={e=>setData(prev=>({...prev,[key]:e.target.value}))}/></div>)}</div>
   <div className="space-y-1.5"><Label htmlFor="rk-billing-address">Legal billing address</Label><Input id="rk-billing-address" value={data.billing_address} maxLength={400} onChange={e=>setData(prev=>({...prev,billing_address:e.target.value}))}/></div>
   <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Visible only to the authorized residence and finance administrators.</p>
     <Button disabled={saving} onClick={()=>void save()}><Save className="mr-2 h-4 w-4"/>{saving?"Saving…":"Save billing profile"}</Button></div>
  </>}
 </CardContent></Card>;
}
