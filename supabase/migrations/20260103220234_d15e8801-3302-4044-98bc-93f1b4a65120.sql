-- Update bursaries with correct 2026 deadlines and add image_url
ALTER TABLE bursaries ADD COLUMN IF NOT EXISTS image_url text;

-- Update existing bursaries with 2026 dates and images
UPDATE bursaries SET deadline = '2025-11-30', image_url = 'https://logo.clearbit.com/nsfas.org.za' WHERE name ILIKE '%NSFAS%' OR provider ILIKE '%NSFAS%';
UPDATE bursaries SET deadline = '2026-01-15', image_url = 'https://logo.clearbit.com/education.gov.za' WHERE name ILIKE '%Funza%';
UPDATE bursaries SET deadline = '2026-03-31', image_url = 'https://logo.clearbit.com/sasol.com' WHERE provider ILIKE '%Sasol%';
UPDATE bursaries SET deadline = '2026-03-15', image_url = 'https://logo.clearbit.com/eskom.co.za' WHERE provider ILIKE '%Eskom%';
UPDATE bursaries SET deadline = '2026-02-28', image_url = 'https://logo.clearbit.com/allangrayorbis.org' WHERE provider ILIKE '%Allan Gray%';
UPDATE bursaries SET deadline = '2026-03-31', image_url = 'https://logo.clearbit.com/angloamerican.com' WHERE provider ILIKE '%Anglo%';
UPDATE bursaries SET deadline = '2026-04-30', image_url = 'https://logo.clearbit.com/standardbank.co.za' WHERE provider ILIKE '%Standard Bank%';
UPDATE bursaries SET deadline = '2026-05-31', image_url = 'https://logo.clearbit.com/oldmutual.co.za' WHERE provider ILIKE '%Old Mutual%';
UPDATE bursaries SET deadline = '2026-03-31', image_url = 'https://logo.clearbit.com/shoprite.co.za' WHERE provider ILIKE '%Shoprite%';
UPDATE bursaries SET deadline = '2026-02-28', image_url = 'https://logo.clearbit.com/mtn.co.za' WHERE provider ILIKE '%MTN%';
UPDATE bursaries SET deadline = '2026-04-15', image_url = 'https://logo.clearbit.com/nedbank.co.za' WHERE provider ILIKE '%Nedbank%';
UPDATE bursaries SET deadline = '2026-06-30', image_url = 'https://logo.clearbit.com/capitecbank.co.za' WHERE provider ILIKE '%Capitec%';
UPDATE bursaries SET deadline = '2026-08-31', image_url = 'https://logo.clearbit.com/saica.co.za' WHERE provider ILIKE '%SAICA%' OR name ILIKE '%Thuthuka%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/discovery.co.za' WHERE provider ILIKE '%Discovery%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/absa.co.za' WHERE provider ILIKE '%Absa%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/fnb.co.za' WHERE provider ILIKE '%FNB%' OR provider ILIKE '%First National%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/investec.com' WHERE provider ILIKE '%Investec%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/vodacom.co.za' WHERE provider ILIKE '%Vodacom%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/telkom.co.za' WHERE provider ILIKE '%Telkom%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/transnet.net' WHERE provider ILIKE '%Transnet%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/deloitte.com' WHERE provider ILIKE '%Deloitte%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/pwc.com' WHERE provider ILIKE '%PwC%' OR provider ILIKE '%PricewaterhouseCoopers%';
UPDATE bursaries SET image_url = 'https://logo.clearbit.com/gov.za' WHERE provider ILIKE '%Department%' OR type = 'government';

