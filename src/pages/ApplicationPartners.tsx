import { useEffect, useMemo, useRef, useState } from 'react';
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

const casePath = (id:string) => '/application-assistance/case/'+encodeURIComponent(id);
const semesterLabel = (value:unknown) => Number(value) === 2 ? 'Second-semester intake' : 'First-semester intake';

/** An approved partner sees only consented cases assigned to their own partner identity. */
export default function ApplicationPartners() {
  const {user} = useAuth(); const location = useLocation(); const navigate = useNavigate();
  const partnerView = location.pathname === '/application-partners';
  const [partners,setPartners] = useState<any[]>([]), [partner,setPartner] = useState<any>(null), [cases,setCases] = useState<any[]>([]), [submissions,setSubmissions] = useState<any[]>([]);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [search,setSearch] = useState(''), [semester,setSemester] = useState('all'), [year,setYear] = useState('all'), [status,setStatus] = useState('all');
  const [form,setForm] = useState({display_name:'',bio:'',assistance_fee:'0'});
  const requestVersion = useRef(0);
  const load = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const active = await db.from('creator_partners').select('id,slug,display_name,bio,assistance_fee,partner_kind').eq('status','active').order('display_name');
      if(active.error) throw active.error;
      if(version !== requestVersion.current) return;
      setPartners(active.data || []);
      if(!user) {setCases([]);setSubmissions([]);setPartner(null);return;}
      const own = await db.from('creator_partners').select('id,user_id,slug,display_name,bio,assistance_fee,status,partner_kind').eq('user_id',user.id).maybeSingle();
      if(own.error) throw own.error;
      if(version !== requestVersion.current) return;
      setPartner(own.data || null);
      if(own.data) setForm({display_name:own.data.display_name,bio:own.data.bio || '',assistance_fee:String(own.data.assistance_fee)});
      if(partnerView && (!own.data || own.data.status !== 'active')) {setCases([]);setSubmissions([]);return;}
      const rows = await readAllPages(() => db.from('creator_assistance_cases').select('id,creator_id,student_user_id,applicant_name,intake_year,intake_semester,target_institutions,status,consent_status,service_fee,updated_at').eq(partnerView ? 'creator_id' : 'student_user_id',partnerView ? own.data.id : user.id).order('updated_at',{ascending:false}));
      if(version !== requestVersion.current) return;
      // A revoked case must not remain visible in the partner's working queue.
      const scoped = partnerView ? rows.filter(c => c.consent_status === 'granted' && c.creator_id === own.data.id) : rows;
      setCases(scoped);
      const submissionsForCases:any[] = [];
      // Database-side case-id filtering prevents scanning unrelated students' submissions.
      for(let offset = 0; offset < scoped.length; offset += 75) {
        const ids = scoped.slice(offset,offset+75).map(c => c.id);
        if(!ids.length) continue;
        const batch = await readAllPages(() => db.from('assistance_submissions').select('id,case_id,status,submitted_at').in('case_id',ids).order('id'));
        if(version !== requestVersion.current) return;
        submissionsForCases.push(...batch);
      }
      setSubmissions(submissionsForCases);
    } catch(e:any) {if(version === requestVersion.current) {setError(e.message || 'Could not load application assistance');setCases([]);setSubmissions([]);}}
    finally {if(version === requestVersion.current) setLoading(false);}
  };
  useEffect(() => {void load(); return () => {requestVersion.current += 1;};},[user?.id,partnerView]);
  const visible = useMemo(() => cases.filter(c =>
    (semester === 'all' || Number(c.intake_semester) === Number(semester)) &&
    (year === 'all' || Number(c.intake_year) === Number(year)) &&
    (status === 'all' || c.status === status) &&
    [c.applicant_name,...(c.target_institutions || []),c.status].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ),[cases,semester,year,status,search]);
  const counts = useMemo(() => {
    const ids = new Set(visible.map(c => c.id));
    const sent = submissions.filter(s => ids.has(s.case_id) && s.submitted_at).length;
    return {sent,waiting:visible.filter(c => ['requested','documents_pending'].includes(c.status)).length,active:visible.filter(c => !['closed','completed'].includes(c.status)).length};
  },[visible,submissions]);
  const save = async(e:React.FormEvent) => {
    e.preventDefault();if(!user) return;
    const fee = Number(form.assistance_fee);
    if(!Number.isFinite(fee) || fee < 0 || fee > 100) return toast.error('Choose a fee between R0 and R100');
    if(form.display_name.trim().length < 2 || form.bio.trim().length < 3) return toast.error('Enter your name and application-assistance experience');
    setBusy(true);
    try {
      const p = {display_name:form.display_name.trim(),bio:form.bio.trim(),assistance_fee:fee};
      const r = partner ? await db.from('creator_partners').update(p).eq('id',partner.id).eq('user_id',user.id).select('id').single() : await db.from('creator_partners').insert({...p,user_id:user.id,slug:'application-'+user.id.slice(0,12),referral_code:'APP'+user.id.replaceAll('-','').slice(0,16).toUpperCase(),platform:'application_assistance',partner_kind:'application',status:'pending',tier:'creator_partner',payout_per_placement:0,payout_per_verified_reservation:0,follower_count:0});
      if(r.error) throw r.error;
      toast.success(partner ? 'Partner details saved' : 'Partner application sent for approval');await load();
    } catch(e:any) {toast.error(e.message || 'Unable to save partner details');} finally {setBusy(false);}
  };
  const partnerActive = partner?.status === 'active';
  return <DashboardLayout><SEO title={partnerView ? 'Application Partner Dashboard | ResKonnect' : 'Application Assistance | ResKonnect'} description="Consented institution application assistance for university and TVET applicants, with secure documents, progress and submission tracking." noIndex={partnerView}/>
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-[#071326] p-7 text-white sm:p-10"><Badge className="bg-[#F5B32F] text-[#071326]">RESKONNECT APPLICATION ASSISTANCE</Badge><h1 className="mt-4 text-3xl font-black sm:text-4xl">{partnerView ? 'Partner application workspace' : 'Apply with someone by your side.'}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{partnerView ? 'Track consented applicant cases, collect documents, record each institution submission and follow up with students from one dashboard.' : 'Choose an approved partner to prepare documents and track university or TVET institution applications.'} Partners set one assistance fee of no more than R100 per annual case, covering all institution choices in that case.</p><p className="mt-3 text-xs text-white/65">An institution application intake semester is not the length of a student’s residence stay. A student may stay in accommodation for both semesters under their actual residence agreement. Institution application fees, if applicable, are separate and paid directly to the institution.</p></section>
      <nav className="flex flex-wrap gap-2"><Button asChild variant={!partnerView ? 'default' : 'outline'}><Link to="/application-assistance">Find assistance / My cases</Link></Button><Button asChild variant={partnerView ? 'default' : 'outline'}><Link to="/application-partners">Partner dashboard</Link></Button><Button asChild variant="outline"><Link to="/apply">Explore institutions</Link></Button></nav>
      {error && <div role="alert" className="rounded-xl border border-destructive p-4">{error}<Button className="ml-3" variant="outline" onClick={() => void load()}>Retry</Button></div>}
      {!user && <Button onClick={() => navigate('/auth?returnTo='+encodeURIComponent(location.pathname))}>Sign in / Create account</Button>}
      {loading ? <p role="status" className="py-10 text-center text-muted-foreground">Loading application workspace…</p> : <>
        {partnerView && user && <Panel title={partner ? 'Your partner profile' : 'Apply as an application partner'}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><Field label="Partner / business name"><Input required minLength={2} maxLength={160} value={form.display_name} onChange={e => setForm({...form,display_name:e.target.value})}/></Field><Field label="Assistance fee (R0–R100)"><Input required type="number" min="0" max="100" step="0.01" value={form.assistance_fee} onChange={e => setForm({...form,assistance_fee:e.target.value})}/></Field><Field label="Application experience and institutions you assist with" wide><Textarea required minLength={3} maxLength={3000} value={form.bio} onChange={e => setForm({...form,bio:e.target.value})}/></Field><div className="flex items-center gap-3 sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : partner ? 'Save profile & fee' : 'Submit for approval'}</Button>{partner && <Badge variant={partnerActive ? 'default' : 'outline'}>{friendlyStatus(partner.status)}</Badge>}</div></form><p className="text-xs text-muted-foreground">Application partners do not need a social-media follower minimum. ResKonnect approves partner access. Fee changes apply only to new annual cases.</p>
          {partner && !partnerActive && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{partner.status === 'pending' ? 'Your application is awaiting ResKonnect approval. Your intake link and assigned-student dashboard become available after approval.' : 'This partner account is not currently approved to accept new assisted applications. Contact ResKonnect if you need to review the status.'}</p>}
          {partnerActive && <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={async () => {try {await navigator.clipboard.writeText(window.location.origin+'/creator-assist/'+partner.slug);toast.success('Student intake link copied');}catch {toast.error('Could not copy. Open the intake page and copy its URL.');}}}>Copy student intake link</Button><Button asChild variant="outline"><Link to={'/creator-assist/'+partner.slug}>Open intake page</Link></Button><Button asChild variant="outline"><Link to="/creator-partners">Partner resources</Link></Button></div>}
        </Panel>}
        {!partnerView && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{partners.map(p => <Panel key={p.id} title={p.display_name}><Badge variant="outline">Approved partner</Badge><p className="text-sm text-muted-foreground">{p.bio || 'Institution application preparation and submission assistance.'}</p><p className="font-bold">{Number(p.assistance_fee) === 0 ? 'Free assistance' : 'R'+Number(p.assistance_fee).toFixed(2)+' per annual case'}</p><Button asChild><Link to={'/creator-assist/'+p.slug}>Choose this partner</Link></Button></Panel>)}{!partners.length && <Panel title="Partner intake is open"><p className="text-sm">No approved partners are available yet.</p><Button asChild variant="outline"><Link to="/application-partners">Apply as a partner</Link></Button></Panel>}</div>}
        {user && (!partnerView || partnerActive) && <Panel title={partnerView ? 'Assigned application cases' : 'My assistance cases'}><div className="grid gap-3 sm:grid-cols-3">{[['Cases in view',visible.length],['Institution applications sent',counts.sent],['Awaiting student documents / intake',counts.waiting]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-muted/40 p-4"><p className="text-3xl font-black">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div>
          <div className="grid gap-3 sm:grid-cols-4"><Input aria-label="Search cases" placeholder="Student, institution or status" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Intake year" className={selectStyle} value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{[...new Set(cases.map(c => c.intake_year))].sort().map(y => <option key={y} value={y}>{y}</option>)}</select><select aria-label="Intake semester" className={selectStyle} value={semester} onChange={e => setSemester(e.target.value)}><option value="all">Both intake periods</option><option value="1">First-semester intake</option><option value="2">Second-semester intake</option></select><select aria-label="Case status" className={selectStyle} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All case statuses</option>{[...new Set(cases.map(c => c.status))].sort().map(s => <option key={s} value={s}>{friendlyStatus(s)}</option>)}</select></div>
          <p className="text-xs text-muted-foreground">Intake filters organize institution applications. They do not imply that students may occupy accommodation for only one semester.</p>
          {!visible.length && <p className="py-6 text-center text-sm text-muted-foreground">{partnerView ? 'No assigned, consented cases match these filters. Share your intake link with students after approval.' : 'No assistance cases match these filters. Start by choosing an approved partner.'}</p>}
          <div className="divide-y">{visible.map(c => <Link key={c.id} to={casePath(c.id)} className="flex flex-wrap items-center justify-between gap-3 py-4 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div><p className="font-bold">{c.applicant_name}</p><p className="text-sm text-muted-foreground">{(c.target_institutions || []).join(', ')} · {c.intake_year} · {semesterLabel(c.intake_semester)}</p><p className="mt-1 text-xs">Agreed fee: R{Number(c.service_fee || 0).toFixed(2)} · {submissions.filter(s => s.case_id === c.id && s.submitted_at).length} application(s) sent</p></div><div className="flex items-center gap-2"><Badge variant="secondary">{friendlyStatus(c.status)}</Badge><span className="text-sm font-semibold text-primary">Open case →</span></div></Link>)}</div>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={busy}>Refresh applications</Button>
        </Panel>}
      </>}
    </main></DashboardLayout>;
}
