
-- =====================================================
-- RESIDENCE APPLICATION INBOX - DATABASE FOUNDATION
-- =====================================================

-- 1. Add residence_portal to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'residence_portal';

-- 2. Create residence_portal_accounts table (single user per residence)
CREATE TABLE IF NOT EXISTS residence_portal_accounts (
  residence_id UUID PRIMARY KEY REFERENCES residences(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for residence_portal_accounts
CREATE INDEX IF NOT EXISTS idx_rpa_user_id ON residence_portal_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_rpa_email ON residence_portal_accounts(email);
CREATE INDEX IF NOT EXISTS idx_rpa_is_active ON residence_portal_accounts(is_active);

-- 3. Extend applications table with new columns
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS funding_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS desired_move_in DATE,
  ADD COLUMN IF NOT EXISTS student_profile JSONB DEFAULT '{}';

-- Create index for portal queries on applications
CREATE INDEX IF NOT EXISTS idx_applications_residence_status 
  ON applications(residence_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_funding_type 
  ON applications(funding_type);

-- 4. Create application_documents table
CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES residences(id),
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  rejection_reason TEXT,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ
);

-- Indexes for application_documents
CREATE INDEX IF NOT EXISTS idx_app_docs_residence ON application_documents(residence_id, application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_type ON application_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_app_docs_status ON application_documents(status);
CREATE INDEX IF NOT EXISTS idx_app_docs_application ON application_documents(application_id);

-- 5. Create application_messages table
CREATE TABLE IF NOT EXISTS application_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES residences(id),
  sender_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for application_messages
CREATE INDEX IF NOT EXISTS idx_app_messages_residence 
  ON application_messages(residence_id, application_id, created_at DESC);

-- 6. Create application_activity_log table (audit trail)
CREATE TABLE IF NOT EXISTS application_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES residences(id),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for application_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_residence 
  ON application_activity_log(residence_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON application_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON application_activity_log(actor_user_id);

-- 7. Create referral_claims table (NSFAS billing)
CREATE TABLE IF NOT EXISTS referral_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES residences(id),
  student_ref TEXT,
  funding_type TEXT NOT NULL,
  claim_status TEXT NOT NULL DEFAULT 'pending_nsfas',
  claim_amount NUMERIC,
  academic_year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Index for referral_claims
CREATE INDEX IF NOT EXISTS idx_claims_residence 
  ON referral_claims(residence_id, claim_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_status ON referral_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_claims_year ON referral_claims(academic_year);

-- 8. Create storage bucket for application documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('application-documents', 'application-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- 9. Create helper function for residence portal authorization
CREATE OR REPLACE FUNCTION is_authorized_residence_user(target_residence_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM residence_portal_accounts rpa
    WHERE rpa.user_id = auth.uid()
      AND rpa.is_active = true
      AND rpa.residence_id = target_residence_id
  )
$$;

-- 10. Create function to get user's residence_id
CREATE OR REPLACE FUNCTION get_user_residence_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT residence_id FROM residence_portal_accounts
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- 11. Generate short reference code from UUID
CREATE OR REPLACE FUNCTION generate_ref_code(app_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(SUBSTRING(REPLACE(app_id::text, '-', '') FROM 1 FOR 8))
$$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE residence_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- residence_portal_accounts POLICIES
-- =====================================================

-- Portal users can only see their own record
CREATE POLICY "Portal users see own record"
  ON residence_portal_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Only admins can manage portal accounts
CREATE POLICY "Admins manage portal accounts"
  ON residence_portal_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- applications POLICIES (Extended for residence portal)
-- =====================================================

-- Residence portal users can view their residence's applications
CREATE POLICY "Residence portal view applications"
  ON applications FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- Residence portal users can update applications (status changes)
CREATE POLICY "Residence portal update applications"
  ON applications FOR UPDATE
  USING (is_authorized_residence_user(residence_id));

-- =====================================================
-- application_documents POLICIES
-- =====================================================

-- Residence portal users can view their docs
CREATE POLICY "Residence portal view docs"
  ON application_documents FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- Residence portal users can update doc status
CREATE POLICY "Residence portal update doc status"
  ON application_documents FOR UPDATE
  USING (is_authorized_residence_user(residence_id));

-- Students can insert docs for their applications
CREATE POLICY "Students upload docs"
  ON application_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- Students can view their own application docs
CREATE POLICY "Students view own app docs"
  ON application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- Admins can manage all docs
CREATE POLICY "Admins manage all docs"
  ON application_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- application_messages POLICIES
-- =====================================================

-- Residence portal users can view messages
CREATE POLICY "Residence portal view messages"
  ON application_messages FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- Residence portal users can send messages
CREATE POLICY "Residence portal send messages"
  ON application_messages FOR INSERT
  WITH CHECK (
    is_authorized_residence_user(residence_id) AND
    sender_type = 'residence' AND
    sender_user_id = auth.uid()
  );

-- Students can view messages for their applications
CREATE POLICY "Students view own messages"
  ON application_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- Students can send messages
CREATE POLICY "Students send messages"
  ON application_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ) AND sender_type = 'student' AND sender_user_id = auth.uid()
  );

-- Admins can manage all messages
CREATE POLICY "Admins manage all messages"
  ON application_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- application_activity_log POLICIES
-- =====================================================

-- Residence portal users can view activity for their applications
CREATE POLICY "Residence portal view activity"
  ON application_activity_log FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- Residence portal users can insert activity logs
CREATE POLICY "Residence portal log activity"
  ON application_activity_log FOR INSERT
  WITH CHECK (
    is_authorized_residence_user(residence_id) AND
    actor_type = 'residence' AND
    actor_user_id = auth.uid()
  );

-- System can insert logs (for edge functions)
CREATE POLICY "System insert activity"
  ON application_activity_log FOR INSERT
  WITH CHECK (true);

-- Admins can view all activity
CREATE POLICY "Admins view all activity"
  ON application_activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- referral_claims POLICIES
-- =====================================================

-- Residence portal users can view their claims
CREATE POLICY "Residence portal view claims"
  ON referral_claims FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- Only system/admins can insert/update claims (via edge function)
CREATE POLICY "System insert claims"
  ON referral_claims FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins manage all claims"
  ON referral_claims FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- STORAGE POLICIES for application-documents bucket
-- =====================================================

-- Residence portal can download files for their applications
CREATE POLICY "Residence download app docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    EXISTS (
      SELECT 1 FROM application_documents ad
      WHERE ad.file_path = name
        AND is_authorized_residence_user(ad.residence_id)
    )
  );

-- Students can upload to their applications
CREATE POLICY "Students upload app docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents' AND
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.user_id = auth.uid()
        AND name LIKE a.id::text || '/%'
    )
  );

-- Students can view their own uploads
CREATE POLICY "Students view own app docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.user_id = auth.uid()
        AND name LIKE a.id::text || '/%'
    )
  );

-- Admins can access all files
CREATE POLICY "Admins access all app docs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'application-documents' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at trigger for residence_portal_accounts
CREATE TRIGGER update_rpa_updated_at
  BEFORE UPDATE ON residence_portal_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE application_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE application_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE application_activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE referral_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE residence_portal_accounts;
