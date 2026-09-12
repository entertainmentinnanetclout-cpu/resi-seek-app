import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GoldSummary={
  mode:string;
  policy_enabled:boolean;
  policy:Record<string,any>;
  identity:{profiles:number;google_accounts:number;email_verified:number;phone_verified:number;privileged_profiles:number};
  security_24h:{events:number;blocked:number;high_or_critical:number;verification_requests:number;verification_approved:number};
  integrations:{
    twilio_verify:{status:string;enabled:boolean;last_success_at:string|null};
    google_search_console:{status:string;last_success_at:string|null};
  };
  controls:{trigger_rpc_exposure_count:number;aal2_policy_count:number;legacy_auto_admin_email:boolean;authenticated_supabase_cache:boolean;attack_challenge_default:boolean};
  generated_at:string;
};

const fmt=(v:string)=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminGoldSecurity(){
  const[data,setData]=useState<GoldSummary|null>(null);
  const[loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data:result,error}=await(supabase as any).rpc("adminos_gold_security_summary");
    setLoading(false);
    if(error){toast.error(error.message||"Could not load Gold Security posture");return;}
    setData(result||null);
  },[]);
  useEffect(()=>{void load();},[load]);

  const policy=data?.policy||{};
  const twilio=data?.integrations?.twilio_verify;
  const gsc=data?.integrations?.google_search_console;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>Gold Security Mode</Badge><Badge variant="outline">Zero-trust · least privilege · AAL2</Badge><Badge variant="outline">Attack challenge default OFF</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Identity & Security Control Plane</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Security posture for Google identity, institutional profile trust, WhatsApp ownership verification, privileged AAL2 access and protected runtime boundaries. No system can eliminate all breach risk; this surface tracks the controls that materially reduce it.</p>
      </div>
      <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh posture</Button>
    </div>

    <Card className="overflow-hidden rounded-[24px] border-primary/20">
      <CardContent className="p-6">
        <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
          <div><ShieldCheck className="h-8 w-8 text-primary"/><p className="mt-3 text-xs font-black uppercase tracking-[.14em] text-muted-foreground">Security posture</p><p className="mt-1 text-4xl font-black">{data?.policy_enabled?"ACTIVE":"CHECK"}</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Mini label="Google identities" value={data?.identity?.google_accounts||0}/>
            <Mini label="Email verified" value={data?.identity?.email_verified||0}/>
            <Mini label="WhatsApp verified" value={data?.identity?.phone_verified||0}/>
            <Mini label="AAL2 policies" value={data?.controls?.aal2_policy_count||0}/>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={UserCheck} label="Profiles" value={data?.identity?.profiles||0}/>
      <Metric icon={Fingerprint} label="Google accounts" value={data?.identity?.google_accounts||0}/>
      <Metric icon={Smartphone} label="Phone verified" value={data?.identity?.phone_verified||0}/>
      <Metric icon={KeyRound} label="Privileged profiles" value={data?.identity?.privileged_profiles||0}/>
      <Metric icon={LockKeyhole} label="Security events 24h" value={data?.security_24h?.events||0}/>
      <Metric icon={AlertTriangle} label="Blocked 24h" value={data?.security_24h?.blocked||0}/>
      <Metric icon={AlertTriangle} label="High risk 24h" value={data?.security_24h?.high_or_critical||0}/>
      <Metric icon={CheckCircle2} label="OTP verified 24h" value={data?.security_24h?.verification_approved||0}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Identity integrations</CardTitle></CardHeader><CardContent className="space-y-3">
        <Integration name="Twilio Verify · WhatsApp" status={twilio?.status||"not_connected"} detail={twilio?.last_success_at?"Last verified "+new Date(twilio.last_success_at).toLocaleString("en-ZA"):"Provisions on first verification request"} />
        <Integration name="Google Search Console · read only" status={gsc?.status||"not_connected"} detail={gsc?.last_success_at?"Last sync "+new Date(gsc.last_success_at).toLocaleString("en-ZA"):"Awaiting a successful query sync"} />
        <Integration name="Google OAuth · user identity" status="connected" detail="Minimal identity scopes only: OpenID, email and profile." />
      </CardContent></Card>

      <Card className="rounded-[22px]"><CardHeader><CardTitle>Gold policy controls</CardTitle></CardHeader><CardContent className="space-y-2">
        <Control name="Student WhatsApp verification" enabled={Boolean(policy.student_whatsapp_verification_required)}/>
        <Control name="Staff AAL2 MFA" enabled={Boolean(policy.staff_aal2_required)}/>
        <Control name="Admin / God Mode AAL2 MFA" enabled={Boolean(policy.admin_aal2_required)}/>
        <Control name="Legacy auto-admin from email" enabled={!data?.controls?.legacy_auto_admin_email} safeLabel="Disabled"/>
        <Control name="Authenticated Supabase response caching" enabled={!data?.controls?.authenticated_supabase_cache} safeLabel="Disabled"/>
        <Control name="Attack challenge mode by default" enabled={!data?.controls?.attack_challenge_default} safeLabel="Disabled"/>
      </CardContent></Card>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Verification & abuse controls</CardTitle></CardHeader><CardContent>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Policy text={"OTP expires in "+String(policy.phone_otp_ttl_minutes||10)+" minutes"}/>
        <Policy text={"Resend cooldown "+String(policy.phone_otp_resend_seconds||60)+" seconds"}/>
        <Policy text={"Maximum "+String(policy.phone_otp_max_per_15m||3)+" codes / 15 min"}/>
        <Policy text={"Maximum "+String(policy.phone_otp_max_checks||5)+" code checks"}/>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Trigger-only database functions exposed as direct RPCs: <strong className={Number(data?.controls?.trigger_rpc_exposure_count||0)===0?"text-emerald-600":"text-destructive"}>{data?.controls?.trigger_rpc_exposure_count??"—"}</strong>. OTP values are validated by Twilio Verify and are not stored in ResKonnect tables.</p>
    </CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Mini({label,value}:{label:string;value:number}){return <div className="rounded-2xl border bg-muted/25 p-3 text-center"><p className="text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
function Integration({name,status,detail}:{name:string;status:string;detail:string}){const good=["connected","healthy"].includes(status);return <div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{name}</p><Badge variant={good?"default":"outline"}>{fmt(status)}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>;}
function Control({name,enabled,safeLabel}:{name:string;enabled:boolean;safeLabel?:string}){return <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm font-semibold">{name}</span><Badge variant={enabled?"default":"destructive"}>{enabled?(safeLabel||"Enforced"):"Review"}</Badge></div>;}
function Policy({text}:{text:string}){return <div className="rounded-xl border bg-muted/30 p-3 text-xs font-semibold"><CheckCircle2 className="mb-2 h-4 w-4 text-primary"/>{text}</div>;}