-- Insert real corporate bursaries for 2026
INSERT INTO bursaries (name, provider, amount, deadline, fields_of_study, requirements, link, type, description, is_active, image_url)
VALUES 
  ('Discovery Health Sciences Bursary 2026', 'Discovery Health', 'Full tuition + allowance', '2026-04-30',
   ARRAY['Medicine', 'Actuarial Science', 'Data Science', 'Health Sciences'],
   ARRAY['South African citizen', 'Minimum 70% average', 'Strong mathematics background', 'Passion for healthcare'],
   'https://www.discovery.co.za/corporate/careers-bursaries', 'private',
   'Discovery offers bursaries to students pursuing careers in health sciences, actuarial science, and data analytics.', true,
   'https://logo.clearbit.com/discovery.co.za'),

  ('Absa Ready to Work Bursary 2026', 'Absa Bank', 'Full tuition + laptop + stipend', '2026-04-30',
   ARRAY['Finance', 'Accounting', 'IT', 'Commerce', 'Data Science', 'Economics'],
   ARRAY['South African citizen', 'Minimum 65% average', 'Financial need consideration', 'Strong academic record'],
   'https://www.absa.co.za/about-us/careers/students/', 'private',
   'Absa provides comprehensive bursaries for students in financial services and technology fields.', true,
   'https://logo.clearbit.com/absa.co.za'),

  ('FNB Fund Bursary 2026', 'First National Bank', 'Full tuition + monthly stipend', '2026-03-31',
   ARRAY['Finance', 'Economics', 'IT', 'Engineering', 'Mathematics', 'Computer Science'],
   ARRAY['South African citizen', 'Academic excellence', 'Leadership potential', 'Community involvement'],
   'https://www.fnb.co.za/about-fnb/careers/bursaries.html', 'private',
   'FNB Fund supports talented students pursuing degrees in banking, technology, and related sectors.', true,
   'https://logo.clearbit.com/fnb.co.za'),

  ('Investec Chartered Accountant Bursary 2026', 'Investec', 'Full funding + vacation work', '2026-02-28',
   ARRAY['Accounting', 'Finance', 'Actuarial Science', 'Investment Management'],
   ARRAY['South African citizen', 'Top academic performer', 'Strong analytical skills', 'Pursuing CA qualification'],
   'https://www.investec.com/en_za/welcome-to-investec/careers/students.html', 'private',
   'Investec invests in exceptional students with a passion for finance and chartered accountancy.', true,
   'https://logo.clearbit.com/investec.com'),

  ('Vodacom Bursary Programme 2026', 'Vodacom South Africa', 'Full tuition + laptop', '2026-04-15',
   ARRAY['IT', 'Computer Science', 'Electronic Engineering', 'Telecommunications', 'Data Science'],
   ARRAY['South African citizen', 'Minimum 65% average', 'Registered at accredited institution', 'Interest in technology'],
   'https://www.vodacom.co.za/vodacom/careers/bursaries', 'private',
   'Vodacom supports students pursuing careers in technology and telecommunications.', true,
   'https://logo.clearbit.com/vodacom.co.za'),

  ('Telkom ICT Bursary 2026', 'Telkom SA', 'Full tuition + internship', '2026-03-31',
   ARRAY['IT', 'Telecommunications', 'Electronic Engineering', 'Computer Science', 'Software Development'],
   ARRAY['South African citizen', 'Minimum 65% average', 'Passion for technology', 'Strong mathematics'],
   'https://www.telkom.co.za/about-us/careers/bursaries', 'private',
   'Telkom supports students pursuing careers in ICT and telecommunications.', true,
   'https://logo.clearbit.com/telkom.co.za'),

  ('Transnet Engineering Bursary 2026', 'Transnet SOC Ltd', 'Full tuition + accommodation', '2026-04-15',
   ARRAY['Engineering', 'Logistics', 'Transport Economics', 'Rail Engineering', 'Mechanical Engineering'],
   ARRAY['South African citizen', 'Minimum 60% in Maths and Science', 'Willing to work for Transnet after studies'],
   'https://www.transnet.net/Careers/Bursaries/Pages/default.aspx', 'government',
   'Transnet offers bursaries in transport, logistics, and engineering disciplines.', true,
   'https://logo.clearbit.com/transnet.net'),

  ('Deloitte CA Bursary 2026', 'Deloitte South Africa', 'Full tuition + graduate programme', '2026-03-15',
   ARRAY['Accounting', 'Auditing', 'Finance', 'IT Audit', 'Consulting'],
   ARRAY['South African citizen', 'Minimum 65% average', 'Strong communication skills', 'Pursuing BCom Accounting'],
   'https://www2.deloitte.com/za/en/careers/students.html', 'private',
   'Deloitte invests in future audit and consulting professionals.', true,
   'https://logo.clearbit.com/deloitte.com'),

  ('PwC Bursary Programme 2026', 'PricewaterhouseCoopers', 'Full funding + vacation work', '2026-02-15',
   ARRAY['Accounting', 'Finance', 'IT', 'Actuarial Science', 'Tax'],
   ARRAY['South African citizen', 'Academic excellence', 'Professional aptitude', 'Leadership qualities'],
   'https://www.pwc.co.za/en/careers/student-careers.html', 'private',
   'PwC supports talented students pursuing professional qualifications in accounting and related fields.', true,
   'https://logo.clearbit.com/pwc.com'),

  ('NSFAS 2026', 'National Student Financial Aid Scheme', 'Full tuition + living allowance + books + transport', '2025-11-30',
   ARRAY['All Fields'],
   ARRAY['South African citizen', 'Combined household income below R350,000', 'Accepted at public university or TVET'],
   'https://www.nsfas.org.za', 'government',
   'NSFAS provides comprehensive financial aid to eligible South African students at public universities and TVET colleges.', true,
   'https://logo.clearbit.com/nsfas.org.za'),

  ('Funza Lushaka Teaching Bursary 2026', 'Department of Basic Education', 'Full tuition + allowance', '2026-01-15',
   ARRAY['Education', 'Teaching', 'Mathematics Education', 'Science Education', 'Languages'],
   ARRAY['South African citizen', 'Committed to teaching career', 'Strong academic record', 'Pass in relevant subjects'],
   'https://www.funzalushaka.doe.gov.za', 'government',
   'Funza Lushaka provides bursaries for students pursuing teaching qualifications in priority subjects.', true,
   'https://logo.clearbit.com/education.gov.za')
ON CONFLICT DO NOTHING;