-- Create restricted view for marketplace seller profiles (only safe public data)
CREATE OR REPLACE VIEW public.marketplace_seller_profiles AS
SELECT 
  id, 
  full_name, 
  profile_picture_url
FROM profiles;

GRANT SELECT ON marketplace_seller_profiles TO authenticated, anon;

-- Add DELETE policy to user_roles table
CREATE POLICY "Only admins can delete roles"
ON user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger to prevent deletion of last admin
CREATE OR REPLACE FUNCTION prevent_last_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT COUNT(*) FROM user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin role';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_last_admin
BEFORE DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_deletion();

-- Add database constraint for student_number format
ALTER TABLE profiles 
ADD CONSTRAINT check_student_number_format 
CHECK (student_number IS NULL OR student_number ~ '^[uU][0-9]{8}$');