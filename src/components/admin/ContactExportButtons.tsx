import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/studentCare';
import { contactName, downloadText, toCsv, toVcard, type ExportContact } from '@/lib/contactExport';
import { toast } from 'sonner';
export default function ContactExportButtons() {
  const [busy,setBusy] = useState(false);
  const run = async (format: 'vcf' | 'csv') => {
    setBusy(true);
    try {
      const rows: ExportContact[] = [];
      for (let offset = 0; ; offset += 500) {
        const {data,error} = await db.rpc('rk_export_contacts',{p_offset:offset,p_limit:500}); if(error) throw error;
        rows.push(...(data?.rows || [])); if((data?.rows || []).length < 500) break;
      }
      if(!rows.length) { toast.info('No contacts available'); return; }
      const content = format === 'vcf' ? toVcard(rows) : toCsv(rows.map(c=>({Name:contactName(c.full_name),Phone:c.phone,Email:c.email,Campus:c.campus,'Preferred residence':c.preferred_residence,Course:c.course,Funding:c.funding_type,'Academic year':c.academic_year,Placement:c.placement_status,Source:c.sources})));
      downloadText('ResKonnect_RK_2027_Contacts.'+format,content,format==='vcf'?'text/vcard;charset=utf-8':'text/csv;charset=utf-8'); toast.success(rows.length+' contacts exported');
    } catch(error:any) { toast.error(error.message || 'Export failed'); } finally { setBusy(false); }
  };
  return <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void run('vcf')}><Download className="mr-2 h-4 w-4"/>{busy?'Preparing…':'Phone contacts (.vcf)'}</Button><Button variant="outline" disabled={busy} onClick={()=>void run('csv')}>Download CSV</Button></div>;
}
