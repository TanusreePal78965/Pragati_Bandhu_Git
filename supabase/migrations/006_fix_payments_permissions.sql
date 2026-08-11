-- Fix column privileges for shops to include subscription fields
GRANT SELECT (
  plan_expires_at, plan_type, is_superadmin
) ON public.shops TO anon, authenticated;

-- Make sure anon/authenticated cannot update plan directly
-- They already don't have UPDATE on these columns because we only GRANT SELECT above.

-- Revoke all direct access to payments from anon and authenticated.
-- All operations (insert, review, approve, reject) will be done via Edge Functions (service_role).
REVOKE ALL ON public.payments FROM anon, authenticated;

-- If previously there were RLS policies for auth.uid(), they are now dead code 
-- since we revoked access and auth.uid() is null in the new architecture, but we leave them 
-- or drop them to avoid confusion.
DROP POLICY IF EXISTS "owner_insert_payment" ON public.payments;
DROP POLICY IF EXISTS "owner_read_payment" ON public.payments;
DROP POLICY IF EXISTS "admin_read_all" ON public.payments;
DROP POLICY IF EXISTS "admin_update_all" ON public.payments;
