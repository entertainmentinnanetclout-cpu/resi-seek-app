import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import SEO from '@/components/SEO';
import DashboardLayout from '@/components/DashboardLayout';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {supabase} from '@/integrations/supabase/client';

type Profile={id:string;user_id:string;kind:'application'|'residence';slug:string;display_name:string;bio:string;campus:string;tiktok_url:string|null;status:string;bio_review:string;bio_verified_until:string|null};
export default function PublicPartnerProfile(){
 const {pathname}=useLocation();const slug=/^\/partners\/([a-z0-9][a-z0-9-]{2,79})\/?$/.exec(pathname)?.[1]||'';
 const [profile,setProfile]=useState<Profile|null>(null),[link,setLink]=useState(''),[scopes,setScopes]=useState<string[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);setProfile(null);setScopes([]);setLink('');void(async()=>{
  if(!slug){setLoading(false);return;}
  const {data,error}=await(supabase as any).from('rk_partner_profiles').select('id,user_id,kind,slug,display_name,bio,campus,tiktok_url,status,bio_review,bio_verified_until').eq('slug',slug).eq('status','published').maybeSingle();
  if(!live)return;if(error||!data){setLoading(false);return;}
  const [approved,legacy,referral]=await Promise.all([
   (supabase as any).from('rk_partner_scopes').select('scope_kind,scope_value').eq('profile_id',data.id).eq('state','approved'),
   data.kind==='application'?(supabase as any).from('creator_partners').select('slug').eq('user_id',data.user_id).eq('status','active').eq('partner_kind','application').maybeSingle():Promise.resolve({data:null}),
   data.kind==='residence'?(supabase as any).from('referral_codes').select('code').eq('user_id',data.user_id).eq('is_active',true).maybeSingle():Promise.resolve({data:null})
  ]);
  if(!live)return;
  const allowed=(approved.data||[]) as {scope_kind:string;scope_value:string}[];
  const residenceIds=allowed.filter(s=>s.scope_kind==='residence').map(s=>s.scope_value);
  const publicResidenceNames: string[]= [];
  if(data.kind==='residence'&&residenceIds.length){const names=await(supabase as any).from('residences').select('name').in('id',residenceIds).eq('is_visible',true).limit(40);if(!live)return;for(const r of names.data||[])publicResidenceNames.push(r.name);}
  setProfile(data);setScopes([...allowed.filter(s=>s.scope_kind!=='residence').map(s=>s.scope_value),...publicResidenceNames]);
  setLink(data.kind==='application'&&legacy.data?.slug?`/creator-assist/${legacy.data.slug}`:data.kind==='residence'&&referral.data?.code?`/r/${referral.data.code}`:'');setLoading(false);
 })();return()=>{live=false;};},[slug]);
 const verified=Boolean(profile?.status==='published'&&profile.bio_review==='verified'&&profile.bio_verified_until&&Date.parse(profile.bio_verified_until)>Date.now());
 return <DashboardLayout><SEO title={profile?`${profile.display_name} | ResKonnect ${profile.kind==='application'?'Application Assistance':'Accommodation Recruitment'}`:'Partner profile | ResKonnect'} description={profile?.bio||'Find approved student application and accommodation partners on ResKonnect.'} noIndex={!profile}/><main className="mx-auto max-w-4xl space-y-5 px-4 py-10"><nav className="flex gap-3 text-sm"><Link className="underline" to="/partners">Browse partners</Link><Link className="underline" to="/application-assistance">Application assistance</Link></nav>{loading?<p>Loading partner profile…</p>:!profile?<Card><CardContent className="p-8"><h1 className="text-2xl font-bold">Partner unavailable</h1><p className="mt-2 text-muted-foreground">This partner is not currently approved for public listing.</p><Button asChild className="mt-4"><Link to="/partners">Browse approved partners</Link></Button></CardContent></Card>:<><section className="rounded-3xl bg-[#071326] p-8 text-white"><Badge className="bg-[#F5B32F] text-[#071326]">RESKONNECT APPROVED {profile.kind==='application'?'APPLICATION PARTNER':'RESIDENCE RECRUITER'}</Badge><h1 className="mt-4 text-3xl font-black">{profile.display_name}</h1><p className="mt-2 text-white/75">{profile.campus||'Student services'}</p><div className="mt-4 flex flex-wrap gap-2">{verified&&<Badge className="bg-emerald-500 text-slate-950">TikTok bio link verified</Badge>}{profile.tiktok_url&&<Button variant="outline" className="border-white/40 bg-white/10 text-white" asChild><a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer">Visit TikTok</a></Button>}</div></section><Card><CardContent className="space-y-4 p-6"><p className="whitespace-pre-wrap leading-7">{profile.bio||'Helping students access ResKonnect services.'}</p>{scopes.length>0&&<div><h2 className="font-bold">Approved {profile.kind==='application'?'institutions':'recruitment areas and residences'}</h2><div className="mt-2 flex flex-wrap gap-2">{scopes.map((s,i)=><Badge variant="outline" key={s+i}>{s}</Badge>)}</div></div>}{link?<Button asChild size="lg"><Link to={link}>{profile.kind==='application'?'Request application assistance':'Find accommodation with this recruiter'}</Link></Button>:<p className="text-sm text-muted-foreground">Student intake is not available for this partner yet.</p>}<p className="text-xs text-muted-foreground">A public profile or TikTok badge does not grant this partner access to your private account or documents. You must authorise an individual assistance case before sharing information.</p></CardContent></Card></>}</main></DashboardLayout>;
}
