import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '@/components/SEO';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Field, Panel, Check, selectStyle } from '@/components/student-care/CareUI';
import { db, friendlyStatus } from '@/lib/studentCare';
import { toast } from 'sonner';
const blankFeedback = {residence_name:'',campus:'',institution:'',stay_semester:'2',safety_rating:'',maintenance_rating:'',management_rating:'',overall_rating:'',concerns:'',improvements:'',urgent_safety_concern:false,petition_support:false,share_with_institution:false,share_identity:false};
const blankRoom = {academic_year:'2027',semester:'1',full_name:'',phone:'',campus:'',preferred_residence:'',budget:'',funding_type:'undecided',move_in_date:'',notes:'',room_type:'single'};
export default function StudentCare() {
  const {user}=useAuth(); const location=useLocation(); const navigate=useNavigate(); const [params]=useSearchParams();
  const waiting=location.pathname==='/single-room-waiting-list';
  const [campaigns,setCampaigns]=useState<any[]>([]); const [campaign,setCampaign]=useState(params.get('campaign')||'');
  const [feedback,setFeedback]=useState(blankFeedback); const [room,setRoom]=useState(blankRoom);
  const [responses,setResponses]=useState<any[]>([]); const [requests,setRequests]=useState<any[]>([]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const load=async()=>{
    try {
      const c=await db.from('residence_feedback_campaigns').select('*').eq('is_active',true).order('academic_year',{ascending:false});
      if(c.error)throw c.error;setCampaigns(c.data||[]);setCampaign(v=>v||c.data?.[0]?.id||'');
      if(!user){setResponses([]);setRequests([]);return;}
      const [f,r,p]=await Promise.all([db.from('residence_stay_feedback').select('*').eq('user_id',user.id).order('updated_at',{ascending:false}),db.from('single_room_waitlist').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),db.from('profiles').select('full_name,phone,campus').eq('id',user.id).maybeSingle()]);
      if(f.error||r.error||p.error)throw f.error||r.error||p.error;
      setResponses(f.data||[]);setRequests(r.data||[]);setError('');
      if(p.data){setRoom(v=>({...v,full_name:v.full_name||p.data.full_name||'',phone:v.phone||p.data.phone||'',campus:v.campus||p.data.campus||''}));setFeedback(v=>({...v,campus:v.campus||p.data.campus||''}));}
    }catch(e:any){setError(e.message||'Could not load student care');}
  };
  useEffect(()=>{void load();},[user?.id]);
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(!user)return navigate('/auth?returnTo='+encodeURIComponent(location.pathname+location.search));setBusy(true);
    try{const r=waiting?await db.rpc('rk_join_single_room_waitlist',{p_request:room}):await db.rpc('rk_submit_residence_feedback',{p_campaign_id:campaign,p_feedback:feedback});if(r.error)throw r.error;toast.success(waiting?'Single-room request saved':'Residence feedback saved');await load();}catch(e:any){toast.error(e.message);}finally{setBusy(false);}
  };
  const existing=responses.find(r=>r.campaign_id===campaign);
  return <DashboardLayout><SEO title={waiting?'Single-Room Waiting List | ResKonnect':'Residence Feedback & Student Care | ResKonnect'} description="Request a single room, share residence feedback and track student care with ResKonnect."/>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-[#071326] p-7 text-white sm:p-10"><Badge className="bg-[#F5B32F] text-[#071326]">STUDENTS FIRST</Badge><h1 className="mt-4 text-3xl font-black sm:text-4xl">{waiting?'Strictly single rooms.':'Your experience matters.'}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{waiting?'Join once per semester and update your preferences. We search for suitable single rooms; joining does not guarantee availability or reserve a bed.':'We care about our students more than the services we provide. Tell us what is working, what needs attention and what should change throughout your stay.'}</p></section>
      <nav className="flex flex-wrap gap-2" aria-label="Student care"><Button asChild variant={waiting?'default':'outline'}><Link to="/single-room-waiting-list">Single-room waiting list</Link></Button><Button asChild variant={waiting?'outline':'default'}><Link to="/student-care">Residence feedback & petition</Link></Button><Button asChild variant="outline"><Link to="/application-assistance">Application assistance</Link></Button></nav>
      {error&&<div role="alert" className="rounded-xl border border-destructive p-4">{error}<Button variant="outline" className="ml-3" onClick={()=>void load()}>Retry</Button></div>}
      {!user&&<Panel title="Sign in to save and track your request"><Button onClick={()=>navigate('/auth?returnTo='+encodeURIComponent(location.pathname+location.search))}>Sign in / Create account</Button></Panel>}
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={waiting?'Find a single room for me':'Residence stay feedback'}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {waiting?<>
            <Field label="Academic year"><Input required type="number" min="2026" max="2100" value={room.academic_year} onChange={e=>setRoom({...room,academic_year:e.target.value})}/></Field>
            <Field label="Semester"><select className={selectStyle} value={room.semester} onChange={e=>setRoom({...room,semester:e.target.value})}><option value="1">First semester</option><option value="2">Second semester</option></select></Field>
            {([['full_name','Full name'],['phone','WhatsApp / phone'],['campus','Campus'],['preferred_residence','Preferred residence (optional)']] as const).map(([key,label])=><Field label={label} key={key}><Input required={key!=='preferred_residence'} maxLength={200} value={room[key]} onChange={e=>setRoom({...room,[key]:e.target.value})}/></Field>)}
            <Field label="Maximum monthly budget (R, optional)"><Input type="number" min="0" step="0.01" value={room.budget} onChange={e=>setRoom({...room,budget:e.target.value})}/></Field>
            <Field label="Funding"><select className={selectStyle} value={room.funding_type} onChange={e=>setRoom({...room,funding_type:e.target.value})}>{['undecided','nsfas','private','bursary'].map(s=><option key={s} value={s}>{s==='nsfas'?'NSFAS':friendlyStatus(s)}</option>)}</select></Field>
            <Field label="Preferred move-in date"><Input type="date" value={room.move_in_date} onChange={e=>setRoom({...room,move_in_date:e.target.value})}/></Field>
            <Field label="Other preferences"><Textarea maxLength={3000} value={room.notes} onChange={e=>setRoom({...room,notes:e.target.value})}/></Field>
            <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:col-span-2"><input type="checkbox" required className="mt-1"/><span>I request a <strong>single room only</strong> and agree that ResKonnect may use these details to help find one.</span></label>
          </>:<>
            <Field label="Feedback campaign" wide><select required className={selectStyle} value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">Choose a campaign</option>{campaigns.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></Field>
            {existing&&<div className="rounded-xl bg-muted/40 p-3 text-sm sm:col-span-2">You have already responded. <button type="button" className="font-bold underline" onClick={()=>setFeedback({...blankFeedback,...existing})}>Load my feedback to update it</button></div>}
            {([['residence_name','Residence name'],['campus','Campus'],['institution','University / college']] as const).map(([key,label])=><Field key={key} label={label}><Input required maxLength={200} value={feedback[key]} onChange={e=>setFeedback({...feedback,[key]:e.target.value})}/></Field>)}
            <Field label="Semester of your stay"><select className={selectStyle} value={feedback.stay_semester} onChange={e=>setFeedback({...feedback,stay_semester:e.target.value})}><option value="1">First semester</option><option value="2">Second semester</option></select></Field>
            {([['safety_rating','Safety'],['maintenance_rating','Maintenance & cleanliness'],['management_rating','Management & support'],['overall_rating','Overall experience']] as const).map(([key,label])=><Field label={label} key={key}><select required className={selectStyle} value={feedback[key]} onChange={e=>setFeedback({...feedback,[key]:e.target.value})}><option value="">Choose a rating</option>{['Very poor','Poor','Fair','Good','Excellent'].map((s,i)=><option key={s} value={i+1}>{i+1} — {s}</option>)}</select></Field>)}
            <Field label="What happened / what worked well?" wide><Textarea maxLength={8000} value={feedback.concerns} onChange={e=>setFeedback({...feedback,concerns:e.target.value})}/></Field>
            <Field label="What improvements would you like?" wide><Textarea maxLength={8000} value={feedback.improvements} onChange={e=>setFeedback({...feedback,improvements:e.target.value})}/></Field>
            <div className="space-y-4 rounded-xl bg-muted/30 p-4 sm:col-span-2">
              <Check label="I have an urgent safety concern." checked={feedback.urgent_safety_concern} onChange={v=>setFeedback({...feedback,urgent_safety_concern:v})}/>
              {feedback.urgent_safety_concern&&<p className="text-sm text-destructive">If you are in immediate danger, contact residence security or emergency services now. This form is not an emergency response channel.</p>}
              <Check label="ResKonnect may share my feedback with the relevant residence and institution to seek action." checked={feedback.share_with_institution} onChange={v=>setFeedback({...feedback,share_with_institution:v,share_identity:v&&feedback.share_identity,petition_support:v&&feedback.petition_support})}/>
              <Check label="I support a collective petition for the improvements described in my feedback." disabled={!feedback.share_with_institution} checked={feedback.petition_support} onChange={v=>setFeedback({...feedback,petition_support:v})}/>
              <Check label="My name may be included when raising my feedback." disabled={!feedback.share_with_institution} checked={feedback.share_identity} onChange={v=>setFeedback({...feedback,share_identity:v})}/>
              <p className="text-xs text-muted-foreground">Your response is private to you and the care team. Sharing is optional. Critical feedback does not affect access to support.</p>
            </div>
          </>}
          <Button className="sm:col-span-2" disabled={busy||!user||(!waiting&&!campaign)}>{busy?'Saving…':waiting?'Save my single-room request':existing?'Update my feedback':'Submit residence feedback'}</Button>
        </form></Panel>
        <div className="space-y-5"><Panel title={waiting?'My single-room requests':'My feedback & responses'}>
          {!(waiting?requests:responses).length&&<p className="text-sm text-muted-foreground">Your saved requests and team responses will appear here.</p>}
          {(waiting?requests:responses).map(r=><article key={r.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{waiting?r.academic_year+' · Semester '+r.semester:r.residence_name}</p><Badge variant="secondary">{friendlyStatus(r.status)}</Badge></div><p className="text-sm text-muted-foreground">{r.campus}</p>{r.staff_response&&<p className="whitespace-pre-wrap text-sm"><strong>ResKonnect: </strong>{r.staff_response}</p>}{r.institution_response&&<p className="whitespace-pre-wrap text-sm"><strong>Institution: </strong>{r.institution_response}</p>}{waiting&&r.status!=='withdrawn'&&<Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);const {error}=await db.rpc('rk_withdraw_single_room',{p_id:r.id});setBusy(false);if(error)toast.error(error.message);else{toast.success('Request withdrawn');await load();}}}>Withdraw request</Button>}</article>)}
        </Panel><Panel title="Quality throughout the year"><p className="text-sm leading-6 text-muted-foreground">We record concerns, seek responses from the responsible residence or institution and use year-end feedback to guide improvements. Proactive WhatsApp follow-ups are limited to one per month, at least 30 days apart. You can still message us whenever you need help.</p></Panel></div>
      </div>
    </main></DashboardLayout>;
}
