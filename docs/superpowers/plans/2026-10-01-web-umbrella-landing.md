# Web Umbrella Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ShopAI registration form at `/` with a Pragati Bandhu landing page that promotes ShopAI and Chukta side by side, and move ShopAI registration to `/shopai`.

**Architecture:** Everything stays inside the existing Vite + React SPA in `web/`. Landing copy and prices live in one typed data file (`src/content/apps.ts`), rendered by small section components under `src/components/landing/`. Per-app colours come from a CSS class (`lp-theme-shopai` / `lp-theme-chukta`), and all new styles live in `src/landing.css` with an `lp-` class prefix so the existing `App.css` is not touched.

**Tech Stack:** React 19, react-router-dom 7, Vite 8, TypeScript 6, lucide-react 1.x (icons), oxlint. GitHub Pages deploy via `.github/workflows/deploy-web.yml`. Python 3 + Pillow (local only, for generating the share image once).

**Spec:** `docs/superpowers/specs/2026-10-01-web-umbrella-landing-design.md`

## Global Constraints

- Only files under `web/` change (plus this plan). Do not touch `mobile-shopai/`, `mobile-chukta/`, `supabase/` or the deploy workflow.
- No new npm dependencies.
- English only.
- Prices: ShopAI ₹99/month or ₹999/year ("Save ₹189" on yearly). Chukta ₹199/year. Both: 30-day free trial.
- ShopAI Play URL: `https://play.google.com/store/apps/details?id=com.pragatibandhu.app`. Chukta has no Play URL ("Coming soon on Google Play", not clickable).
- Site base path is `/Pragati_Bandhu_Git/` (router `basename="/Pragati_Bandhu_Git"`). Absolute public URLs start `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/`.
- `/chukta`, `/renew`, `/features`, `/help`, `/forgot-password`, `/privacy`, `/terms`, `/admin/*` keep working unchanged.
- New CSS classes are prefixed `lp-`. Buttons with white text use the darker accent (`--lp-accent-dark`) so white-on-amber text keeps readable contrast.
- Layout must work at 360px width with no horizontal scroll.
- No automated tests are added (spec D7). Each task is verified with `npm run build`, `npm run lint` and a manual check in `npm run preview`.

## Deviations from the spec (decided while planning)

1. **ShopAI icon:** `web/src/assets/icon.png` is byte-identical to `mobile-shopai/assets/icon.png`, so it is reused instead of copying a `shopai-icon.png`.
2. **Accent colours** live in CSS (`.lp-theme-<id>`), not in `apps.ts`. `apps.ts` holds content only.
3. **No `robots.txt`.** GitHub Pages project sites live under `/Pragati_Bandhu_Git/`; crawlers only read `robots.txt` at the domain root (`tanusreepal78965.github.io/robots.txt`), which this repo does not control. `sitemap.xml` is still added; submit it in Google Search Console if wanted.

## Setup (once, before Task 1)

The main working tree has many unrelated uncommitted changes. Work on a branch and stage only `web/` files in every commit.

```bash
cd /Users/suvo/Developer/Pragati_Bandhu
git switch -c feat/web-landing
cd web && npm ci
npm run build && npm run lint   # baseline: both must pass before any change
```

If you use a separate git worktree instead, run `npm ci` in its `web/` folder. Task 2 copies the Chukta icon from an absolute path in the main working tree because that file is not committed yet.

## File map

| File | Responsibility |
|---|---|
| `web/src/pages/ShopAIRegister.tsx` (new) | ShopAI registration flow, moved verbatim out of `App.tsx` |
| `web/src/App.tsx` (modify) | Route table only |
| `web/src/content/apps.ts` (new) | Typed content for both apps: copy, prices, links, features |
| `web/src/assets/chukta-icon.png` (new) | Chukta app icon (copy of `mobile-chukta/assets/play-store-512.png`) |
| `web/src/components/landing/StoreBadge.tsx` (new) | Google Play badge: live link or "coming soon" |
| `web/src/components/landing/Hero.tsx` (new) | Headline + one card per app |
| `web/src/components/landing/AppSection.tsx` (new) | One app's feature section (`id="shopai"` / `id="chukta"`) |
| `web/src/components/landing/Pricing.tsx` (new) | Plan cards for both apps |
| `web/src/components/landing/HowItWorks.tsx` (new) | Three signup steps |
| `web/src/components/landing/Faq.tsx` (new) | FAQ using `<details>` |
| `web/src/pages/Home.tsx` (new) | Composes the landing sections; scrolls to `#hash` |
| `web/src/landing.css` (new) | All landing and header styles |
| `web/src/components/Layout.tsx` (modify) | New header with nav + mobile menu; footer gains "Register ShopAI" |
| `web/index.html` (modify) | Title, description, Open Graph/Twitter tags, `<noscript>` |
| `web/scripts/make_og_image.py` (new) | Generates `public/og-image.png` |
| `web/public/og-image.png` (new) | 1200×630 link-preview image |
| `web/public/sitemap.xml` (new) | Public routes |

---

### Task 1: Move ShopAI registration to `/shopai`

