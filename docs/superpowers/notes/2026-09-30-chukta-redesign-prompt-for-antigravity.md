# Prompt for Antigravity: redesign the Chukta app's UI

Paste everything below the line into Antigravity, pointed at the `Pragati_Bandhu` repo root.

---

## Task

Redesign the visual design of the **Chukta** mobile app (`mobile-chukta/`). Chukta currently uses a plain, unstyled UI kit. It needs a richer, more premium-feeling visual design — Chukta's *functionality* is intentionally minimal (a worker-wage/attendance diary: a handful of screens, simple forms, simple lists), so the UI has to carry more of the perceived quality: color, depth, iconography, and polish, not just flat rows of text.

This is a **visual-only** redesign: layout, color, spacing, typography, icons, shadows, headers, cards, empty states, badges. It must not change what the app does, its navigation structure, its data, or its text content.

Use the sibling app **ShopAI** (`mobile-shopai/`) as a reference for *structural* design patterns only — spacing scale, corner-radius convention, shadow/elevation style, header layout, button shape. **Do not copy ShopAI's color palette.** Chukta must look like its own distinct product, not a reskinned ShopAI. See the color-identity section below.

## Repo layout

- `mobile-shopai/` — read for structural pattern reference only (see above). Don't import from it. It's a fully separate codebase; nothing is shared between the two apps and that must stay true.
- `mobile-chukta/` — the app you're redesigning. Expo SDK 54, React Native 0.81.5, TypeScript, `@react-navigation` v7 (bottom-tabs + native-stack).
- `web/`, `supabase/` — do not touch these at all.

## Color identity — warm amber/gold, distinct from ShopAI's blue

Chukta's current primary color is teal (`#0F766E`, in `mobile-chukta/src/ui/theme.ts`). Replace it with a **warm amber/gold identity** — it should read as trustworthy and connected to wages/money, and feel distinctly different from ShopAI's cool blue (`#1a57db`).

Starting palette (adjust as needed for contrast/accessibility, but stay in this family):

- **Primary:** amber/gold, e.g. `#D97706` (amber-600) for interactive elements, `#B45309` (amber-700) for pressed/emphasis states.
- **Primary gradient pair:** `#F59E0B` → `#B45309` for gradient surfaces (see "Richness" below).
- **Primary soft (badges/backgrounds):** `#FEF3C7` (amber-100).
- **Background:** warm off-white, e.g. `#FFFBF5` or `#FDF8F0` — not the cool gray ShopAI uses.
- **Card/surface:** `#FFFFFF` or a very light warm white, e.g. `#FFFDF9`.
- **Text:** warm dark, e.g. `#292524` (stone-800) rather than a cool `#111827`.
- **Muted text:** warm gray, e.g. `#78716C` (stone-500).
- **Border:** warm-toned light gray, e.g. `#EAE0D5`.
- **A complementary accent color** distinct from amber, for anything that needs to contrast against amber (e.g. a deep teal or plum) — needed because status colors (below) can't all be amber-family or they'll blend into the brand color.
- **Semantic status colors** (attendance, sync, staff state) stay conventional so they're instantly readable, not brand-colored: green family for present/synced/active, red family for absent/error/inactive, a distinct amber/yellow *different in value* from the brand primary for half-day/warning, blue for hours-worked, neutral gray for weekly-off/not-applicable.

## Richness — what to add beyond color

The functionality is simple, so lean on these to make it feel considered rather than bare:

