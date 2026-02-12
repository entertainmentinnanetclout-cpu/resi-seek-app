
-- ============================================
-- WIL MODULE — Tables, RLS, Storage, Triggers
-- ============================================

-- 1. wil_applications
CREATE TABLE IF NOT EXISTS public.wil_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    full_name text NOT NULL,
    student_number text NOT NULL,
    course text NOT NULL,
    year_level int NOT NULL,
    wil_duration text NOT NULL,
    funding_status text NOT NULL,
    campus text NOT NULL,
    preferred_area text,
    notes text,
    status text NOT NULL DEFAULT 'submitted',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. wil_documents
CREATE TABLE IF NOT EXISTS public.wil_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
    student_id uuid NOT NULL,
    doc_type text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL DEFAULT 0,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 3. wil_admin_notes
CREATE TABLE IF NOT EXISTS public.wil_admin_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. wil_assignments
CREATE TABLE IF NOT EXISTS public.wil_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at on wil_applications
CREATE TRIGGER update_wil_applications_updated_at
BEFORE UPDATE ON public.wil_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.wil_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_assignments ENABLE ROW LEVEL SECURITY;

-- wil_applications: student own access
CREATE POLICY "students_insert_own_wil" ON public.wil_applications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "students_select_own_wil" ON public.wil_applications
FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "students_update_own_wil" ON public.wil_applications
FOR UPDATE TO authenticated USING (auth.uid() = student_id AND status = 'submitted')
WITH CHECK (auth.uid() = student_id AND status = 'submitted');

-- wil_applications: admin full access
CREATE POLICY "admins_all_wil_applications" ON public.wil_applications
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wil_documents: student own access
CREATE POLICY "students_insert_own_wil_docs" ON public.wil_documents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "students_select_own_wil_docs" ON public.wil_documents
FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

-- wil_documents: admin full access
CREATE POLICY "admins_all_wil_documents" ON public.wil_documents
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wil_admin_notes: admin only
CREATE POLICY "admins_all_wil_notes" ON public.wil_admin_notes
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wil_assignments: admin only
CREATE POLICY "admins_all_wil_assignments" ON public.wil_assignments
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('wil-documents', 'wil-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: students upload to own folder
CREATE POLICY "students_upload_wil_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wil-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "students_read_own_wil_docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'wil-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "admins_all_wil_storage" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'wil-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'wil-documents' AND public.has_role(auth.uid(), 'admin'));