**Files:**
- Create: `web/src/pages/ShopAIRegister.tsx`
- Modify: `web/src/App.tsx` (remove lines 1–6 imports used only by the form, lines 23–405 `SUPABASE_*` constants through the end of `RegistrationPage`; rewrite the route table)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export default function ShopAIRegister(): JSX.Element` in `web/src/pages/ShopAIRegister.tsx`. Route `/shopai`. In this task `/` also still renders `ShopAIRegister`, so the live site keeps working until Task 2 adds `Home`.

- [ ] **Step 1: Create `ShopAIRegister.tsx` from the existing code**

Run from `web/`. This copies `App.tsx` lines 23–405 (the two `SUPABASE_*` constants, `Step`, `PlanType`, `BUSINESS_CATEGORIES` and the whole `RegistrationPage` function) unchanged, with a new import header, and renames the function.

```bash
cd /Users/suvo/Developer/Pragati_Bandhu/web
sed -n 405p src/App.tsx   # must print exactly "}" (end of RegistrationPage); stop if not
{
  cat <<'EOF'
import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import logoUrl from '../assets/icon.png';
import '../App.css';

EOF
  sed -n '23,405p' src/App.tsx | sed 's/^function RegistrationPage() {$/export default function ShopAIRegister() {/'
} > src/pages/ShopAIRegister.tsx
grep -n "export default function ShopAIRegister" src/pages/ShopAIRegister.tsx   # expect one match
```

- [ ] **Step 2: Replace `App.tsx` with the route table only**

Write `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

import Layout from './components/Layout';
import ShopAIRegister from './pages/ShopAIRegister';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AppFeatures from './pages/AppFeatures';
import HelpCenter from './pages/HelpCenter';
import RenewPlan from './pages/RenewPlan';
import ForgotPassword from './pages/ForgotPassword';
import ChuktaSignup from './pages/ChuktaSignup';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPayments from './pages/admin/AdminPayments';
import AdminShops from './pages/admin/AdminShops';
import AdminSettings from './pages/admin/AdminSettings';

