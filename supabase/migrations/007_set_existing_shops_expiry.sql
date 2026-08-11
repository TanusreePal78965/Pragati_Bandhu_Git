-- Give 30 days free trial from today for all existing shops that don't have plan_expires_at set yet
UPDATE public.shops 
SET plan_expires_at = NOW() + INTERVAL '30 days',
    plan_type = COALESCE(plan_type, 'monthly')
WHERE plan_expires_at IS NULL;
