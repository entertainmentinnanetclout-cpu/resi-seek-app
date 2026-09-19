import {useCallback,useEffect,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {supabase} from '@/integrations/supabase/client';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Badge} from '@/components/ui/badge';
import {toast} from 'sonner';

type Staff={id:string;email:string|null;full_name:string|null;staff_role:string|null};
type Assignment={user_id:string;kind:'application'|'residence';is_active:boolean};
export default function PartnerStaffRoleManager(){
 const {user,isGodMode}=useAuth();const [query,setQuery]=useState('');const [staff,setStaff]=useState<Staff[]>([]);const [roles,setRoles]=useState<Assignment[]>([]);const [busy,setBusy]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async(search:string)=>{if(!isGodMode)return;setLoading(true);setError('');
  const {data,error:accountsError}=await(supabase as any).rpc('admin_list_staff_accounts',{p_search:search.trim()||null});
  if(accountsError){setError(accountsError.message);setLoading(false);return;}
  const rows=((data||[]) as Staff[]).filter(x=>x.id!==user?.id);setStaff(rows);
  if(rows.length){const {data:assigned,error:rolesError}=await(supabase as any).from('rk_partner_staff_roles').select('user_id,kind,is_active').in('user_id',rows.map(x=>x.id));
   if(rolesError)setError(rolesError.message);setRoles(assigned||[]);
  }else setRoles([]);
  setLoading(false);
 },[isGodMode,user?.id]);
 useEffect(()=>{if(!isGodMode)return;const t=window.setTimeout(()=>void load(query),query?300:0);return()=>window.clearTimeout(t);},[load,query,isGodMode]);
 const enabled=(userId:string,kind:'application'|'residence')=>roles.some(r=>r.user_id===userId&&r.kind===kind&&r.is_active);
 const change=async(account:Staff,kind:'application'|'residence')=>{const next=!enabled(account.id,kind);const label=kind==='application'?'Applications Admin':'Residence Admin';
  if(!window.confirm(`${next?'Grant':'Revoke'} ${label} for ${account.full_name||account.email||'this account'}? This role may approve partners and assignments in its own workspace.`))return;
  setBusy(account.id+kind);const {error:changeError}=await(supabase as any).rpc('rk_admin_set_partner_staff_role',{p_user_id:account.id,p_kind:kind,p_enabled:next});setBusy('');
  if(changeError)return toast.error(changeError.message);toast.success(`${label} ${next?'assigned':'revoked'}.`);await load(query);
 };
 if(!isGodMode)return null;
 return <Card className="border-primary/30"><CardHeader><CardTitle>God Mode · Application and Residence Admin roles</CardTitle><p className="text-sm text-muted-foreground">Grant distinct operational roles to registered internal staff. These roles do not grant God Mode, finance or unrelated student-data access. Role changes require your verified two-factor session and are audited.</p></CardHeader><CardContent className="space-y-3"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search registered staff by email or name" aria-label="Search staff accounts"/>
 {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
 {loading?<p className="text-sm text-muted-foreground">Loading authorised account directory…</p>:<div className="max-h-96 space-y-2 overflow-y-auto">{staff.map(account=><div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-semibold">{account.full_name||account.email||'Registered account'}</p><p className="truncate text-xs text-muted-foreground">{account.email||'No email'} · {account.staff_role||'No platform staff role'}</p></div><div className="flex flex-wrap gap-2">{(['application','residence'] as const).map(kind=><Button size="sm" key={kind} variant={enabled(account.id,kind)?'default':'outline'} disabled={Boolean(busy)} onClick={()=>void change(account,kind)}>{kind==='application'?'Applications Admin':'Residence Admin'} {enabled(account.id,kind)?'✓':'+'}</Button>)}</div></div>)}{staff.length===0&&!error&&<p className="text-sm text-muted-foreground">No matching registered accounts. The person must create a ResKonnect account before a role can be assigned.</p>}</div>}
 <Badge variant="outline">Only God Mode can grant or revoke these roles</Badge></CardContent></Card>;
}
