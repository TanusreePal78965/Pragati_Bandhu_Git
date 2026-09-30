# Prompt for Antigravity: redesign the Chukta app's UI to match ShopAI

Paste everything below the line into Antigravity, pointed at the `Pragati_Bandhu` repo root.

---

## Task

Redesign the visual design of the **Chukta** mobile app (`mobile-chukta/`) so it looks and feels like the **ShopAI** app (`mobile-shopai/`) — same design language, same repo, same Expo/React Native version, but currently Chukta uses a plain, unstyled UI kit while ShopAI has a polished one. This is a **visual-only** redesign: layout, color, spacing, typography, icons, shadows, headers, empty states. It must not change what the app does, its navigation structure, its data, or its text content.

## Repo layout

- `mobile-shopai/` — the reference app. Read its design, don't import from it. It's a fully separate codebase; nothing is shared between the two apps and that must stay true.
- `mobile-chukta/` — the app you're redesigning. A worker-wage/attendance diary app for shop owners with staff. Expo SDK 54, React Native 0.81.5, TypeScript, `@react-navigation` v7 (bottom-tabs + native-stack).
- `web/`, `supabase/` — do not touch these at all.

## What "match ShopAI" means, concretely

Read these ShopAI files first — they *are* the design system to copy the feel of:

- `mobile-shopai/src/theme/colors.ts` — palette (primary `#1a57db`, background `#f9fafb`, surface/card `#ffffff`, text `#111827`, textSecondary `#4b5563`, border `#e5e7eb`, semantic success/warning/error).
- `mobile-shopai/src/theme/spacing.ts` — spacing scale (4/8/16/24/32/40) and `roundness: 8` (the standard corner radius, called "Stitch ROUND_EIGHT" in a comment — it's a Google Stitch-generated design system).
- `mobile-shopai/src/theme/typography.ts` — size scale (12/14/16/18/20/24/32) and line-heights. (`Inter-*` font family is defined but not actually loaded anywhere in the app — don't chase custom font loading, system font is fine, matching current ShopAI behavior.)
- `mobile-shopai/src/components/common/PrimaryButton.tsx` — button shape: `roundness` radius, colored drop shadow (`shadowColor: colors.primary`, `shadowOpacity: 0.3`, `shadowRadius: 8`, `elevation: 4`), bold white text.
- `mobile-shopai/src/components/common/ScreenHeader.tsx` — header pattern: back arrow + title on the left, optional right-side element/badge, `borderBottomWidth: 1` in `colors.border`, `colors.surface` background. Chukta's screens should get a header in this style instead of native-stack's bare default title.
- `mobile-shopai/src/components/common/CustomAlertModal.tsx` — typed alert styling (success/error/warning/info/confirm each with their own bg+color pair) — Chukta uses React Native's plain `Alert.alert` in several places (property archive/restore confirm, correcting a money entry, discarding sync issues, logout confirm); if you introduce a custom alert to match this look, it must preserve every existing confirm/cancel button and its exact behavior.
- `mobile-shopai/src/components/home/SummaryCard.tsx` — card pattern for a dashboard-style number callout; Chukta's wage-due/advance cards on Worker detail and Advances are the equivalent surface.
- Icons: ShopAI uses `@expo/vector-icons` (`Ionicons`), already a dependency in `mobile-chukta/package.json` too (Chukta's bottom-tab icons already use it in `src/app/navigation.tsx`). Extend that to every icon need (header back arrow, empty states, action buttons) — pick sensible Ionicons names for Chukta's own domain (workers/attendance/money), don't literally reuse ShopAI's icon choices where the meaning doesn't fit (e.g. ShopAI's storefront icon has no Chukta equivalent).

## Files to redesign in `mobile-chukta/`

**UI kit (redesign these first, then propagate):**
- `src/ui/theme.ts` — replace with a ShopAI-equivalent palette/spacing/typography scale, keeping the same exported shape other files already destructure (`colors`, `space`, `radius` — check current usages with `grep -rn "from '../ui/theme'" src` before renaming anything, so every import site still compiles).
- `src/ui/components.tsx` — the shared kit: `Screen`, `Card`, `Section`, `Title`, `Label`, `Muted`, `ErrorText`, `Loading`, `Button`, `Field`, `Segmented`, `WeekdayPicker`, `Row`, `SwitchRow`. Redesign each to the ShopAI look (shadows, radius, spacing) while keeping every prop name and behavior (loading/disabled states, `testID` passthrough) identical — these are used everywhere.
- `src/ui/DateField.tsx`, `src/ui/MonthCalendar.tsx`, `src/ui/RequireProperty.tsx`, `src/ui/options.ts` — restyle to match.

**Screens (apply the redesigned kit; add a ScreenHeader-style header to each):**
`src/screens/LanguageScreen.tsx`, `LoginScreen.tsx`, `SettingsScreen.tsx`, `PropertiesScreen.tsx`, `PropertyFormScreen.tsx`, `TodayScreen.tsx`, `WorkersScreen.tsx`, `WorkerDetailScreen.tsx`, `WorkerFormScreen.tsx`, `MoneyEntryScreen.tsx`, `AdvancesScreen.tsx`, `StaffFormScreen.tsx`, `SyncIssuesScreen.tsx`, `src/screens/settings/PropertySection.tsx`, `src/screens/settings/StaffSection.tsx`.

**Chukta-specific UI with no ShopAI equivalent** — design these consistently with the rest, using your judgment for iconography/color-coding, but keep them recognizable as the same family:
- Today screen's attendance status pills (Present / Half day / Absent / Hours-worked) — give each status a distinct, consistent color.
- The month calendar's day cells (present/absent/half-day/hours/weekly-off/future/outside-employment states) in `MonthCalendar.tsx`.
- Wage-due / advance-outstanding balance cards (Worker detail, Advances tab).
- The staff PIN entry forms and the "entries that didn't sync" dead-letter list/grouping.

## Hard constraints — breaking any of these is a failed job

1. **No backend/logic changes.** Do not touch anything under `src/domain/`, `src/repos/`, `src/sync/`, `src/db/`, `src/auth/`, `src/api/`, `supabase/`, or `web/`. Only presentation: `src/ui/`, `src/screens/`, `src/app/navigation.tsx` (header/tab-icon styling only, not routes), and the theme.
2. **Every `testID` stays exactly as it is**, on the same element type/role, because the test suite asserts on them. Do not rename, remove, or move a `testID` to a different component instance. If you need to wrap an element in a new container for styling, keep the `testID` on the interactive element itself (the `Pressable`/`TextInput`/etc.), not the wrapper.
3. **Every visible string still goes through `t('...')`.** Don't hardcode new UI text. If a new element needs text (e.g. a new empty-state message), add the key to all three language files — `src/i18n/en.json`, `src/i18n/bn.json`, `src/i18n/hi.json` — with real Bengali/Hindi translations (not machine-transliterated placeholders), keeping the same key structure in all three. Do not change the *meaning* of existing copy, only wrapping/truncation if layout requires it.
4. **Don't change behavior.** Same navigation targets, same validation rules, same confirm/cancel dialogs with the same buttons, same data shown. If restyling a button changes its `onPress`, that's a bug.
5. **No new native dependencies without checking compatibility first**: run `npx expo install --check` in `mobile-chukta/` after adding anything, and prefer `@expo/vector-icons` (already present) over adding new icon/animation/gradient libraries. If you do add a new Expo-compatible package, use `npx expo install <pkg>` (not plain `npm install`) so the version matches SDK 54.
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

- Work incrementally: redesign the UI kit first, verify it compiles and tests still pass, then move through screens in small groups (e.g. auth/settings screens, then Today/Workers/WorkerDetail, then money/staff/sync-issues), committing after each group with a normal git commit (small diffs, not one giant commit).
- Before starting, run `npx jest` and `npx tsc --noEmit` in `mobile-chukta/` to confirm the baseline is green (172 tests as of now), so any later failure is attributable to your change.
- If something in this brief is ambiguous (e.g. exact color for an attendance status), make a reasonable, consistent choice and note it in your summary rather than stopping to ask — this app doesn't have a human designer on call. But do NOT reinterpret the hard constraints above; those are non-negotiable.

## Explicit non-goals

- No new screens or features.
- No app icon/splash screen work (those are known placeholders, tracked separately — don't touch `mobile-chukta/assets/`).
- No changes to `eas.json`, `app.json`'s `package`/`bundleIdentifier`/`projectId`, or any Supabase/env configuration.
- No copy/wording changes beyond what layout strictly requires.

## Done when

- [ ] `mobile-chukta/` visually matches ShopAI's design language (palette, spacing, radius, shadows, header style, icon usage).
- [ ] `npx jest` → 172+ passing, 0 failing (test count may grow if you fixed styling-only assertions, never shrink).
- [ ] `npx tsc --noEmit` → clean.
- [ ] No file outside `mobile-chukta/src/{ui,screens,i18n,app/navigation.tsx}` was modified.
- [ ] Every `testID` from before your change still exists, unchanged, in the same tree position relative to its screen.
- [ ] `git diff --stat` shows no changes to `mobile-shopai/`, `web/`, or `supabase/`.