export default function App() {
  return (
    <BrowserRouter basename="/Pragati_Bandhu_Git">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ShopAIRegister />} />
          <Route path="/shopai" element={<ShopAIRegister />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/features" element={<AppFeatures />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/renew" element={<RenewPlan />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/chukta" element={<ChuktaSignup />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="shops" element={<AdminShops />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Keep `import './App.css'` above the `Layout` import: later tasks rely on `landing.css` (imported by `Layout`) loading after `App.css`.

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: build ends with `✓ built in …`, no TypeScript errors (in particular no "declared but never read" errors in either file); lint exits 0.

- [ ] **Step 4: Manual check**

Run: `npm run preview` and open `http://localhost:4173/Pragati_Bandhu_Git/shopai`.
Expected: the ShopAI page with the ₹99 / ₹999 plan cards. Click "Select Monthly": the phone step appears with "Send OTP" disabled until 10 digits are typed. `http://localhost:4173/Pragati_Bandhu_Git/` shows the same page. Stop the preview server.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/ShopAIRegister.tsx
git commit -m "refactor(web): move ShopAI registration to /shopai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Landing page core — content, hero, app sections, route `/`

**Files:**
- Create: `web/src/assets/chukta-icon.png`, `web/src/content/apps.ts`, `web/src/components/landing/StoreBadge.tsx`, `web/src/components/landing/Hero.tsx`, `web/src/components/landing/AppSection.tsx`, `web/src/pages/Home.tsx`, `web/src/landing.css`
- Modify: `web/src/App.tsx` (route `/` → `Home`)

**Interfaces:**
- Consumes: `ShopAIRegister` route from Task 1.
- Produces (used by Tasks 3 and 4):
  - `web/src/content/apps.ts` exports `type AppId = 'shopai' | 'chukta'`, `interface AppFeature`, `interface AppPlan`, `interface AppInfo`, `const SHOPAI: AppInfo`, `const CHUKTA: AppInfo`, `const APPS: AppInfo[]` (ShopAI first).
  - `StoreBadge({ playUrl }: { playUrl: string | null })` default export.
  - `Home` default export in `web/src/pages/Home.tsx`; section ids `shopai` and `chukta`.
  - CSS classes in `landing.css`: `lp-theme-shopai`, `lp-theme-chukta` (define `--lp-accent`, `--lp-accent-dark`, `--lp-accent-soft`, `--lp-section-bg`, `--lp-gradient`), `lp-home`, `lp-btn`, `lp-actions`, `lp-app-icon`, `lp-link`, `lp-store-badge`.

- [ ] **Step 1: Copy the Chukta icon**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu/web
cp /Users/suvo/Developer/Pragati_Bandhu/mobile-chukta/assets/play-store-512.png src/assets/chukta-icon.png
file src/assets/chukta-icon.png   # expect: PNG image data, 512 x 512
```

- [ ] **Step 2: Write `src/content/apps.ts`**

```ts
import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  BellRing,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  HandCoins,
  KeyRound,
  Languages,
  Package,
  ReceiptText,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import shopaiIcon from '../assets/icon.png';
import chuktaIcon from '../assets/chukta-icon.png';

export type AppId = 'shopai' | 'chukta';

export interface AppFeature {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface AppPlan {
  price: string;
  period: string;
  badge: string | null;
}

export interface AppInfo {
  /** Also the section anchor (#shopai, #chukta) and the lp-theme-<id> CSS class. */
  id: AppId;
  name: string;
  icon: string;
  /** One line on the hero card. */
  pitch: string;
  /** Headline of the app's section. */
  headline: string;
  priceSummary: string;
  plans: AppPlan[];
  signupPath: string;
  signupLabel: string;
  /** null shows "Coming soon on Google Play". Set the store URL here when the app goes live. */
  playUrl: string | null;
  featuresLink: string | null;
  features: AppFeature[];
}

export const SHOPAI: AppInfo = {
  id: 'shopai',
  name: 'ShopAI',
  icon: shopaiIcon,
  pitch: 'Billing, stock and udhar for your shop.',
  headline: 'Stock khatam hone se pehle, ShopAI bata dega.',
  priceSummary: '₹99/month · ₹999/year',
  plans: [
    { price: '₹99', period: '/month', badge: null },
    { price: '₹999', period: '/year', badge: 'Save ₹189' },
  ],
  signupPath: '/shopai',
  signupLabel: 'Register ShopAI',
  playUrl: 'https://play.google.com/store/apps/details?id=com.pragatibandhu.app',
  featuresLink: '/features',
  features: [
    { icon: ReceiptText, title: 'Billing', text: 'Cash or udhar bills in seconds.' },
    { icon: Package, title: 'Inventory', text: 'Stock goes down automatically with every bill.' },
    { icon: BellRing, title: 'Low-stock alerts', text: 'Know before you run out.' },
    { icon: BookOpen, title: 'Udhar tracking', text: "Every customer's balance in one place." },
    { icon: BarChart2, title: 'Reports', text: "Today's sales, top products, profit." },
    { icon: Sparkles, title: 'AI reorder & WhatsApp alerts', text: 'Suggestions on what to reorder, sent where you already are.' },
  ],
};

export const CHUKTA: AppInfo = {
  id: 'chukta',
  name: 'Chukta',
  icon: chuktaIcon,
  pitch: 'Attendance, wages and advances for your workers.',
  headline: 'Your worker wage diary. No more notebook maths.',
  priceSummary: '₹199/year',
  plans: [{ price: '₹199', period: '/year', badge: null }],
  signupPath: '/chukta',
  signupLabel: 'Sign up for Chukta',
  playUrl: null,
  featuresLink: null,
  features: [
    { icon: CalendarCheck, title: 'Daily attendance', text: 'Present, half day, absent, or hours worked.' },
    { icon: Calculator, title: 'Automatic wages', text: 'With a plain-words breakdown like "4.5 days × ₹500".' },
    { icon: HandCoins, title: 'Advances and deductions', text: 'Always know what is still outstanding.' },
    { icon: Building2, title: 'Multiple sites', text: 'Keep workers for each property separate.' },
    { icon: KeyRound, title: 'Staff logins', text: 'Let a supervisor mark attendance with a PIN.' },
    { icon: WifiOff, title: 'Works offline', text: 'Syncs when you are back online.' },
    { icon: Languages, title: 'Your language', text: 'English, Hindi and Bengali.' },
  ],
};

export const APPS: AppInfo[] = [SHOPAI, CHUKTA];
```

- [ ] **Step 3: Write `src/components/landing/StoreBadge.tsx`**

```tsx
import { Play } from 'lucide-react';

export default function StoreBadge({ playUrl }: { playUrl: string | null }) {
  if (!playUrl) {
    return (
      <span className="lp-store-badge lp-store-badge-soon">
        <Play size={22} />
        <span>
          <small>Coming soon on</small>
          <strong>Google Play</strong>
        </span>
      </span>
    );
  }
  return (
    <a href={playUrl} target="_blank" rel="noopener noreferrer" className="lp-store-badge">
      <Play size={22} fill="currentColor" />
      <span>
        <small>Get it on</small>
        <strong>Google Play</strong>
      </span>
    </a>
  );
}
```

- [ ] **Step 4: Write `src/components/landing/Hero.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { APPS } from '../../content/apps';
import StoreBadge from './StoreBadge';

export default function Hero() {
  return (
    <section className="lp-hero">
      <h1>Simple apps for small businesses in India.</h1>
      <p className="lp-hero-sub">Run your shop and pay your workers right, from your Android phone.</p>
      <div className="lp-hero-cards">
        {APPS.map((app) => (
          <article key={app.id} className={`lp-app-card lp-theme-${app.id}`}>
            <div className="lp-app-card-head">
              <img src={app.icon} alt="" className="lp-app-icon" />
              <div>
                <h2>{app.name}</h2>
                <p>{app.pitch}</p>
              </div>
            </div>
            <div className="lp-app-card-body">
              <div className="lp-price">{app.priceSummary}</div>
              <div className="lp-actions">
                <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
                <StoreBadge playUrl={app.playUrl} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="lp-trust">30-day free trial · No card needed</p>
    </section>
  );
}
```

- [ ] **Step 5: Write `src/components/landing/AppSection.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AppInfo } from '../../content/apps';
import StoreBadge from './StoreBadge';

export default function AppSection({ app }: { app: AppInfo }) {
  return (
    <section id={app.id} className={`lp-section lp-theme-${app.id}`}>
      <div className="lp-section-head">
        <img src={app.icon} alt="" className="lp-app-icon" />
        <div>
          <h2>{app.name}</h2>
          <p className="lp-section-headline">{app.headline}</p>
        </div>
      </div>
      <div className="lp-feature-grid">
        {app.features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="lp-feature">
            <div className="lp-feature-icon"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      {app.featuresLink && (
        <Link to={app.featuresLink} className="lp-link">
          See all features <ArrowRight size={16} />
        </Link>
      )}
      <div className="lp-actions">
        <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
        <StoreBadge playUrl={app.playUrl} />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Write `src/pages/Home.tsx`**

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/landing/Hero';
import AppSection from '../components/landing/AppSection';
import { SHOPAI, CHUKTA } from '../content/apps';
import '../landing.css';

export default function Home() {
  const location = useLocation();

  // Header links go to /#shopai and /#chukta. location.key changes on every click,
  // so a repeat click on the same link scrolls again.
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.key, location.hash]);

  return (
    <div className="lp-home">
      <Hero />
      <AppSection app={SHOPAI} />
      <AppSection app={CHUKTA} />
    </div>
  );
}
```

- [ ] **Step 7: Write `src/landing.css`**

```css
/* Landing page and site header. Every class is prefixed lp- so nothing here collides with App.css. */

.lp-theme-shopai {
  --lp-accent: #1a57db;
  --lp-accent-dark: #1442a8;
  --lp-accent-soft: #e8efff;
  --lp-section-bg: #f5f8ff;
  --lp-gradient: linear-gradient(135deg, #3b82f6 0%, #1a57db 100%);
}

.lp-theme-chukta {
  --lp-accent: #d97706;
  --lp-accent-dark: #b45309;
  --lp-accent-soft: #fef3c7;
  --lp-section-bg: #fffbf5;
  --lp-gradient: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
}

.lp-home {
  width: 100%;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  gap: 4rem;
  padding-bottom: 2rem;
  animation: slideUpFade 0.6s ease-out forwards;
}

/* Shared bits */
.lp-app-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #fff;
  object-fit: cover;
  flex-shrink: 0;
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.8rem 1.4rem;
  border-radius: var(--input-radius);
  background: var(--lp-accent-dark);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
}

.lp-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px -6px var(--lp-accent);
}

.lp-link {
  color: var(--lp-accent-dark);
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: flex-start;
}

/* Store badge */
.lp-store-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 1rem;
  border-radius: 10px;
  background: #000;
  color: #fff;
  text-decoration: none;
  line-height: 1.1;
}

.lp-store-badge small {
  display: block;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lp-store-badge strong {
  display: block;
  font-size: 1.05rem;
  font-weight: 600;
}

.lp-store-badge-soon {
  background: #e2e8f0;
  color: #64748b;
  cursor: default;
}

/* Hero */
.lp-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 1rem;
}

.lp-hero h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text-main);
}

.lp-hero-sub {
  margin: 0 auto;
  max-width: 40rem;
  font-size: 1.15rem;
  color: var(--text-muted);
}

.lp-hero-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 1.5rem;
  text-align: left;
}

.lp-app-card {
  background: #fff;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lp-app-card-head {
  background: var(--lp-gradient);
  color: #fff;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.lp-app-card-head h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.lp-app-card-head p {
  margin: 0;
  font-size: 0.95rem;
}

.lp-app-card-body {
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.lp-app-card-body .lp-actions {
  margin-top: auto;
}

.lp-price {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}

.lp-trust {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-muted);
}

/* App sections */
.lp-section {
  background: var(--lp-section-bg);
  border-radius: 24px;
  padding: 2.5rem 2rem;
  scroll-margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lp-section-head {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.lp-section-head h2 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-main);
}

.lp-section-headline {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--lp-accent-dark);
}

.lp-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 1rem;
}

