import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Panel, selectStyle } from '@/components/student-care/CareUI';
import { db, friendlyStatus, readAllPages } from '@/lib/studentCare';
import { toast } from 'sonner';
export default function ApplicationPartners() {
  const {user}=useAuth();const location=useLocation();const navigate=useNavigate();const partnerView=location.pathname==='/application-partners';
  const [partners,setPartners]=useState<any[]>([]),[partner,setPartner]=useState<any>(null),[cases,setCases]=useState<any[]>([]),[submissions,setSubmissions]=useState<any[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[semester,setSemester]=useState('all'),[year,setYear]=useState('all');
  const [form,setForm]=useState({display_name:'',bio:'',assistance_fee:'0'});
  const load=async()=>{
    setLoading(true);setError('');try{
      const active=await db.from('creator_partners').select('id,slug,display_name,bio,assistance_fee,partner_kind').eq('status','active').order('display_name');if(active.error)throw active.error;setPartners(active.data||[]);
      if(!user){setCases([]);setPartner(null);return;}
      const own=await db.from('creator_partners').select('*').eq('user_id',user.id).maybeSingle();if(own.error)throw own.error;setPartner(own.data);
      if(own.data)setForm({display_name:own.data.display_name,bio:own.data.bio||'',assistance_fee:String(own.data.assistance_fee)});
      if(partnerView&&!own.data){setCases([]);return;}
      const rows=await readAllPages(()=>db.from('creator_assistance_cases').select('*').eq(partnerView?'creator_id':'student_user_id',partnerView?own.data.id:user.id).order('id'));
      setCases(rows);const ids=new Set(rows.map(c=>c.id));
      setSubmissions(rows.length?(await readAllPages(()=>db.from('assistance_submissions').select('id,case_id,status,submitted_at').order('id'))).filter(s=>ids.has(s.case_id)):[]);
    }catch(e:any){setError(e.message||'Could not load assistance');}finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[user?.id,partnerView]);
  const visible=useMemo(()=>cases.filter(c=>(semester==='all'||Number(c.intake_semester)===Number(semester))&&(year==='all'||Number(c.intake_year)===Number(year))&&[c.applicant_name,...(c.target_institutions||[]),c.status].join(' ').toLowerCase().includes(search.toLowerCase())),[cases,semester,year,search]);
  const sent=submissions.filter(s=>visible.some(c=>c.id===s.case_id)&&s.submitted_at).length;
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();if(!user)return;const fee=Number(form.assistance_fee);if(!Number.isFinite(fee)||fee<0||fee>100)return toast.error('Choose a fee between R0 and R100');setBusy(true);
    try{const p={display_name:form.display_name.trim(),bio:form.bio.trim(),assistance_fee:fee};const r=partner?await db.from('creator_partners').update(p).eq('id',partner.id).select('id').single():await db.from('creator_partners').insert({...p,user_id:user.id,slug:'application-'+user.id.slice(0,12),referral_code:'APP'+user.id.replaceAll('-','').slice(0,16).toUpperCase(),platform:'application_assistance',partner_kind:'application',status:'pending',follower_count:0});if(r.error)throw r.error;toast.success(partner?'Profile and fee saved':'Partner application sent for approval');await load();}catch(e:any){toast.error(e.message);}finally{setBusy(false);}
  };
  return <DashboardLayout><SEO title={partnerView?'Application Partner Dashboard | ResKonnect':'Application Assistance | ResKonnect'} description="Hands-on university and TVET application support, secure documents, submission tracking and live assistance requests. Partner service fees capped at R100." noIndex={partnerView}/>
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"><section className="rounded-3xl bg-[#071326] p-7 text-white sm:p-10"><Badge className="bg-[#F5B32F] text-[#071326]">RESKONNECT APPLICATION ASSISTANCE</Badge><h1 className="mt-4 text-3xl font-black sm:text-4xl">{partnerView?'Help students take the next step.':'Apply with someone by your side.'}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">Prepare documents, track each institution application and request live assistance. Partners set their fee up to a strict maximum of <strong className="text-white">R100 per annual assistance case</strong>, covering all institution choices in that case.</p><p className="mt-3 text-xs text-white/65">Institution application fees, if applicable, are separate and paid to the institution. Partners may not add extra service charges.</p></section>
      <nav className="flex flex-wrap gap-2"><Button asChild variant={!partnerView?'default':'outline'}><Link to="/application-assistance">Find assistance / My cases</Link></Button><Button asChild variant={partnerView?'default':'outline'}><Link to="/application-partners">Partner dashboard</Link></Button><Button asChild variant="outline"><Link to="/apply">Explore institutions</Link></Button></nav>
      {error&&<div role="alert" className="rounded-xl border border-destructive p-4">{error}<Button className="ml-3" variant="outline" onClick={()=>void load()}>Retry</Button></div>}
      {!user&&<Button onClick={()=>navigate('/auth?returnTo='+encodeURIComponent(location.pathname))}>Sign in / Create account</Button>}
      {loading?<p className="py-10 text-center text-muted-foreground">Loading application workspace…</p>:<>
        {partnerView&&user&&<Panel title={partner?'Your partner profile':'Apply as an application partner'}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><Field label="Partner / business name"><Input required minLength={2} maxLength={160} value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})}/></Field><Field label="Assistance fee (R0–R100)"><Input required type="number" min="0" max="100" step="0.01" value={form.assistance_fee} onChange={e=>setForm({...form,assistance_fee:e.target.value})}/></Field><Field label="Application experience and institutions you assist with" wide><Textarea required maxLength={3000} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></Field><div className="flex items-center gap-3 sm:col-span-2"><Button disabled={busy}>{busy?'Saving…':partner?'Save profile & fee':'Submit for approval'}</Button>{partner&&<Badge>{partner.status}</Badge>}</div></form><p className="text-xs text-muted-foreground">Application partners do not need a social-media follower minimum. ResKonnect approves access. Fee changes apply only to new cases.</p>{partner?.status==='active'&&<div className="flex flex-wrap gap-3"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+'/creator-assist/'+partner.slug);toast.success('Student intake link copied');}catch{toast.error('Could not copy');}}}>Copy student intake link</Button><Button asChild variant="outline"><Link to={'/creator-assist/'+partner.slug}>Open intake page</Link></Button></div>}</Panel>}
        {!partnerView&&<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{partners.map(p=><Panel key={p.id} title={p.display_name}><Badge variant="outline">Approved partner</Badge><p className="text-sm text-muted-foreground">{p.bio||'Application preparation and submission assistance.'}</p><p className="font-bold">{Number(p.assistance_fee)===0?'Free assistance':'R'+Number(p.assistance_fee).toFixed(2)+' per annual case'}</p><Button asChild><Link to={'/creator-assist/'+p.slug}>Choose this partner</Link></Button></Panel>)}{!partners.length&&<Panel title="Partner intake is open"><p className="text-sm">No approved partners are available yet.</p><Button asChild variant="outline"><Link to="/application-partners">Apply as a partner</Link></Button></Panel>}</div>}
        {user&&<Panel title={partnerView?'Application cases':'My assistance cases'}><div className="grid gap-3 sm:grid-cols-3">{[['Cases in view',visible.length],['Applications sent',sent],['Awaiting documents',visible.filter(c=>c.status==='documents_pending').length]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-muted/40 p-4"><p className="text-3xl font-black">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Search cases" placeholder="Student, institution or status" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Intake year" className={selectStyle} value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{[...new Set(cases.map(c=>c.intake_year))].sort().map(y=><option key={y} value={y}>{y}</option>)}</select><select aria-label="Semester" className={selectStyle} value={semester} onChange={e=>setSemester(e.target.value)}><option value="all">Both semesters</option><option value="1">First semester</option><option value="2">Second semester</option></select></div>
          {!visible.length&&<p className="py-6 text-center text-sm text-muted-foreground">No matching cases. Students start by choosing an approved partner and granting access.</p>}
          <div className="divide-y">{visible.map(c=><Link key={c.id} to={'/application-assistance/case/'+c.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{c.applicant_name}</p><p className="text-sm text-muted-foreground">{(c.target_institutions||[]).join(', ')} · {c.intake_year} · Semester {c.intake_semester}</p><p className="mt-1 text-xs">Agreed fee: R{Number(c.service_fee).toFixed(2)}</p></div><Badge variant="secondary">{friendlyStatus(c.status)}</Badge></Link>)}</div>
        </Panel>}
      </>}
    </main></DashboardLayout>;
}
