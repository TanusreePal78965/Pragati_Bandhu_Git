# Web — Umbrella Landing Page for ShopAI and Chukta — Design

**Date:** 2026-10-01
**Status:** Approved in brainstorming, pending written-spec review
**Scope:** `web/` only (the GitHub Pages site at `https://tanusreepal78965.github.io/Pragati_Bandhu_Git/`)

---

## 1. Goal

Turn the website into a promotion site for both apps. Today `/` is the ShopAI registration form and Chukta is reachable only through a footer link to `/chukta`. After this change, `/` is a Pragati Bandhu landing page that presents ShopAI and Chukta side by side, explains each app, shows prices, and sends visitors to the right signup flow or store listing.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | What `/` becomes | Umbrella landing page for both apps. ShopAI registration moves to `/shopai` |
| D2 | Store availability | ShopAI is on Google Play (`com.pragatibandhu.app`). Chukta shows a non-clickable "Coming soon on Google Play" badge; Chukta web signup stays live |
| D3 | Language | English only. Hindi taglines appear as accent lines (e.g. ShopAI's existing tagline) |
| D4 | Pricing shown | ShopAI ₹99/month or ₹999/year. Chukta ₹199/year. Both with a 30-day free trial |
| D5 | Implementation approach | New page inside the existing Vite + React SPA. No separate static site, no prerendering in v1 |
| D6 | SEO | Static `<title>`, meta description, Open Graph/Twitter tags and a `<noscript>` summary in `index.html`; `robots.txt` and `sitemap.xml` in `public/` |
| D7 | Tests | No test runner added. Verification is build + lint + a manual checklist (§8) |
| D8 | One account, both apps | The landing page states that one mobile number can use both apps (confirmed: shared account with one `app_subscriptions` row per app) |

## 3. Routes and navigation

| Route | Before | After |
|---|---|---|
| `/` | ShopAI registration | Umbrella landing page (`Home`) |
| `/shopai` | — | ShopAI registration (the existing `RegistrationPage`, moved unchanged) |
| `/chukta` | Chukta signup | Unchanged |
| `/features`, `/help`, `/renew`, `/forgot-password`, `/privacy`, `/terms` | — | Unchanged |
| `/admin/*` | — | Unchanged |

**Header (all public pages, rendered by `Layout`):**
- Left: Pragati Bandhu logo and wordmark, linking to `/`.
- Right: "ShopAI" and "Chukta" links, then the existing "Renew Subscription" button. On `/` the two app links scroll to `#shopai` / `#chukta`; on other pages they navigate to `/#shopai` / `/#chukta`.
- Below 640px the right side collapses into a menu button that opens a vertical list of the same links.
- The current "Back to Home" link is removed; the logo does that job.

**Footer:** existing links, plus "Register ShopAI" → `/shopai`.

**Existing deep links from the mobile apps:**
- `…/renew` (ShopAI deactivated screen, ShopAI settings) and `…/chukta` (Chukta `WEBSITE_URL`) keep working unchanged.
- The released ShopAI app's login screen opens the bare root `…/` to register (`mobile-shopai/src/screens/auth/LoginScreen.tsx:157`). Those users now land on the landing page, where "Register ShopAI" is the first button in the hero. No redirect is needed. Repointing that link to `/shopai` is a mobile follow-up (§9).

## 4. Landing page content

Sections in order. Copy below is the v1 text; it lives in `src/content/apps.ts` (§6) so it can be edited in one place.

### 4.1 Hero
- Headline: "Simple apps for small businesses in India."
- Subline: "Run your shop and pay your workers right, from your Android phone."
- Two app cards, side by side on desktop, stacked on mobile:
  - **ShopAI** (blue accent): icon, "Billing, stock and udhar for your shop.", "₹99/month · ₹999/year". Primary button "Register ShopAI" → `/shopai`. "Get it on Google Play" badge → `https://play.google.com/store/apps/details?id=com.pragatibandhu.app` (opens in a new tab).
  - **Chukta** (amber accent): icon, "Attendance, wages and advances for your workers.", "₹199/year". Primary button "Sign up for Chukta" → `/chukta`. Greyed "Coming soon on Google Play" badge, not a link.
- Under the cards: "30-day free trial · No card needed".

### 4.2 ShopAI section (`id="shopai"`)
- Tagline: "Stock khatam hone se pehle, ShopAI bata dega."
- Six feature tiles (icon, title, one line):
  1. Billing — cash or udhar bills in seconds.
  2. Inventory — stock goes down automatically with every bill.
  3. Low-stock alerts — know before you run out.
  4. Udhar tracking — every customer's balance in one place.
  5. Reports — today's sales, top products, profit.
  6. AI reorder suggestions and WhatsApp alerts.
- Link "See all features →" `/features`.
- Button "Register ShopAI" → `/shopai`, plus the Play badge.

### 4.3 Chukta section (`id="chukta"`)
- Pitch: "Your worker wage diary. No more notebook maths."
- Seven feature tiles:
  1. Daily attendance — present, half day, absent, or hours worked.
  2. Automatic wages — with a plain-words breakdown like "4.5 days × ₹500".
  3. Advances and deductions — always know what is still outstanding.
  4. Multiple sites — keep workers for each property separate.
  5. Staff logins — let a supervisor mark attendance with a PIN.
  6. Works offline — syncs when you are back online.
  7. English, Hindi and Bengali.
- Button "Sign up for Chukta" → `/chukta`, plus the Coming soon badge.

### 4.4 Pricing
Two plan cards:
- **ShopAI:** ₹99/month, or ₹999/year with a "Save ₹189" badge (same wording as the registration page).
- **Chukta:** ₹199/year.
- Both cards: "30-day free trial", "Renew any time by UPI", and the app's signup button.

### 4.5 How it works
Three steps, shared by both apps:
1. Sign up on this website with your mobile number (OTP).
2. Install the app on your Android phone.
3. Log in with your mobile number and password.

Note under the steps: "Already use one app? Use the same mobile number to sign up for the other."

### 4.6 FAQ
Collapsible items (`<details>`/`<summary>`, no JS state):
- Do I need internet? — Chukta works fully offline and syncs later. ShopAI works offline; cloud backup needs internet.
- How do I pay? — By UPI. Scan the QR code on the Renew page. (link `/renew`)
- What happens after the free trial? — The app asks you to renew. Renew by UPI to keep using it.
- I forgot my password. — Reset it here. (link `/forgot-password`)
- Is my data safe? — See our Privacy Policy. (link `/privacy`)

### 4.7 Footer
As in §3.

## 5. Visual identity

- **Site chrome** (header, footer, hero background, How it works, FAQ): neutral white/slate with the existing `--primary-color` from `App.css`.
- **ShopAI accent:** blue `#1a57db`, used on its hero card, section, and pricing card.
- **Chukta accent:** amber `#D97706`, pressed/emphasis `#B45309`, gradient `#F59E0B` → `#B45309` on its hero card header, section background tint `#FFFBF5`. This matches the direction of the Chukta app redesign.
- Icons: `lucide-react` (already a dependency).
- App icons: copy `mobile-shopai/assets/icon.png` → `web/src/assets/shopai-icon.png` and `mobile-chukta/assets/play-store-512.png` → `web/src/assets/chukta-icon.png`. `web/` never imports from the mobile folders at build time.
- Store badges are styled HTML buttons (black pill, Play triangle icon, "GET IT ON / Google Play"), not Google's image asset. The "coming soon" variant is grey with "COMING SOON ON / Google Play".
- Layout must work from 360px wide with no horizontal scroll.
- No new npm dependencies.

## 6. File structure

| File | Change |
|---|---|
| `web/src/App.tsx` | Remove `RegistrationPage` and its constants; add routes `/` → `Home`, `/shopai` → `ShopAIRegister` |
| `web/src/pages/ShopAIRegister.tsx` | New. `RegistrationPage` moved here verbatim (logic and markup unchanged) |
| `web/src/pages/Home.tsx` | New. Composes the landing sections; scrolls to `location.hash` on mount and on hash change |
| `web/src/content/apps.ts` | New. Typed data for both apps: name, tagline, pitch, accent colours, icon, prices, signup route, `playUrl` (`null` = coming soon), feature list |
| `web/src/components/landing/Hero.tsx` | New |
| `web/src/components/landing/AppSection.tsx` | New. One component, driven by an `apps.ts` entry |
| `web/src/components/landing/Pricing.tsx` | New |
| `web/src/components/landing/HowItWorks.tsx` | New |
| `web/src/components/landing/Faq.tsx` | New |
| `web/src/components/landing/StoreBadge.tsx` | New. Renders a link when `playUrl` is set, a disabled "coming soon" badge when it is `null` |
| `web/src/components/Layout.tsx` | New header (logo, app links, Renew, mobile menu); footer gains "Register ShopAI" |
| `web/src/landing.css` | New. All landing and header styles, scoped by class prefix `lp-` |
| `web/index.html` | Title, meta description, Open Graph/Twitter tags, `<noscript>` summary |
| `web/public/og-image.png` | New. 1200×630 share image: both app icons and names on white |
| `web/public/robots.txt`, `web/public/sitemap.xml` | New. Sitemap lists `/`, `/shopai`, `/chukta`, `/features`, `/help`, `/privacy`, `/terms`; robots disallows `/admin` |

When Chukta goes live on Google Play, the only change is setting `playUrl` for Chukta in `apps.ts`.

## 7. SEO and link previews

`index.html` is served for every route (plus the `404.html` copy), so its tags describe the whole site:
- `<title>`: "Pragati Bandhu — ShopAI & Chukta apps for small businesses"
- `<meta name="description">`: "ShopAI: billing, stock and udhar for your shop. Chukta: attendance, wages and advances for your workers. 30-day free trial."
- Open Graph: `og:title`, `og:description`, `og:type=website`, `og:url` (site root), `og:image` (absolute URL to `og-image.png`). Twitter: `summary_large_image` with the same values.
- `<noscript>`: one paragraph per app with links to `/shopai` and `/chukta`.

The main goal is a good preview card when the link is shared on WhatsApp or Facebook. Google ranking for a client-rendered page is a non-goal for v1.

## 8. Verification

No automated tests are added (D7). Before merging:
1. `cd web && npm run build && npm run lint`: both clean.
2. `npm run preview`, then check on `http://localhost:4173/Pragati_Bandhu_Git/`:
   - `/` renders all sections; both hero buttons route correctly.
   - The ShopAI Play badge opens the store listing in a new tab; the Chukta badge is not clickable.
   - Header "Chukta" link on `/features` goes to `/#chukta` and scrolls to the section.
   - `/shopai` registration reaches the OTP step, as `/` did before.
   - `/chukta`, `/renew`, `/features`, `/help`, `/forgot-password`, `/admin/login` still work.
   - At 360px wide: no horizontal scroll; the mobile menu opens and its links work.
   - A direct load of `/Pragati_Bandhu_Git/shopai` (via the `404.html` fallback) renders the registration page.
3. After deploy: paste the site URL into WhatsApp and check the preview card shows the title, description and image.

## 9. Out of scope / follow-ups

- **Chukta renewal on the web.** `RenewPlan.tsx` is hard-wired to `app: 'shopai'` and ₹99/₹999. Chukta renewal at ₹199/year (UI, backend, admin payments) needs its own spec. Until then, the landing page only displays the Chukta price.
- **ShopAI app register link.** Change `LoginScreen.tsx:157` in `mobile-shopai` to open `/shopai` in the next ShopAI release.
- Hindi/Bengali versions of the site.
- Build-time prerendering for search engines.
- Custom domain.