.lp-feature {
  background: #fff;
  border-radius: 14px;
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-feature h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-main);
}

.lp-feature p {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .lp-home {
    gap: 2.5rem;
  }

  .lp-section {
    padding: 1.75rem 1.25rem;
  }
}
```

- [ ] **Step 8: Point `/` at `Home`**

In `web/src/App.tsx`, add the import after the `ShopAIRegister` import:

```tsx
import Home from './pages/Home';
```

and change the `/` route:

```tsx
          <Route path="/" element={<Home />} />
```

- [ ] **Step 9: Build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, lint exits 0.

- [ ] **Step 10: Manual check**

Run `npm run preview` and open `http://localhost:4173/Pragati_Bandhu_Git/`.
Expected:
- Headline "Simple apps for small businesses in India." with a blue ShopAI card and an amber Chukta card.
- "Register ShopAI" goes to `/shopai` (plan cards). Browser back returns to `/`.
- "Sign up for Chukta" goes to `/chukta` (phone step).
- ShopAI "Get it on Google Play" opens the Play listing in a new tab. Chukta's grey "Coming soon on Google Play" does nothing on click.
- ShopAI section shows 6 feature tiles and "See all features →" (goes to `/features`). Chukta section shows 7 tiles and no features link.
- Open `http://localhost:4173/Pragati_Bandhu_Git/#chukta` directly: the page scrolls to the Chukta section.
- In devtools responsive mode at 360px width: cards stack, no horizontal scrollbar.

