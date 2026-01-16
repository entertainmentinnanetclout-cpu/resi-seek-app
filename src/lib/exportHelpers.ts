import { format } from "date-fns";

// vCard export helper for mobile contacts
export function generateVCard(contacts: Array<{
  name: string;
  phone: string | null;
  email: string | null;
  campus?: string | null;
  studentNumber?: string | null;
  residenceApplied?: string | null;
  status?: string | null;
}>): string {
  return contacts
    .filter(c => c.phone) // Only include contacts with phone numbers
    .map(contact => {
      const notes = [
        contact.campus && `Campus: ${contact.campus}`,
        contact.studentNumber && `Student #: ${contact.studentNumber}`,
        contact.residenceApplied && `Applied: ${contact.residenceApplied}`,
        contact.status && `Status: ${contact.status}`,
      ].filter(Boolean).join('\\n');

      return `BEGIN:VCARD
VERSION:3.0
FN:RK Student - ${contact.name || 'Unknown'}
TEL;TYPE=CELL:${formatPhoneNumber(contact.phone)}
EMAIL:${contact.email || ''}
NOTE:${notes}
CATEGORIES:ResKonnect Students
END:VCARD`;
    })
    .join('\n');
}

// Format phone number with country code
export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with +27 (South Africa)
  if (digits.startsWith('0')) {
    return '+27' + digits.substring(1);
  }
  
  // If already starts with 27, add +
  if (digits.startsWith('27')) {
    return '+' + digits;
  }
  
  return phone;
}

// Download vCard file
export function downloadVCard(contacts: Array<{
  name: string;
  phone: string | null;
  email: string | null;
  campus?: string | null;
  studentNumber?: string | null;
  residenceApplied?: string | null;
  status?: string | null;
}>, filename?: string): void {
  const vcfContent = generateVCard(contacts);
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `reskonnect-contacts-${format(new Date(), 'yyyy-MM-dd')}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

// Enhanced CSV export with all student data
export function generateEnhancedCSV(students: Array<{
  name: string;
  phone: string | null;
  email: string | null;
  campus?: string | null;
  studentNumber?: string | null;
  residenceApplied?: string | null;
  status?: string | null;
  applicationDate?: string | null;
  documentsCount?: number;
  yearOfStudy?: string | null;
}>): string {
  const headers = [
    'Name (RK Student)',
    'Phone',
    'Email',
    'Campus',
    'Student Number',
    'Residence Applied',
    'Status',
    'Application Date',
    'Documents Uploaded',
    'Year of Study'
  ];

  const rows = students.map(student => [
    `RK Student ${student.name || 'Unknown'}`,
    formatPhoneNumber(student.phone),
    student.email || '',
    student.campus || '',
    student.studentNumber || '',
    student.residenceApplied || '',
    student.status || '',
    student.applicationDate || '',
    student.documentsCount?.toString() || '0',
    student.yearOfStudy || ''
  ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}

// Download enhanced CSV
export function downloadEnhancedCSV(students: Array<{
  name: string;
  phone: string | null;
  email: string | null;
  campus?: string | null;
  studentNumber?: string | null;
  residenceApplied?: string | null;
  status?: string | null;
  applicationDate?: string | null;
  documentsCount?: number;
  yearOfStudy?: string | null;
}>, filename?: string): void {
  const csvContent = generateEnhancedCSV(students);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `reskonnect-students-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Smart call list - prioritized for follow-up
export function generateCallList(applications: Array<{
  studentName: string;
  phone: string | null;
  email: string | null;
  residenceName: string | null;
  status: string;
  applicationDate: string;
  lastContacted?: string | null;
}>): Array<{
  priority: 'urgent' | 'high' | 'normal';
  reason: string;
  studentName: string;
  phone: string;
  email: string | null;
  residenceName: string | null;
  status: string;
  daysSinceApplication: number;
}> {
  const now = new Date();
  
  return applications
    .filter(app => app.phone) // Must have phone
    .map(app => {
      const appDate = new Date(app.applicationDate);
      const daysSinceApplication = Math.floor((now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let priority: 'urgent' | 'high' | 'normal' = 'normal';
      let reason = '';
      
      // Determine priority
      if (app.status === 'approved' && daysSinceApplication > 7) {
        priority = 'urgent';
        reason = 'Approved but no move-in confirmation';
      } else if (app.status === 'documents_required') {
        priority = 'urgent';
        reason = 'Documents required';
      } else if ((app.status === 'submitted' || app.status === 'pending') && daysSinceApplication > 5) {
        priority = 'high';
        reason = 'Pending application > 5 days';
      } else if (app.status === 'submitted' || app.status === 'pending') {
        priority = 'normal';
        reason = 'Pending review';
      }
      
      return {
        priority,
        reason,
        studentName: app.studentName,
        phone: formatPhoneNumber(app.phone),
        email: app.email,
        residenceName: app.residenceName,
        status: app.status,
        daysSinceApplication
      };
    })
    .filter(item => item.reason) // Only include items with a reason
    .sort((a, b) => {
      // Sort by priority first, then by days since application
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.daysSinceApplication - a.daysSinceApplication;
    });
}
