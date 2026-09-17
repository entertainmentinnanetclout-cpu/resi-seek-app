import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Panel, selectStyle } from '@/components/student-care/CareUI';
import { db, friendlyStatus } from '@/lib/studentCare';
import { toast } from 'sonner';
const submissionStates=['preparing','documents_required','submitted','awaiting_response','accepted','rejected','withdrawn'];
export default function AssistanceWorkspaceTools({row,canManage=false}:{row:any;canManage?:boolean}) {
  const [submissions,setSubmissions]=useState<any[]>([]),[requests,setRequests]=useState<any[]>([]),[calls,setCalls]=useState<any[]>([]),[activity,setActivity]=useState<any[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[docTitle,setDocTitle]=useState(''),[instructions,setInstructions]=useState('');
  const [call,setCall]=useState({preferred_at:'',phone:row.phone||'',topic:''});
  const active=row.consent_status==='granted'&&row.status!=='closed';
  const load=async()=>{
    const results=await Promise.all(['assistance_submissions','assistance_document_requests','assistance_call_requests','assistance_case_activity'].map(t=>db.from(t).select('*').eq('case_id',row.id).order('created_at',{ascending:false}).limit(500)));
    const failed=results.find(r=>r.error);if(failed){setError(failed.error.message);return;}
    setError('');setSubmissions(results[0].data||[]);setRequests(results[1].data||[]);setCalls(results[2].data||[]);setActivity(results[3].data||[]);
  };
  useEffect(()=>{void load();},[row.id,row.consent_status]);
  const save=async(table:string,payload:any,id?:string)=>{
    setBusy(true);try{const r=id?await db.from(table).update({...payload,updated_at:new Date().toISOString()}).eq('id',id).eq('case_id',row.id).select('id').single():await db.from(table).insert({...payload,case_id:row.id});if(r.error)throw r.error;toast.success('Workspace updated');await load();return true;}catch(e:any){toast.error(e.message);return false;}finally{setBusy(false);}
  };
  return <div className="space-y-6">
    <Panel title="Your assistance case"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-sm text-muted-foreground">Agreed service fee · {row.intake_year}</p><p className="text-3xl font-black">R{Number(row.service_fee||0).toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">All institution choices in this annual case. Maximum R100.</p></div><div><p className="text-3xl font-black">{submissions.filter(s=>s.submitted_at).length}</p><p className="text-sm">Applications sent</p></div><Button variant="outline" onClick={()=>void load()}>Refresh progress</Button></div></Panel>
    {error&&<p role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error}</p>}
    <Panel title="Institution applications"><p className="text-sm text-muted-foreground">Record every institution and programme separately. Sent applications require an institution reference and submission date.</p>
      {submissions.map(s=>canManage&&active?<SubmissionEditor key={s.id} value={s} busy={busy} save={p=>save('assistance_submissions',p,s.id)}/>:<article key={s.id} className="space-y-2 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{s.institution} · {s.programme}</h3><Badge>{friendlyStatus(s.status)}</Badge></div><p className="text-sm">Reference: {s.reference||'Not submitted yet'}</p>{s.deadline&&<p className="text-sm">Deadline: {s.deadline}</p>}<p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.notes}</p>{s.official_url&&<a className="text-sm underline" href={s.official_url} target="_blank" rel="noopener noreferrer">Official portal</a>}</article>)}
      {!submissions.length&&<p className="text-sm text-muted-foreground">No institution submissions recorded yet.</p>}
      {canManage&&active&&<details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Add institution application</summary><div className="mt-4"><SubmissionEditor busy={busy} save={p=>save('assistance_submissions',p)}/></div></details>}
    </Panel>
    <Panel title="Additional document checklist"><p className="text-sm text-muted-foreground">Upload institution-specific documents using Other supporting document in the document section.</p>
      {requests.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="flex-1"><p className="font-bold">{r.title}</p><p className="text-sm text-muted-foreground">{r.instructions}</p></div>{canManage&&active?<select aria-label={'Status of '+r.title} disabled={busy} className={selectStyle+' sm:w-40'} value={r.status} onChange={e=>void save('assistance_document_requests',{status:e.target.value},r.id)}>{['requested','received','verified'].map(s=><option key={s}>{s}</option>)}</select>:<Badge variant="outline">{r.status}</Badge>}</div>)}
      {canManage&&active&&<form className="grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(await save('assistance_document_requests',{title:docTitle.trim(),instructions})){setDocTitle('');setInstructions('');}}}><Field label="Document needed"><Input required minLength={2} maxLength={200} value={docTitle} onChange={e=>setDocTitle(e.target.value)}/></Field><Field label="Instructions"><Input maxLength={2000} value={instructions} onChange={e=>setInstructions(e.target.value)}/></Field><Button className="sm:col-span-2" disabled={busy}>Request document in workspace</Button></form>}
    </Panel>
    <Panel title="Live call assistance"><p className="text-sm text-muted-foreground">Request a phone or online call. The team confirms a time here. A request does not place a call automatically.</p>
      {calls.map(c=><article key={c.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{c.topic}</h3><Badge>{c.status}</Badge></div><p className="text-sm">Requested: {new Date(c.preferred_at).toLocaleString('en-ZA')} · {c.phone}</p>{c.scheduled_at&&<p className="text-sm font-bold">Confirmed: {new Date(c.scheduled_at).toLocaleString('en-ZA')}</p>}{c.staff_notes&&<p className="whitespace-pre-wrap text-sm">{c.staff_notes}</p>}{c.meeting_url&&<Button asChild variant="outline"><a href={c.meeting_url} target="_blank" rel="noopener noreferrer">Join live assistance</a></Button>}{canManage&&active&&<CallEditor value={c} busy={busy} save={p=>save('assistance_call_requests',p,c.id)}/>}</article>)}
      {active&&!calls.some(c=>['requested','scheduled'].includes(c.status))&&<form className="grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();const when=new Date(call.preferred_at);if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now())return toast.error('Choose a future call time');if(await save('assistance_call_requests',{...call,preferred_at:when.toISOString(),status:'requested'}))setCall({...call,topic:''});}}><Field label="Preferred date and time (local)"><Input required type="datetime-local" value={call.preferred_at} onChange={e=>setCall({...call,preferred_at:e.target.value})}/></Field><Field label="Number to call"><Input required value={call.phone} onChange={e=>setCall({...call,phone:e.target.value})}/></Field><Field label="What do you need help with?"><Textarea required minLength={3} maxLength={1000} value={call.topic} onChange={e=>setCall({...call,topic:e.target.value})}/></Field><div className="flex items-end"><Button disabled={busy}>Request live assistance</Button></div></form>}
    </Panel>
    <Panel title="Case history"><ol className="space-y-3">{activity.slice(0,30).map(a=><li key={a.id} className="border-l-2 border-primary/20 pl-4 text-sm"><p className="font-semibold">{friendlyStatus(a.event_type.replace('assistance_','').replace('creator_','').replaceAll('.',' · '))}{a.detail?.status?' · '+friendlyStatus(a.detail.status):''}</p><time className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('en-ZA')}</time></li>)}</ol>{!activity.length&&<p className="text-sm text-muted-foreground">New case activity will appear here.</p>}</Panel>
  </div>;
}
function SubmissionEditor({value,busy,save}:{value?:any;busy:boolean;save:(p:any)=>Promise<boolean>}) {
  const blank={institution:'',programme:'',institution_type:'university',status:'preparing',reference:'',official_url:'',deadline:'',notes:''};
  const [form,setForm]=useState(value||blank);const submitted=['submitted','awaiting_response','accepted','rejected'].includes(form.status);
  return <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();const p={institution:form.institution.trim(),programme:form.programme.trim(),institution_type:form.institution_type,status:form.status,reference:form.reference.trim(),official_url:form.official_url.trim(),deadline:form.deadline||null,notes:form.notes,submitted_at:value?.submitted_at||(submitted?new Date().toISOString():null)};if(await save(p)&&!value)setForm(blank);}}>
    {(['institution','programme'] as const).map(k=><Field key={k} label={k==='institution'?'Institution':'Programme / qualification'}><Input required minLength={2} maxLength={200} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></Field>)}
    <Field label="Institution type"><select className={selectStyle} value={form.institution_type} onChange={e=>setForm({...form,institution_type:e.target.value})}>{['university','tvet','private','other'].map(s=><option key={s} value={s}>{s==='tvet'?'TVET':s}</option>)}</select></Field>
    <Field label="Status"><select className={selectStyle} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{submissionStates.map(s=><option key={s} value={s}>{friendlyStatus(s)}</option>)}</select></Field>
    <Field label="Institution reference"><Input required={submitted} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
    <Field label="Official portal (https://)"><Input type="url" pattern="https://.*" value={form.official_url} onChange={e=>setForm({...form,official_url:e.target.value})}/></Field>
    <Field label="Deadline"><Input type="date" value={form.deadline||''} onChange={e=>setForm({...form,deadline:e.target.value})}/></Field>
    <Field label="Progress / next steps"><Textarea maxLength={5000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    {form.institution_type==='tvet'&&<p className="rounded-xl bg-muted/40 p-3 text-xs leading-5 sm:col-span-2">Check the programme's published school level, subjects, prior qualifications and placement requirements. Do not impose a universal university APS threshold on TVET applicants.</p>}
    <Button disabled={busy} className="sm:col-span-2">{value?'Save progress':'Add application'}</Button>
  </form>;
}
function CallEditor({value,busy,save}:{value:any;busy:boolean;save:(p:any)=>Promise<boolean>}) {
  const local=value.scheduled_at?new Date(new Date(value.scheduled_at).getTime()-new Date(value.scheduled_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const [form,setForm]=useState({status:value.status,scheduled_at:local,meeting_url:value.meeting_url||'',staff_notes:value.staff_notes||''});
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void save({...form,scheduled_at:form.scheduled_at?new Date(form.scheduled_at).toISOString():null});}}>
    <Field label="Call status"><select className={selectStyle} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['requested','scheduled','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Confirmed time"><Input required={form.status==='scheduled'} type="datetime-local" value={form.scheduled_at} onChange={e=>setForm({...form,scheduled_at:e.target.value})}/></Field>
    <Field label="Meeting link (optional)"><Input type="url" pattern="https://.*" value={form.meeting_url} onChange={e=>setForm({...form,meeting_url:e.target.value})}/></Field>
    <Field label="Confirmation / outcome"><Input value={form.staff_notes} onChange={e=>setForm({...form,staff_notes:e.target.value})}/></Field>
    <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy}>Save call details</Button><Button asChild variant="outline"><a href={'tel:'+value.phone.replace(/[^\d+]/g,'')}>Call student</a></Button></div>
  </form>;
}
