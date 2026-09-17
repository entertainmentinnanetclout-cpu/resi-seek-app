export type ExportContact = { full_name: string; phone?: string; email?: string; campus?: string; course?: string; preferred_residence?: string; funding_type?: string; academic_year?: number; placement_status?: string; sources?: string };
export const contactName = (name: string) => 'RK 2027 ' + String(name || 'Student').replace(/^RK\s+\d{4}\s+/i, '').trim();
const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\r\n');
}
const escapeVcard = (v: unknown) => String(v ?? '').replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
function fold(line: string): string {
  const encoder = new TextEncoder(), lines: string[] = []; let part = '', bytes = 0;
  for (const char of line) { const length = encoder.encode(char).length; if (bytes + length > 75) { lines.push(part); part = ' '; bytes = 1; } part += char; bytes += length; }
  lines.push(part); return lines.join('\r\n');
}
export function toVcard(contacts: ExportContact[]): string {
  return contacts.map(c => {
    const notes = [['Campus',c.campus],['Preferred residence',c.preferred_residence],['Course',c.course],['Funding',c.funding_type],['Academic year',c.academic_year],['Placement',c.placement_status],['Source',c.sources]]
      .filter(([,v]) => v != null && v !== '').map(([k,v]) => k + ': ' + v).join('\n');
    return ['BEGIN:VCARD','VERSION:3.0','FN:' + escapeVcard(contactName(c.full_name)), 'N:;' + escapeVcard(contactName(c.full_name)) + ';;;','ORG:ResKonnect',
      ...(c.phone ? ['TEL;TYPE=CELL:' + escapeVcard(c.phone)] : []), ...(c.email ? ['EMAIL;TYPE=INTERNET:' + escapeVcard(c.email)] : []),
      'NOTE:' + escapeVcard(notes),'END:VCARD'].map(fold).join('\r\n');
  }).join('\r\n') + '\r\n';
}
export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
