-- Fix permission denied for anon role on shops table caused by column-level REVOKE
GRANT SELECT (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, plan_expires_at, plan_type, created_at, last_synced_at) ON public.shops TO anon, authenticated;
