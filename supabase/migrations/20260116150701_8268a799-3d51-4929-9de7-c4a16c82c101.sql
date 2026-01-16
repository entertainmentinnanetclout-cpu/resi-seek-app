-- 1. Add room_types array to residences
ALTER TABLE residences ADD COLUMN IF NOT EXISTS room_types TEXT[] DEFAULT '{}';

-- Migrate existing data - copy room_type to room_types array
UPDATE residences 
SET room_types = ARRAY[room_type]
WHERE room_type IS NOT NULL AND (room_types IS NULL OR room_types = '{}');

-- 2. Create call_logs table for follow-up tracking
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'phone',
  outcome TEXT,
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage call logs"
ON call_logs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add move_in tracking to applications
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS move_in_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS move_in_date DATE,
ADD COLUMN IF NOT EXISTS moved_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- 4. Enable realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;