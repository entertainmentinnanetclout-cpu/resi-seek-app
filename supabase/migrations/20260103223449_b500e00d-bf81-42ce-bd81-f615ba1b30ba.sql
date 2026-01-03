-- =============================================
-- MASTER FIX: RLS + VERIFIED BURSARIES
-- =============================================

-- PART 1: FIX THE BROKEN RLS POLICY
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- PART 2: DELETE ALL BROKEN BURSARIES
DELETE FROM bursaries;

-- PART 3: INSERT VERIFIED 2026 BURSARIES WITH WORKING LINKS
INSERT INTO bursaries (name, provider, amount, deadline, fields_of_study, requirements, link, type, description, is_active, image_url)
VALUES 
('NSFAS 2026 Funding', 'National Student Financial Aid Scheme', 'Full funding (tuition, accommodation, meals, books, transport)', '2025-11-30',
 ARRAY['All Fields'],
 ARRAY['South African citizen', 'Combined household income under R350,000', 'Accepted at public university/TVET'],
 'https://www.nsfas.org.za', 'government',
 'NSFAS provides financial aid to eligible students at public universities and TVET colleges. 2026 applications are now CLOSED.', true,
 'https://www.nsfas.org.za/content/images/10.png'),

('Funza Lushaka Teaching Bursary 2026', 'Department of Basic Education', 'Full funding for teaching degrees', '2026-01-31',
 ARRAY['Education', 'Teaching', 'Foundation Phase', 'Intermediate Phase', 'Senior Phase', 'FET Phase'],
 ARRAY['South African citizen', 'Want to become a teacher', 'Minimum 60% in Grade 12', 'Willing to teach in public schools after graduation'],
 'https://www.funzalushaka.doe.gov.za', 'government',
 'Full bursary for students pursuing a teaching qualification. Must commit to teaching in public schools.', true,
 'https://www.funzalushaka.doe.gov.za/Content/Images/image1-newLogo.jpg'),

('Sasol Bursary Programme 2026', 'Sasol Limited', 'Full tuition + accommodation + stipend', '2026-04-30',
 ARRAY['Chemical Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Mining Engineering', 'Chemistry', 'Physics'],
 ARRAY['South African citizen', 'Minimum 65% in Maths and Physical Science', 'Strong academic record'],
 'https://www.sasolbursaries.com/welcome/', 'private',
 'Sasol invests in future engineers and scientists. Includes vacation work experience.', true,
 NULL),

('Investec Tertiary Bursary 2026', 'Investec', 'Full tuition + living allowance', '2025-09-30',
 ARRAY['Accounting', 'Finance', 'Actuarial Science', 'Economics', 'Investment Management', 'IT'],
 ARRAY['South African citizen', 'Strong academic record', 'Financial need'],
 'https://studytrust.org.za/bursary-applications/', 'private',
 'Investec provides full bursaries via StudyTrust for finance-sector degrees.', true,
 NULL),

('Absa Fellowship Programme 2026', 'Absa Group', 'Full funding + laptop + mentorship', '2025-09-10',
 ARRAY['Commerce', 'Finance', 'Economics', 'Accounting', 'IT', 'Data Science'],
 ARRAY['South African citizen', 'Academic excellence', 'Leadership potential'],
 'https://absa-bsp.fundi.co.za/', 'private',
 'A transformative initiative fostering entrepreneurship and leadership.', true,
 NULL),

('Eskom Engineering Bursary 2026', 'Eskom Holdings', 'Full tuition + accommodation + stipend + laptop', '2025-11-14',
 ARRAY['Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Industrial Engineering'],
 ARRAY['South African citizen', 'Minimum 60% in Maths and Science', 'Pursuing BEng or BSc Engineering'],
 'https://eskomcareers.ci.hr/', 'government',
 'Eskom offers full bursaries for engineering students with vacation work.', true,
 NULL),

('Transnet Bursary Programme 2026', 'Transnet SOC Ltd', 'Full tuition + accommodation', '2025-10-06',
 ARRAY['Engineering', 'Logistics', 'IT', 'Accounting', 'Data Analytics', 'Supply Chain Management'],
 ARRAY['South African citizen', 'Strong academic record', 'Willing to work for Transnet after studies'],
 'https://www.transnet.net/YouthDevelopmentProgrammes', 'government',
 'Transnet offers bursaries for technical and non-technical undergraduate studies.', true,
 NULL),

