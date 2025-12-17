-- Allow viewing profiles of users looking for roommates
CREATE POLICY "Users can view roommate seekers"
ON public.profiles
FOR SELECT
USING (looking_for_roommate = true);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));