The header still shows only "Renew Subscription" at this point; Task 4 replaces it. Stop the preview server.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx src/pages/Home.tsx src/content/apps.ts src/components/landing src/landing.css src/assets/chukta-icon.png
git commit -m "feat(web): umbrella landing page with ShopAI and Chukta sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pricing, How it works, FAQ

**Files:**
- Create: `web/src/components/landing/Pricing.tsx`, `web/src/components/landing/HowItWorks.tsx`, `web/src/components/landing/Faq.tsx`
- Modify: `web/src/pages/Home.tsx` (render the three sections), `web/src/landing.css` (append styles)

**Interfaces:**
- Consumes: `APPS`, `AppInfo.plans`, `AppInfo.signupPath`, `AppInfo.signupLabel` from `src/content/apps.ts`; classes `lp-theme-<id>`, `lp-btn`, `lp-actions` from Task 2.
- Produces: default exports `Pricing`, `HowItWorks`, `Faq` (no props).

- [ ] **Step 1: Write `src/components/landing/Pricing.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { APPS } from '../../content/apps';

const INCLUDED = ['30-day free trial', 'Renew any time by UPI'];

export default function Pricing() {
  return (
    <section className="lp-block">
      <h2>Simple pricing</h2>
      <div className="lp-pricing-grid">
        {APPS.map((app) => (
          <article key={app.id} className={`lp-plan-card lp-theme-${app.id}`}>
            <h3>{app.name}</h3>
            <div className="lp-plan-rows">
              {app.plans.map((plan) => (
                <div key={plan.period} className="lp-plan-row">
                  <span className="lp-plan-price">{plan.price}</span>
                  <span className="lp-plan-period">{plan.period}</span>
                  {plan.badge && <span className="lp-plan-badge">{plan.badge}</span>}
                </div>
              ))}
            </div>
            <ul className="lp-checks">
              {INCLUDED.map((item) => (
                <li key={item}>
                  <Check size={18} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="lp-actions">
              <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/components/landing/HowItWorks.tsx`**

```tsx
import { LogIn, Smartphone, UserPlus } from 'lucide-react';

const STEPS = [
  { icon: UserPlus, title: 'Sign up here', text: 'Use your mobile number. We send you an OTP.' },
  { icon: Smartphone, title: 'Install the app', text: 'On your Android phone.' },
  { icon: LogIn, title: 'Log in', text: 'With your mobile number and password.' },
];

export default function HowItWorks() {
  return (
    <section className="lp-block">
      <h2>How it works</h2>
      <ol className="lp-steps">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="lp-step">
            <div className="lp-step-num"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <p className="lp-note">Already use one app? Use the same mobile number to sign up for the other.</p>
    </section>
  );
}
```

- [ ] **Step 3: Write `src/components/landing/Faq.tsx`**

```tsx
import { Link } from 'react-router-dom';

export default function Faq() {
  return (
    <section className="lp-block">
      <h2>Questions</h2>
      <div className="lp-faq">
        <details>
          <summary>Do I need internet?</summary>
          <p>Chukta works fully offline and syncs later. ShopAI works offline; cloud backup needs internet.</p>
        </details>
        <details>
          <summary>How do I pay?</summary>
          <p>By UPI. Scan the QR code on the <Link to="/renew">Renew page</Link>.</p>
        </details>
        <details>
          <summary>What happens after the free trial?</summary>
          <p>The app asks you to renew. Renew by UPI to keep using it.</p>
        </details>
        <details>
          <summary>I forgot my password.</summary>
          <p><Link to="/forgot-password">Reset it here</Link>.</p>
        </details>
        <details>
          <summary>Is my data safe?</summary>
          <p>See our <Link to="/privacy">Privacy Policy</Link>.</p>
        </details>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render them in `Home.tsx`**

Add imports after the `AppSection` import:

```tsx
import Pricing from '../components/landing/Pricing';
import HowItWorks from '../components/landing/HowItWorks';
import Faq from '../components/landing/Faq';
```

and replace the returned JSX with:

```tsx
    <div className="lp-home">
      <Hero />
      <AppSection app={SHOPAI} />
      <AppSection app={CHUKTA} />
      <Pricing />
      <HowItWorks />
      <Faq />
    </div>
