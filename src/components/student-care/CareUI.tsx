import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export const selectStyle = 'h-11 w-full rounded-md border bg-background px-3 text-sm';
export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={'space-y-2 text-sm font-medium ' + (wide ? 'sm:col-span-2' : '')}><span className="block">{label}</span>{children}</label>;
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}
export function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className={'flex items-start gap-3 text-sm ' + (disabled ? 'opacity-50' : '')}><input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)}/><span>{label}</span></label>;
}
