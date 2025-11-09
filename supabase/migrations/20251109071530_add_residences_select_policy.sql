CREATE POLICY "Allow authenticated users to read residences"
ON public.residences
FOR SELECT
TO authenticated
USING (true);
