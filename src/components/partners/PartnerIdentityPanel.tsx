import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {useAuth} from '@/contexts/AuthContext';
import {supabase} from '@/integrations/supabase/client';
import {publicUrl} from '@/lib/publicUrl';
import {toast} from 'sonner';

type Kind='application'|'residence';
type Profile={id:string;slug:string;display_name:string;bio:string;campus:string;tiktok_url:string|null;status:string;bio_review:string;bio_verified_until:string|null};
type Scope={id:string;scope_kind:string;scope_value:string;state:string};
type Option={id:string;name:string;campus?:string|null;institution_type?:string|null};
type Analytics={link_visits:number;student_cases:number;applications_sent:number;verified_placements:number};
export default function PartnerIdentityPanel({kind,legacySlug,legacyName}:{kind:Kind;legacySlug?:string;legacyName?:string}){
 const {user}=useAuth();const [profile,setProfile]=useState<Profile|null>(null);const [scopes,setScopes]=useState<Scope[]>([]);
 const [options,setOptions]=useState<Option[]>([]);const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [name,setName]=useState('');const [slug,setSlug]=useState('');const [bio,setBio]=useState('');const [campus,setCampus]=useState('');const [tiktok,setTiktok]=useState('');const [scope,setScope]=useState('');const [scopeKind,setScopeKind]=useState<'institution'|'campus'|'residence'>(kind==='application'?'institution':'campus');
 const load=useCallback(async()=>{if(!user){setLoading(false);return;}setLoading(true);
  const [{data,error},choices]=await Promise.all([(supabase as any).from('rk_partner_profiles').select('id,slug,display_name,bio,campus,tiktok_url,status,bio_review,bio_verified_until').eq('user_id',user.id).eq('kind',kind).maybeSingle(),kind==='application'?(supabase as any).from('institutions').select('id,name,institution_type').eq('is_active',true).order('name').limit(500):(supabase as any).from('recruitable_residences_v').select('id,name,campus').order('name').limit(500)]);
  if(error)toast.error(error.message);setOptions(choices.data||[]);const p=data as Profile|null;setProfile(p);
  if(p){setName(p.display_name);setSlug(p.slug);setBio(p.bio);setCampus(p.campus);setTiktok(p.tiktok_url||'');
   const r=await(supabase as any).from('rk_partner_scopes').select('id,scope_kind,scope_value,state').eq('profile_id',p.id).order('scope_kind');setScopes(r.data||[]);
   const verified=p.status==='published'&&p.bio_review==='verified'&&Boolean(p.bio_verified_until&&Date.parse(p.bio_verified_until)>Date.now());
   if(verified){const a=await(supabase as any).rpc('rk_partner_verified_analytics',{p_profile_id:p.id});setAnalytics(a.error?null:a.data);}else setAnalytics(null);
  }else{setName(legacyName||'');setSlug(legacySlug||'');setScopes([]);setAnalytics(null);}
  setLoading(false);
 },[user?.id,kind,legacyName,legacySlug]);
 useEffect(()=>{void load();},[load]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!user)return;setBusy(true);
  const {error}=await(supabase as any).rpc('rk_save_partner_profile',{p_kind:kind,p_slug:slug.trim().toLowerCase(),p_name:name.trim(),p_bio:bio.trim(),p_campus:campus.trim(),p_tiktok_url:tiktok.trim()||null});setBusy(false);
  if(error)return toast.error(error.message);toast.success('Profile saved. ResKonnect must approve publication and assignments.');await load();
 };
 const request=async(e:React.FormEvent)=>{e.preventDefault();if(!profile||!scope.trim())return;setBusy(true);
  const {error}=await(supabase as any).rpc('rk_request_partner_scope',{p_profile_id:profile.id,p_kind:scopeKind,p_value:scope.trim()});setBusy(false);
  if(error)return toast.error(error.message);setScope('');toast.success('Assignment requested for admin approval.');await load();
 };
 const profileUrl=profile?publicUrl('/partners/'+profile.slug):'';
 const verified=Boolean(profile?.status==='published'&&profile?.bio_review==='verified'&&profile.bio_verified_until&&Date.parse(profile.bio_verified_until)>Date.now());
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('Link copied');}catch{toast.error('Copy failed');}};
 if(!user)return null;
 return <Card className="border-primary/20"><CardHeader><CardTitle>My public {kind==='application'?'application-assistance':'residence recruitment'} profile</CardTitle><p className="text-sm text-muted-foreground">Students can discover you without coming from TikTok. An approved profile does not give you access to student records; students authorise individual cases.</p></CardHeader><CardContent className="space-y-5">{loading?<p>Loading partner profile…</p>:<>
 <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{profile?.status||'Not created'}</Badge><Badge variant={verified?'default':'secondary'}>{verified?'Verified TikTok bio':profile?.bio_review==='pending'?'Bio review pending':'Bio link not verified'}</Badge>{verified&&<Badge>Enhanced directory visibility and analytics enabled</Badge>}</div>
 <form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Public display name<Input required maxLength={120} minLength={2} value={name} onChange={e=>setName(e.target.value)}/></label><label className="text-sm font-semibold">Public profile handle<Input required pattern="[a-z0-9][a-z0-9-]{2,79}" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="e.g. tumelo-applications"/></label><label className="text-sm font-semibold">Campus / area<Input maxLength={150} value={campus} onChange={e=>setCampus(e.target.value)} placeholder="Pretoria West"/></label><label className="text-sm font-semibold">TikTok profile URL<Input type="url" maxLength={250} value={tiktok} onChange={e=>setTiktok(e.target.value)} placeholder="https://www.tiktok.com/@yourhandle"/></label><label className="text-sm font-semibold sm:col-span-2">How you assist students<Textarea maxLength={2500} value={bio} onChange={e=>setBio(e.target.value)}/></label><Button disabled={busy} className="sm:col-span-2">{busy?'Saving…':'Save public profile'}</Button></form>
 {profile&&<div className="rounded-xl border bg-muted/30 p-4 text-sm"><p className="font-bold">Your public ResKonnect link</p><p className="mt-1 break-all font-mono text-xs">{profileUrl}</p><p className="mt-2 text-muted-foreground">Place this exact link in your TikTok bio. ResKonnect verifies the live link before granting a badge; verification expires and can be revoked. A bio link never unlocks private student data.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>void copy(profileUrl)}>Copy profile link</Button><Button type="button" variant="outline" disabled={busy||!profile.tiktok_url||verified||profile.bio_review==='pending'} onClick={async()=>{setBusy(true);const {error}=await(supabase as any).rpc('rk_request_bio_review',{p_profile_id:profile.id});setBusy(false);if(error)toast.error(error.message);else{toast.success('Verification requested');await load();}}}>Request bio verification</Button><Button asChild variant="outline"><Link to={'/partners/'+profile.slug}>View public profile</Link></Button></div></div>}
 {profile&&<section className="space-y-3"><h3 className="font-bold">{kind==='application'?'Your universities and TVET colleges':'Your residence recruitment territory'}</h3><p className="text-sm text-muted-foreground">Select where you want to assist students. Admin approval is required for each institution or residence; a campus territory does not automatically authorise every residence.</p><form onSubmit={request} className="flex flex-wrap gap-2"><select className="rounded-md border bg-background p-2 text-sm" aria-label="Assignment type" value={scopeKind} onChange={e=>{setScopeKind(e.target.value as typeof scopeKind);setScope('');}}>{kind==='application'?<option value="institution">University / TVET college</option>:<><option value="campus">Campus / territory</option><option value="residence">Residence</option></>}</select>{scopeKind==='campus'?<Input required className="min-w-[180px] flex-1" value={scope} onChange={e=>setScope(e.target.value)} maxLength={150} placeholder="Campus / territory name"/>:<select required className="min-w-[210px] flex-1 rounded-md border bg-background p-2 text-sm" aria-label={scopeKind==='institution'?'Choose institution':'Choose residence'} value={scope} onChange={e=>setScope(e.target.value)}><option value="">Choose {scopeKind==='institution'?'a university or TVET college':'a residence'}</option>{options.map(o=><option key={o.id} value={scopeKind==='institution'?o.name:o.id}>{o.name} · {o.institution_type||o.campus||''}</option>)}</select>}<Button disabled={busy||!scope.trim()}>Request approval</Button></form><div className="flex flex-wrap gap-2">{scopes.map(s=><Badge variant={s.state==='approved'?'default':'outline'} key={s.id}>{s.scope_kind==='residence'?(options.find(o=>o.id===s.scope_value)?.name||s.scope_value):s.scope_value} · {s.state}</Badge>)}{!scopes.length&&<p className="text-sm text-muted-foreground">No assignments requested yet.</p>}</div></section>}
 {verified&&analytics&&<section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"><h3 className="font-bold">Verified partner · enhanced performance analytics</h3><p className="mt-1 text-xs text-muted-foreground">All-time aggregated activity. This panel contains no student identity or documents.</p><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Tracked visits',analytics.link_visits],['Student cases',analytics.student_cases],['Applications sent',analytics.applications_sent],['Verified placements',analytics.verified_placements]].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-background p-3"><p className="text-2xl font-black">{Number(value||0).toLocaleString('en-ZA')}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div></section>}
 </>}</CardContent></Card>;
}
