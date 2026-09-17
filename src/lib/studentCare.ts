import { supabase } from '@/integrations/supabase/client';
export const db = supabase as any;
export const friendlyStatus = (s: string) => String(s || '').replaceAll('_', ' ');
export async function readAllPages<T = any>(query: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
export function applicationSemester(row: any): number {
  if (row.academic_cycle === 'semester' && [1, 2].includes(Number(row.academic_period))) return Number(row.academic_period);
  if ([1, 2].includes(Number(row.intake_semester))) return Number(row.intake_semester);
  const date = new Date(row.application_date || row.created_at);
  if (!Number.isFinite(date.getTime())) return 1;
  const parts = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  return Number(row.academic_year) > year ? 1 : month < 7 ? 1 : 2;
}
