-- Add an explicit RLS policy allowing the book_tee_time() RPC (SECURITY DEFINER)
-- to update tee_times rows. The function runs as the definer (postgres/service_role)
-- so RLS is bypassed for it, but this policy documents intent and protects against
-- any accidental direct UPDATE call from authenticated clients.
--
-- Authenticated users have no direct UPDATE access on tee_times —
-- all mutations must go through the book_tee_time() RPC.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'tee_times'
      AND policyname = 'No direct updates from clients'
  ) THEN
    CREATE POLICY "No direct updates from clients"
    ON public.tee_times
    FOR UPDATE
    TO authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END
$$;
