-- Migration 009: Create app_settings key-value configuration table for Server-Driven Version Control & Maintenance Mode

CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

-- Policies
CREATE POLICY "Public read app_settings" ON public.app_settings
    FOR SELECT USING (true);

CREATE POLICY "Admin write app_settings" ON public.app_settings
    FOR ALL USING (true);

-- Insert Default Config Values
INSERT INTO public.app_settings (key, value) VALUES
    ('app_min_version', '1.0.0'),
    ('app_min_version_code', '1'),
    ('app_latest_version', '1.0.0'),
    ('app_latest_version_code', '1'),
    ('app_maintenance_mode', '0'),
    ('app_maintenance_message', 'Pragati Bandhu is currently undergoing scheduled maintenance. Please try again shortly.'),
    ('app_force_update_title', 'Update Required'),
    ('app_force_update_message', 'A mandatory app update is required to continue using Pragati Bandhu.'),
    ('app_soft_update_title', 'New Version Available'),
    ('app_soft_update_message', 'A new version of Pragati Bandhu is available with new features.'),
    ('app_play_store_url', 'https://play.google.com/store/apps/details?id=com.pragatibandhu.app'),
    ('app_app_store_url', 'https://apps.apple.com/app/id6400000000')
ON CONFLICT (key) DO NOTHING;
