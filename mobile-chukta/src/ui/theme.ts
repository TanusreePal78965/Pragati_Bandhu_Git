export const colors = {
  // Base backgrounds and surfaces
  bg: '#F8FAFC',          // Crisp slate-50 off-white
  card: '#FFFFFF',        // Pure white card
  surface: '#FFFFFF',     // Clean white surface
  surfaceHover: '#F1F5F9',// Slate-100 hover surface
  text: '#0F172A',        // Slate-900: modern deep dark
  muted: '#64748B',       // Slate-500: neutral slate
  border: '#E2E8F0',      // Slate-200: clean subtle border
  borderLight: '#F1F5F9', // Slate-100: hairline divider

  // Primary brand: Deep Indigo & Lavender (distinct, modern fintech)
  primary: '#4F46E5',      // Indigo-600: vibrant, premium
  primaryDark: '#4338CA',  // Indigo-700: deep rich indigo for pressed & contrast
  primaryLight: '#6366F1', // Indigo-500: bright indigo
  primaryText: '#FFFFFF',
  primarySoft: '#EEF2FF',  // Indigo-50: soft lavender wash
  primaryBorder: '#C7D2FE',// Indigo-200: soft lavender border

  // Primary gradients
  gradientStart: '#6366F1', // Indigo-500
  gradientEnd: '#4338CA',   // Indigo-700
  gradientSoftStart: '#F5F3FF', // Violet-50
  gradientSoftEnd: '#EEF2FF',   // Indigo-50

  // Complementary accent (Warm Amber - cuts through indigo cleanly)
  accent: '#F59E0B',       // Amber-500
  accentSoft: '#FEF3C7',   // Amber-100
  accentText: '#B45309',   // Amber-700

  // Semantic status colors
  // Danger / absent / error / inactive
  danger: '#EF4444',       // Red-500
  dangerDark: '#DC2626',   // Red-600
  dangerSoft: '#FEF2F2',   // Red-50
  dangerText: '#B91C1C',   // Red-700
  dangerBorder: '#FECACA', // Red-200

  // Warning / half-day (Amber)
  warning: '#F59E0B',      // Amber-500
  warnSoft: '#FFFBEB',     // Amber-50
  warnText: '#B45309',     // Amber-700
  warnBorder: '#FDE68A',   // Amber-200

  // Success / present / synced / active (Emerald)
  success: '#10B981',      // Emerald-500
  successDark: '#059669',  // Emerald-600
  successSoft: '#ECFDF5',  // Emerald-50
  successText: '#047857',  // Emerald-700
  successBorder: '#A7F3D0',// Emerald-200

  // Info / hours (Sky)
  info: '#0284C7',         // Sky-600
  infoSoft: '#E0F2FE',     // Sky-100
  infoText: '#0369A1',     // Sky-700
  infoBorder: '#BAE6FD',   // Sky-200

  // Off / neutral (Slate)
  off: '#64748B',          // Slate-500
  offSoft: '#F1F5F9',      // Slate-100
  offText: '#475569',      // Slate-600
  offBorder: '#E2E8F0',    // Slate-200
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  roundness: 10,
};

export const spacing = space;
export const radius = 10;

export const shadows = {
  sm: {
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  primary: {
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
};
