import React, { useState, useEffect } from 'react';
import { Sliders, ShieldAlert, AlertOctagon, Sparkles, ShoppingBag, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import '../../Admin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface SettingsState {
  app_min_version: string;
  app_min_version_code: string;
  app_latest_version: string;
  app_latest_version_code: string;
  app_maintenance_mode: boolean;
  app_maintenance_message: string;
  app_force_update_title: string;
  app_force_update_message: string;
  app_soft_update_title: string;
  app_soft_update_message: string;
  app_play_store_url: string;
  app_app_store_url: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  app_min_version: '1.0.0',
  app_min_version_code: '1',
  app_latest_version: '1.0.0',
  app_latest_version_code: '1',
  app_maintenance_mode: false,
  app_maintenance_message: 'Pragati Bandhu is currently undergoing scheduled maintenance. Please try again shortly.',
  app_force_update_title: 'Update Required',
  app_force_update_message: 'A mandatory update is required to continue using Pragati Bandhu.',
  app_soft_update_title: 'New Version Available',
  app_soft_update_message: 'A new version of Pragati Bandhu is available with new features.',
  app_play_store_url: 'https://play.google.com/store/apps/details?id=com.pragatibandhu.app',
  app_app_store_url: 'https://apps.apple.com/app/id6400000000',
};

export default function AdminSettings() {
  const [initialSettings, setInitialSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=key,value`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch settings');

      const data: { key: string; value: string }[] = await res.json();
      const map: Partial<SettingsState> = {};

      data.forEach((item) => {
        if (item.key === 'app_maintenance_mode') {
          map.app_maintenance_mode = item.value === '1' || item.value === 'true';
        } else {
          (map as any)[item.key] = item.value ?? '';
        }
      });

      const merged = { ...DEFAULT_SETTINGS, ...map };
      setSettings(merged);
      setInitialSettings(merged);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load app settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleChange = (key: keyof SettingsState, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const payload = Object.keys(settings).map((key) => {
      let val = (settings as any)[key];
      if (key === 'app_maintenance_mode') {
        val = val ? '1' : '0';
      }
      return {
        key,
        value: String(val),
        updated_at: new Date().toISOString(),
      };
    });

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to save settings: ${errText}`);
      }

      setInitialSettings(settings);
      setMessage({ type: 'success', text: 'App settings updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading configuration...
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '6rem', width: '100%' }}>
      {/* Header Title */}
      <div className="admin-page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="admin-page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sliders size={26} color="#2563eb" /> App Version Control & Maintenance Settings
            {isDirty && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 0 8px #f59e0b',
                  display: 'inline-block',
                }}
                title="Unsaved changes"
              />
            )}
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Manage app maintenance downtime, mandatory updates, and optional update popups dynamically without app redeployments.
          </p>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Card 1: Maintenance Mode */}
        <div className="admin-card" style={{ borderLeft: settings.app_maintenance_mode ? '5px solid #ef4444' : '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <ShieldAlert size={22} color={settings.app_maintenance_mode ? '#ef4444' : '#64748b'} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: settings.app_maintenance_mode ? '#b91c1c' : '#0f172a' }}>
              1. Global Maintenance Mode (Kill-Switch)
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
            Turn this on during server maintenance or critical migrations to block all app users and show a maintenance screen.
          </p>

          <div style={{ backgroundColor: settings.app_maintenance_mode ? '#fef2f2' : '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: settings.app_maintenance_mode ? '#991b1b' : '#334155' }}>
              <input
                type="checkbox"
                checked={settings.app_maintenance_mode}
                onChange={(e) => handleChange('app_maintenance_mode', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Enable Global Maintenance Mode
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Maintenance Message Shown to App Users:</label>
            <textarea
              rows={2}
              value={settings.app_maintenance_message}
              onChange={(e) => handleChange('app_maintenance_message', e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Responsive 2-Column Grid for Force Update & Soft Update Cards on Desktop */}
        <div className="admin-two-col-grid">
          {/* Card 2: Mandatory Force Update */}
          <div className="admin-card" style={{ borderLeft: '5px solid #dc2626', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <AlertOctagon size={22} color="#dc2626" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#991b1b' }}>
                  2. Mandatory Force Update
                </h2>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
                App build numbers below this threshold will be <strong>HARD BLOCKED</strong>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                    Min Android Version Code
                  </label>
                  <input
                    type="number"
                    value={settings.app_min_version_code}
                    onChange={(e) => handleChange('app_min_version_code', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>versionCode &lt; this is locked out.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                    Min iOS Version String
                  </label>
                  <input
                    type="text"
                    value={settings.app_min_version}
                    onChange={(e) => handleChange('app_min_version', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>iOS semver (e.g. 1.0.0)</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: '#991b1b' }}>
                Force Update Modal Content
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Modal Title:</label>
                  <input
                    type="text"
                    value={settings.app_force_update_title}
                    onChange={(e) => handleChange('app_force_update_title', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Message Body:</label>
                  <textarea
                    rows={2}
                    value={settings.app_force_update_message}
                    onChange={(e) => handleChange('app_force_update_message', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Optional Soft Update */}
          <div className="admin-card" style={{ borderLeft: '5px solid #16a34a', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Sparkles size={22} color="#16a34a" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#15803d' }}>
                  3. Optional Soft Update
                </h2>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
                App build numbers below this version will see a <strong>DISMISSIBLE</strong> banner.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                    Latest Android Version Code
                  </label>
                  <input
                    type="number"
                    value={settings.app_latest_version_code}
                    onChange={(e) => handleChange('app_latest_version_code', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>versionCode &lt; this sees soft popup.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                    Latest iOS Version String
                  </label>
                  <input
                    type="text"
                    value={settings.app_latest_version}
                    onChange={(e) => handleChange('app_latest_version', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>iOS semver (e.g. 1.1.0)</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: '#15803d' }}>
                Soft Update Modal Content
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Modal Title:</label>
                  <input
                    type="text"
                    value={settings.app_soft_update_title}
                    onChange={(e) => handleChange('app_soft_update_title', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Message Body:</label>
                  <textarea
                    rows={2}
                    value={settings.app_soft_update_message}
                    onChange={(e) => handleChange('app_soft_update_message', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Store Links */}
        <div className="admin-card" style={{ borderLeft: '5px solid #2563eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <ShoppingBag size={22} color="#2563eb" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#1e40af' }}>
              4. Store Deep Links
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
            URLs opened when users tap "Update Now" inside the mobile app.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                Google Play Store Deep Link URL
              </label>
              <input
                type="text"
                value={settings.app_play_store_url}
                onChange={(e) => handleChange('app_play_store_url', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.25rem' }}>
                Apple App Store Deep Link URL
              </label>
              <input
                type="text"
                value={settings.app_app_store_url}
                onChange={(e) => handleChange('app_app_store_url', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>

        {/* Sticky Save Footer Bar */}
        <div className="admin-sticky-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isDirty ? (
              <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                Unsaved changes pending
              </span>
            ) : (
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>All settings up to date</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: '#fff',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              backgroundColor: settings.app_maintenance_mode ? '#dc2626' : '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              boxShadow: settings.app_maintenance_mode ? '0 2px 8px rgba(220,38,38,0.3)' : '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            <Save size={18} />
            {isSaving
              ? 'Saving...'
              : settings.app_maintenance_mode
              ? '⚠️ Save — Maintenance Mode ON'
              : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