1. **Gradient cards & headers.** Use `expo-linear-gradient` (Expo SDK 54-compatible; install with `npx expo install expo-linear-gradient`, don't use `react-native-linear-gradient`). Apply subtle gradients (the amber gradient pair above, or a soft warm-white-to-amber-tint wash) on: screen headers, the wage-due card and advance-outstanding card (Worker detail, Advances tab), and similar hero surfaces. Keep gradients subtle — this is a utility app, not a marketing page; avoid anything that hurts text contrast/readability.
2. **Color-coded status chips/badges.** Replace plain status text with small colored pill badges for: attendance status (Present/Half day/Absent/Hours) on Today and the month calendar, sync status (pending/synced/dead-lettered) in Settings and the sync-issues screen, staff active/inactive in the staff list. Use the semantic colors above, consistently, everywhere the same status appears.
3. **Worker avatars/initials.** In worker lists (Workers tab, Advances tab, anywhere a worker is listed by name), replace the plain text row with a small colored circle showing the worker's initial(s), next to their name. Derive the circle's color deterministically from the worker's name/id (a small hash → a fixed palette of 5-6 harmonious accent colors) so the same worker always gets the same color, and pick a legible dark text color for the initial. Keep it simple — no photos, just initials.
4. **Illustrated empty states.** Every "nothing here yet" screen (no workers, no advances outstanding, no properties, no sync issues, no money history) gets a large centered icon (via `@expo/vector-icons`/`Ionicons` — no new illustration/image assets, since there are no designer assets available yet) plus the existing friendly copy, instead of one line of small muted text. Pick an icon that matches the empty state's meaning.

## Structural patterns to borrow from ShopAI (not its colors)

Read these ShopAI files for *pattern* reference:

- `mobile-shopai/src/theme/spacing.ts` — spacing scale (4/8/16/24/32/40) and `roundness: 8` (the standard corner radius).
- `mobile-shopai/src/theme/typography.ts` — size scale (12/14/16/18/20/24/32) and line-heights. (`Inter-*` font family is defined there but not actually loaded anywhere in ShopAI — don't chase custom font loading, system font is fine.)
- `mobile-shopai/src/components/common/PrimaryButton.tsx` — button shape: rounded, colored drop shadow (`shadowOpacity: 0.3`, `shadowRadius: 8`, `elevation: 4`) using *Chukta's* primary color, not ShopAI's blue.
- `mobile-shopai/src/components/common/ScreenHeader.tsx` — header layout: back arrow + title on the left, optional right-side element/badge, bottom border. Chukta's screens should get a header in this layout (styled with Chukta's own palette/gradient) instead of native-stack's bare default title.
- `mobile-shopai/src/components/common/CustomAlertModal.tsx` — typed alert layout (success/error/warning/info/confirm each with their own bg+color pair, restyled with Chukta's palette). Chukta uses React Native's plain `Alert.alert` in several places (property archive/restore confirm, correcting a money entry, discarding sync issues, logout confirm); if you introduce a custom alert to match this look, it must preserve every existing confirm/cancel button and its exact behavior.
- `mobile-shopai/src/components/home/SummaryCard.tsx` — card pattern for a dashboard-style number callout; Chukta's wage-due/advance cards are the equivalent surface (give them the gradient treatment above).
- Icons: `@expo/vector-icons` (`Ionicons`) is already a dependency in `mobile-chukta/package.json` (Chukta's bottom-tab icons already use it in `src/app/navigation.tsx`). Extend that to every icon need — pick names that fit Chukta's own domain (workers/attendance/money), not ShopAI's shop-themed icons.

## Files to redesign in `mobile-chukta/`

**UI kit (redesign these first, then propagate):**
- `src/ui/theme.ts` — replace with the amber/gold palette + spacing/typography scale above, keeping the same exported shape other files already destructure (`colors`, `space`, `radius` — check current usages with `grep -rn "from '../ui/theme'" src` before renaming anything, so every import site still compiles).
- `src/ui/components.tsx` — the shared kit: `Screen`, `Card`, `Section`, `Title`, `Label`, `Muted`, `ErrorText`, `Loading`, `Button`, `Field`, `Segmented`, `WeekdayPicker`, `Row`, `SwitchRow`. Redesign each to the new look (shadows, radius, spacing, gradients where relevant) while keeping every prop name and behavior (loading/disabled states, `testID` passthrough) identical — these are used everywhere. Add new small components as needed for the richness items above (e.g. a `Badge`/`StatusChip` component, an `Avatar` component, an `EmptyState` component) rather than inlining that styling into every screen.
- `src/ui/DateField.tsx`, `src/ui/MonthCalendar.tsx`, `src/ui/RequireProperty.tsx`, `src/ui/options.ts` — restyle to match.

**Screens (apply the redesigned kit; add a header in the ScreenHeader layout to each):**
`src/screens/LanguageScreen.tsx`, `LoginScreen.tsx`, `SettingsScreen.tsx`, `PropertiesScreen.tsx`, `PropertyFormScreen.tsx`, `TodayScreen.tsx`, `WorkersScreen.tsx`, `WorkerDetailScreen.tsx`, `WorkerFormScreen.tsx`, `MoneyEntryScreen.tsx`, `AdvancesScreen.tsx`, `StaffFormScreen.tsx`, `SyncIssuesScreen.tsx`, `src/screens/settings/PropertySection.tsx`, `src/screens/settings/StaffSection.tsx`.

**Chukta-specific UI with no ShopAI equivalent** — apply the richness elements here specifically:
- Today screen's attendance status pills (Present / Half day / Absent / Hours-worked) → status chips.
- The month calendar's day cells (present/absent/half-day/hours/weekly-off/future/outside-employment states) in `MonthCalendar.tsx` → color-coded per the semantic status colors.
- Wage-due / advance-outstanding balance cards (Worker detail, Advances tab) → gradient hero cards.
- Worker list rows (Workers, Advances) → avatar/initials.
- Every empty list/state across the app → illustrated empty state.
- The staff PIN entry forms and the "entries that didn't sync" dead-letter list/grouping → status chips for staff active/inactive and sync status.

## Hard constraints — breaking any of these is a failed job

1. **No backend/logic changes.** Do not touch anything under `src/domain/`, `src/repos/`, `src/sync/`, `src/db/`, `src/auth/`, `src/api/`, `supabase/`, or `web/`. Only presentation: `src/ui/`, `src/screens/`, `src/app/navigation.tsx` (header/tab-icon styling only, not routes), and the theme.
2. **Every `testID` stays exactly as it is**, on the same element type/role, because the test suite asserts on them. Do not rename, remove, or move a `testID` to a different component instance. If you need to wrap an element in a new container for styling, keep the `testID` on the interactive element itself (the `Pressable`/`TextInput`/etc.), not the wrapper.
3. **Every visible string still goes through `t('...')`.** Don't hardcode new UI text. If a new element needs text (e.g. a new empty-state message), add the key to all three language files — `src/i18n/en.json`, `src/i18n/bn.json`, `src/i18n/hi.json` — with real Bengali/Hindi translations (not machine-transliterated placeholders), keeping the same key structure in all three. Do not change the *meaning* of existing copy, only wrapping/truncation if layout requires it.
4. **Don't change behavior.** Same navigation targets, same validation rules, same confirm/cancel dialogs with the same buttons, same data shown. If restyling a button changes its `onPress`, that's a bug.
5. **New dependencies:** `expo-linear-gradient` is expected (see Richness §1) — install with `npx expo install expo-linear-gradient`, never plain `npm install`, so the version matches SDK 54. Beyond that, prefer `@expo/vector-icons` (already present) over adding new icon/illustration libraries. Run `npx expo install --check` in `mobile-chukta/` after adding anything.
6. **Tests and types must stay green.** After each meaningful chunk of work, run from `mobile-chukta/`:
   ```
   npx jest
   npx tsc --noEmit
   ```
   All 172 tests must keep passing and `tsc` must be clean before you consider the job done. If a test fails because it asserted on old styling text/structure (not testID/behavior), fix the test's assertion to match the new (still-correct) behavior — never delete a test to make it pass.
7. **Don't touch `mobile-shopai/` at all** — read-only reference.
8. **Don't rename or restructure navigation routes/tabs.** The tab order (Today, Workers, Advances, Settings) and the stack routes (`Language`, `Properties`, `PropertyForm`, `WorkerDetail`, `WorkerForm`, `MoneyEntry`, `StaffForm`, `SyncIssues`) stay as they are.
9. **Android is the primary target** (the only device this has been tested on so far is an Android tablet), but don't break iOS — keep using `react-native-safe-area-context` as the existing screens already do.

## Process

- Work incrementally: redesign the UI kit (theme + shared components, including the new `Badge`/`Avatar`/`EmptyState` components) first, verify it compiles and tests still pass, then move through screens in small groups (e.g. auth/settings screens, then Today/Workers/WorkerDetail, then money/staff/sync-issues), committing after each group with a normal git commit (small diffs, not one giant commit).
- Before starting, run `npx jest` and `npx tsc --noEmit` in `mobile-chukta/` to confirm the baseline is green (172 tests as of now), so any later failure is attributable to your change.
- If something in this brief is ambiguous (e.g. exact shade for a status chip), make a reasonable, consistent choice within the palette given above and note it in your summary rather than stopping to ask — this app doesn't have a human designer on call. But do NOT reinterpret the hard constraints above; those are non-negotiable.

## Explicit non-goals

- No new screens or features.
- No app icon/splash screen work (those are known placeholders, tracked separately — don't touch `mobile-chukta/assets/`).
- No changes to `eas.json`, `app.json`'s `package`/`bundleIdentifier`/`projectId`, or any Supabase/env configuration.
- No copy/wording changes beyond what layout strictly requires.
- No micro-animations/transitions in this pass (out of scope — would need `react-native-reanimated` as a further new dependency; skip it).

## Done when

- [ ] `mobile-chukta/` has its own distinct warm amber/gold visual identity (not ShopAI's blue), with gradient hero cards, status chips, worker avatars, and illustrated empty states throughout.
- [ ] `npx jest` → 172+ passing, 0 failing (test count may grow if you fixed styling-only assertions, never shrink).
- [ ] `npx tsc --noEmit` → clean.
- [ ] No file outside `mobile-chukta/src/{ui,screens,i18n,app/navigation.tsx}` was modified (plus `package.json`/`package-lock.json` for the one new dependency).
- [ ] Every `testID` from before your change still exists, unchanged, in the same tree position relative to its screen.
- [ ] `git diff --stat` shows no changes to `mobile-shopai/`, `web/`, or `supabase/`.