```

- [ ] **Step 5: Append styles to `src/landing.css`**

Insert this block above the final `@media (max-width: 640px)` block:

```css
/* Pricing, How it works, FAQ */
.lp-block {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: center;
}

.lp-block > h2 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-main);
}

.lp-pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 1.5rem;
  text-align: left;
}

.lp-plan-card {
  background: #fff;
  border-radius: var(--border-radius);
  border-top: 6px solid var(--lp-accent);
  box-shadow: var(--shadow-md);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lp-plan-card h3 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--text-main);
}

.lp-plan-card .lp-actions {
  margin-top: auto;
}

.lp-plan-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-plan-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.lp-plan-price {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
}

.lp-plan-period {
  color: var(--text-muted);
}

.lp-plan-badge {
  background: var(--lp-accent-soft);
  color: var(--lp-accent-dark);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}

.lp-checks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text-main);
}

.lp-checks li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lp-checks svg {
  color: var(--success);
  flex-shrink: 0;
}

.lp-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 1rem;
}

.lp-step {
  background: #fff;
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.lp-step-num {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-step h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-main);
}

.lp-step p,
.lp-note {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text-muted);
}

.lp-faq {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.lp-faq details {
  background: #fff;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 1rem 1.25rem;
}

.lp-faq summary {
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
}

.lp-faq details p {
  margin: 0.75rem 0 0;
  color: var(--text-muted);
}

.lp-faq a {
  color: var(--primary-color);
  font-weight: 600;
}
```

- [ ] **Step 6: Build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, lint exits 0.

- [ ] **Step 7: Manual check**

Run `npm run preview`, open `http://localhost:4173/Pragati_Bandhu_Git/`, scroll below the Chukta section.
Expected:
- "Simple pricing": ShopAI card (blue top border) shows ₹99 /month and ₹999 /year with a "Save ₹189" pill; Chukta card (amber top border) shows ₹199 /year. Both list "30-day free trial" and "Renew any time by UPI" with green ticks; buttons go to `/shopai` and `/chukta`.
- "How it works": three steps and the same-number note.
- "Questions": five items expand on click; the Renew, Reset and Privacy links navigate correctly.
- At 360px width: everything stacks, no horizontal scrollbar.

Stop the preview server.

- [ ] **Step 8: Commit**

```bash
git add src/components/landing/Pricing.tsx src/components/landing/HowItWorks.tsx src/components/landing/Faq.tsx src/pages/Home.tsx src/landing.css
git commit -m "feat(web): pricing, how-it-works and FAQ on the landing page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Site header with app links and mobile menu; footer link

**Files:**
- Modify: `web/src/components/Layout.tsx` (whole file), `web/src/landing.css` (append header styles)

**Interfaces:**
- Consumes: section ids `shopai` / `chukta` and the hash-scroll effect in `Home` (Task 2).
- Produces: classes `lp-page`, `lp-header`, `lp-brand`, `lp-nav`, `lp-nav-open`, `lp-nav-renew`, `lp-menu-btn`.

- [ ] **Step 1: Replace `src/components/Layout.tsx`**

```tsx
import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import logoUrl from '../assets/icon.png';
import '../landing.css';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="page-container lp-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hero-blob-1"></div>
      <div className="hero-blob-2"></div>

      <header className="lp-header">
        <Link to="/" className="lp-brand" onClick={closeMenu}>
          <img src={logoUrl} alt="" />
          Pragati Bandhu
        </Link>
        <button
          type="button"
          className="lp-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <nav className={menuOpen ? 'lp-nav lp-nav-open' : 'lp-nav'}>
          <Link to={{ pathname: '/', hash: '#shopai' }} onClick={closeMenu}>ShopAI</Link>
          <Link to={{ pathname: '/', hash: '#chukta' }} onClick={closeMenu}>Chukta</Link>
          <Link to="/renew" className="lp-nav-renew" onClick={closeMenu}>Renew Subscription</Link>
        </nav>
      </header>

      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
        <Outlet />
      </div>

      <footer style={{
        zIndex: 1,
        width: '100%',
        maxWidth: '1000px',
        padding: '2rem 1rem',
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', fontSize: '0.9rem' }}>
          <Link to="/shopai" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Register ShopAI</Link>
          <Link to="/chukta" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Chukta</Link>
          <Link to="/features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>App Features</Link>
          <Link to="/help" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Help Center</Link>
          <Link to="/renew" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Renew Subscription</Link>
          <Link to="/forgot-password" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Forgot Password</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
        <div style={{ fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} Pragati Bandhu. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

The footer and `Outlet` wrapper are unchanged apart from the new first footer link. The old absolute-positioned header and its "Back to Home" link are gone; the logo links home.

- [ ] **Step 2: Append header styles to `src/landing.css`**

Add at the end of the file:

```css
/* Site header (rendered by Layout on every public page) */

/* The header is now in normal flow, so drop App.css's mobile padding-top that made room for the old absolute header.
   Two classes beat App.css's single-class media rule. */
.page-container.lp-page {
  padding-top: 0;
}

.lp-header {
  position: relative;
  z-index: 50;
  width: 100%;
  max-width: 1100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  margin-bottom: 1rem;
}

.lp-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary-color);
  text-decoration: none;
}

.lp-brand img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.lp-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.lp-nav a {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  color: var(--text-main);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.lp-nav a:hover {
  background: rgba(255, 255, 255, 0.6);
}

.lp-nav a.lp-nav-renew {
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.2);
  color: var(--primary-color);
  white-space: nowrap;
}

.lp-menu-btn {
  display: none;
  background: none;
  border: 0;
  padding: 0.5rem;
  color: var(--text-main);
  cursor: pointer;
}

@media (max-width: 640px) {
  .lp-menu-btn {
    display: flex;
  }

  .lp-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    background: #fff;
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    padding: 0.5rem;
  }

  .lp-nav.lp-nav-open {
    display: flex;
  }
}
```

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, lint exits 0.

- [ ] **Step 4: Manual check**

Run `npm run preview`, open `http://localhost:4173/Pragati_Bandhu_Git/`.
Expected (desktop width):
- Header: logo + "Pragati Bandhu" on the left; "ShopAI", "Chukta", "Renew Subscription" on the right.
- Click "Chukta": scrolls to the Chukta section. Scroll back to the top and click "Chukta" again: it scrolls again.
- Go to `/features`, click "ShopAI" in the header: lands on `/` and scrolls to the ShopAI section.
- Logo goes to `/` from any page.
- Footer has "Register ShopAI" first, and it goes to `/shopai`.
- `/shopai`, `/chukta`, `/renew`, `/features`, `/help`, `/forgot-password`, `/privacy`, `/terms`: the header does not overlap page content.
- `/admin/login` is unchanged (no new header there).

At 360px width:
- Right side shows only the menu button. Tapping it opens a white list with the three links; tapping a link navigates and closes the list; tapping X closes it.
- No horizontal scrollbar on `/` or `/shopai`.

Stop the preview server.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/landing.css
git commit -m "feat(web): site header with app links and mobile menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Link previews and sitemap

**Files:**
- Create: `web/scripts/make_og_image.py`, `web/public/og-image.png` (generated), `web/public/sitemap.xml`
- Modify: `web/index.html`

**Interfaces:**
- Consumes: `web/src/assets/icon.png`, `web/src/assets/chukta-icon.png` (Task 2).
- Produces: `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/og-image.png` and `/sitemap.xml` after deploy.

- [ ] **Step 1: Write `web/scripts/make_og_image.py`**

```python
"""Build web/public/og-image.png, the 1200x630 link-preview card.

Run from the repo root on macOS: python3 web/scripts/make_og_image.py
Needs Pillow (pip install pillow). Re-run if either app icon changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WEB = Path(__file__).resolve().parent.parent
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"

APPS = [
    # icon, name, one-liner, text colour, centre x
    (WEB / "src/assets/icon.png", "ShopAI", "Billing · stock · udhar", "#1a57db", 330),
    (WEB / "src/assets/chukta-icon.png", "Chukta", "Attendance · wages · advances", "#b45309", 870),
]


def rounded_icon(path: Path, size: int, radius: int) -> Image.Image:
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    icon.putalpha(mask)
    return icon


def main() -> None:
    card = Image.new("RGB", (1200, 630), "#ffffff")
    draw = ImageDraw.Draw(card)
    title = ImageFont.truetype(BOLD, 64)
    name = ImageFont.truetype(BOLD, 44)
    line = ImageFont.truetype(REGULAR, 30)

    draw.rectangle((0, 0, 1200, 12), fill="#4f46e5")
    draw.text((600, 90), "Pragati Bandhu", font=title, fill="#0f172a", anchor="mm")
    draw.text((600, 150), "Simple apps for small businesses in India", font=line, fill="#64748b", anchor="mm")

    for path, label, sub, color, cx in APPS:
        icon = rounded_icon(path, 200, 44)
        card.paste(icon, (cx - 100, 200), icon)
        draw.text((cx, 450), label, font=name, fill=color, anchor="mm")
        draw.text((cx, 500), sub, font=line, fill="#64748b", anchor="mm")

    draw.text((600, 580), "30-day free trial", font=line, fill="#0f172a", anchor="mm")

    out = WEB / "public/og-image.png"
    card.save(out, optimize=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate and check the image**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu
python3 web/scripts/make_og_image.py
file web/public/og-image.png       # expect: PNG image data, 1200 x 630
ls -l web/public/og-image.png      # expect well under 1 MB (WhatsApp skips large images)
```

Open `web/public/og-image.png` and look at it: title at the top, both icons with their names, "30-day free trial" at the bottom, nothing cut off. If the size is over 600 KB, run `magick web/public/og-image.png -colors 256 web/public/og-image.png` and check again.

- [ ] **Step 3: Write `web/public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/shopai</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/chukta</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/features</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/help</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/privacy</loc></url>
  <url><loc>https://tanusreepal78965.github.io/Pragati_Bandhu_Git/terms</loc></url>
</urlset>
```

- [ ] **Step 4: Update `web/index.html`**

Replace the line `<title>PragatiBandhu — Register Your Shop</title>` with:

```html
    <title>Pragati Bandhu — ShopAI &amp; Chukta apps for small businesses</title>
    <meta name="description" content="ShopAI: billing, stock and udhar for your shop. Chukta: attendance, wages and advances for your workers. 30-day free trial." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pragati Bandhu" />
    <meta property="og:title" content="Pragati Bandhu — ShopAI &amp; Chukta" />
    <meta property="og:description" content="ShopAI: billing, stock and udhar for your shop. Chukta: attendance, wages and advances for your workers. 30-day free trial." />
    <meta property="og:url" content="https://tanusreepal78965.github.io/Pragati_Bandhu_Git/" />
    <meta property="og:image" content="https://tanusreepal78965.github.io/Pragati_Bandhu_Git/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Pragati Bandhu — ShopAI &amp; Chukta" />
    <meta name="twitter:description" content="ShopAI: billing, stock and udhar for your shop. Chukta: attendance, wages and advances for your workers. 30-day free trial." />
    <meta name="twitter:image" content="https://tanusreepal78965.github.io/Pragati_Bandhu_Git/og-image.png" />
```

Replace `<div id="root"></div>` with:

```html
    <div id="root"></div>
    <noscript>
      <h1>Pragati Bandhu</h1>
      <p><strong>ShopAI</strong>: billing, stock and udhar for your shop. ₹99/month or ₹999/year, 30-day free trial.
        <a href="/Pragati_Bandhu_Git/shopai">Register ShopAI</a></p>
      <p><strong>Chukta</strong>: attendance, wages and advances for your workers. ₹199/year, 30-day free trial.
        <a href="/Pragati_Bandhu_Git/chukta">Sign up for Chukta</a></p>
    </noscript>
```

Leave the existing icon link and the GitHub Pages SPA `<script>` exactly as they are.

- [ ] **Step 5: Build, lint and check the output**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu/web
npm run build && npm run lint
grep -c 'og:image"' dist/index.html dist/404.html   # expect 1 in each (404.html is a copy made by the build script)
ls dist/og-image.png dist/sitemap.xml                # both present
```

- [ ] **Step 6: Commit**

```bash
git add index.html scripts/make_og_image.py public/og-image.png public/sitemap.xml
git commit -m "feat(web): link-preview tags, share image and sitemap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification, then deploy (with the user's go-ahead)

**Files:** none changed unless a check fails.

- [ ] **Step 1: Clean build and lint**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu/web
rm -rf dist && npm run build && npm run lint
```

Expected: both pass.

- [ ] **Step 2: Run the spec §8 checklist in `npm run preview`**

At `http://localhost:4173/Pragati_Bandhu_Git/`, confirm each item and note the result:
1. `/` renders hero, ShopAI section, Chukta section, pricing, how it works, FAQ, footer.
2. Both hero buttons route correctly (`/shopai`, `/chukta`).
3. ShopAI Play badge opens the store listing in a new tab; Chukta badge is not clickable.
4. Header "Chukta" on `/features` goes to `/#chukta` and scrolls.
5. `/shopai`: pick a plan, type a 10-digit number, press "Send OTP". The reCAPTCHA/OTP request fires (with real Firebase env vars an SMS is sent; with none, an error message appears — either way the flow reached the OTP request just as `/` did before).
6. `/chukta`, `/renew`, `/features`, `/help`, `/forgot-password`, `/admin/login` all render as before.
7. At 360px: no horizontal scroll on any public page; the mobile menu works.

If any item fails, fix it in the file that owns it, rebuild, re-check, and commit with a `fix(web): …` message.

- [ ] **Step 3: Ask the user before pushing**

Pushing to `main` triggers `.github/workflows/deploy-web.yml` and changes the live site. Do not push or merge without the user's explicit go-ahead. When approved:

```bash
cd /Users/suvo/Developer/Pragati_Bandhu
git switch main
git merge --ff-only feat/web-landing
git push origin main
```

- [ ] **Step 4: After deploy**

1. Wait for the "Deploy registration site to GitHub Pages" workflow run to finish (`gh run list --workflow deploy-web.yml --limit 1`).
2. Open `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/shopai` directly in a fresh tab: the registration page loads (this exercises the `404.html` fallback).
3. Open `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/og-image.png`: the image loads.
4. Paste `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/` into a WhatsApp chat: the preview shows the title, description and image. WhatsApp caches previews, so if an old one appears, test with `…/Pragati_Bandhu_Git/?v=1`.

---

## Follow-ups (not in this plan)

- Chukta renewal at ₹199/year on `/renew` (needs its own spec: UI, backend, admin payments).
- `mobile-shopai/src/screens/auth/LoginScreen.tsx:157`: point the register link at `/shopai` in the next ShopAI release.
- `web/src/assets/icon.png` is 1.48 MB and now loads on every page (header logo). Shrinking it to a 256 px version would speed up the first load on slow mobile data.
- When Chukta is live on Google Play: set `CHUKTA.playUrl` in `web/src/content/apps.ts`.