('Allan Gray Orbis Fellowship 2026', 'Allan Gray Orbis Foundation', 'Full funding + entrepreneurship training', '2026-02-28',
 ARRAY['Any Field'],
 ARRAY['South African citizen', 'Grade 11 or 12', 'Exceptional academic ability', 'Entrepreneurial potential'],
 'https://www.allangrayorbis.org', 'ngo',
 'Prestigious fellowship for future entrepreneurs with full university funding.', true,
 NULL),

('PwC Bursary Programme 2026', 'PricewaterhouseCoopers', 'Full tuition + vacation work', '2026-02-28',
 ARRAY['Accounting', 'Auditing', 'Finance', 'IT Audit', 'Tax', 'Consulting'],
 ARRAY['South African citizen', 'Pursuing BCom Accounting or similar', 'Strong academic record'],
 'https://www.pwc.co.za/en/careers/student-careers.html', 'private',
 'PwC invests in future audit and consulting professionals.', true,
 NULL),

('Deloitte Bursary Programme 2026', 'Deloitte South Africa', 'Full tuition + graduate programme', '2026-03-31',
 ARRAY['Accounting', 'Auditing', 'Finance', 'IT', 'Consulting', 'Risk Advisory'],
 ARRAY['South African citizen', 'Minimum 65% average', 'Pursuing CA or relevant qualification'],
 'https://www2.deloitte.com/za/en/careers/students.html', 'private',
 'Deloitte develops future business leaders through comprehensive bursary programmes.', true,
 NULL),

('Discovery Foundation Health Bursary 2026', 'Discovery', 'Varies by programme', '2026-05-31',
 ARRAY['Medicine', 'Health Sciences', 'Nursing', 'Pharmacy', 'Public Health'],
 ARRAY['South African citizen', 'Medical or health sciences student', 'Strong academic record'],
 'https://www.discovery.co.za/corporate/discovery-foundation-awards', 'private',
 'Discovery Foundation supports healthcare education.', true,
 NULL),

('Standard Bank Bursary 2026', 'Standard Bank', 'Full tuition + mentorship', '2026-04-30',
 ARRAY['Commerce', 'Finance', 'IT', 'Data Science', 'Economics', 'Actuarial Science'],
 ARRAY['South African citizen', 'Academic excellence', 'Leadership potential'],
 'https://careers.standardbank.com/', 'private',
 'Standard Bank provides bursaries for talented students in banking and finance.', true,
 NULL),

('Vodacom Bursary Programme 2026', 'Vodacom South Africa', 'Full tuition + laptop + cellphone', '2026-04-30',
 ARRAY['IT', 'Computer Science', 'Electronic Engineering', 'Telecommunications', 'Data Science'],
 ARRAY['South African citizen', 'Minimum 65% average', 'STEM field of study'],
 'https://www.vodacom.co.za/vodacom/careers', 'private',
 'Vodacom Merit Bursary for STEM students with laptop and cellphone.', true,
 NULL),

('MTN SA Foundation Bursary 2026', 'MTN South Africa', 'Full tuition + allowance', '2026-03-31',
 ARRAY['IT', 'Engineering', 'Commerce', 'Science'],
 ARRAY['South African citizen', 'Strong academic record', 'Financial need'],
 'https://www.mtn.com/careers/', 'private',
 'MTN Foundation supports education for South African youth.', true,
 NULL),

('Nedbank Bursary Programme 2026', 'Nedbank', 'Full tuition + work experience', '2026-04-30',
 ARRAY['Finance', 'Accounting', 'IT', 'Economics', 'Actuarial Science', 'Data Science'],
 ARRAY['South African citizen', 'Academic excellence', 'Leadership qualities'],
 'https://www.nedbank.co.za/content/nedbank/desktop/gt/en/aboutus/green-and-caring/investing-in-education.html', 'private',
 'Nedbank invests in education for finance and IT students.', true,
 NULL),

('ISFAP Bursary 2026', 'Ikusasa Student Financial Aid Programme', 'Full comprehensive funding', '2026-01-31',
 ARRAY['Accounting', 'Actuarial Science', 'Engineering', 'IT', 'Finance'],
 ARRAY['South African citizen', 'Missing middle household income (R350k-R600k)', 'Strong academic record'],
 'https://www.isfap.co.za/', 'ngo',
 'ISFAP supports missing middle students with comprehensive funding.', true,
 NULL);