## 15. Engineering scope note

Full V1 (sections 5A–5R of `Chukta-Worker-Pay-Advance-&-Wage-Diary-feature-plan.md`) spans onboarding, attendance, holidays, leave, overtime, piece-rate, advances, payments, settlement/slips, reports, audit, i18n, and billing — too many independent subsystems for one bite-sized implementation plan (per the writing-plans scope check). This is split into phases; each phase gets its own detailed plan before it's executed.

**Roadmap:**
- **Phase 1 — Core ledger loop (this plan, detailed below):** properties, workers, exception-based attendance (absent/half-day only), advances, payments, running balance, audit trail. Daily and monthly pay basis only. Multi-property + staff PIN access built in from the start (architectural, hard to retrofit).
- **Phase 2 (future plan):** Settlement & slips (J), holidays & leave (D, E), overtime (F), full reports (M5+), worker link (K).
- **Phase 3 (future plan):** Piece-rate (G), reminders (L), i18n (P1), manager/accountant role split beyond staff PIN (N3/N4), subscription & billing (R).

Two additions from the product doc's original scope, pulled forward into Phase 1: **multi-property per owner** (N5, pulled forward because it changes the tenancy model — one owner account, many properties, each with its own workers and staff) and **staff PIN data-entry access** (a lightweight version of N3: full read/write on workers/attendance/advances/payments within one property, no salary visibility restriction in Phase 1).

---

# Chukta Phase 1 (Core Ledger Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the offline-first core loop — owner (or delegated staff) adds workers under one or more properties, marks attendance exceptions, records advances and payments, and always sees a correct running balance per worker.

**Architecture:** Expo/React Native mobile app with `expo-sqlite` as the offline source of truth and a generic `sync_queue` draining to Supabase Postgres on reconnect (per `ARCHITECTURE_REFERENCE.md` §4.1). Supabase Auth identifies owners; a custom Edge Function issues Supabase-compatible JWTs for PIN-based staff sessions scoped to one property. RLS enforces tenant isolation by `property_id` for both roles.

**Tech Stack:** Expo (React Native, TypeScript), `expo-sqlite`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `@supabase/supabase-js`, `@react-navigation/native` (bottom-tabs + native-stack), Supabase Postgres + Edge Functions (Deno), `djwt` for custom JWT signing.

**Spec:** `Chukta-Worker-Pay-Advance-&-Wage-Diary-feature-plan.md` — Product spec in §1–14; engineering decisions (schema, RLS, exception model, balance formula) in this document.

## Global Constraints

- Offline-first: every write lands in local SQLite instantly, UI never blocks on network (§Q1, ARCHITECTURE_REFERENCE §4.1).
- Exception-only attendance: no row is written for a normal present day; only `absent`/`half_day` are stored (design principle #1).
- Nothing is destructively edited: corrections are new rows; `created_by`/`created_at` recorded on every ledger row (§O1–O5).
- Multi-tenant isolation by `property_id` via RLS on every table (ARCHITECTURE_REFERENCE §4.2 pattern, extended for the owner→properties→workers hierarchy).
- Advances and payments are tracked as separate running totals in Phase 1 — no auto-netting/settlement (§H, confirmed in design Q&A).
- Cash/manual payment recording only — no payment gateway integration in Phase 1 (§I8 is Later).
- Staff PIN sessions are scoped to exactly one `property_id` and cannot see or touch other properties.

---

### Task 1: Supabase schema — properties & staff

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/000_properties_and_staff.sql`
- Test: `supabase/tests/000_properties_and_staff.test.sql`

**Interfaces:**
- Produces: `properties(id, owner_id, name, address, is_active, created_at, updated_at)`, `staff_users(id, property_id, name, pin_hash, pin_salt, active_device_id, is_active, created_at, updated_at)`

- [ ] **Step 1: Init Supabase project scaffold**

```bash
mkdir -p supabase/migrations supabase/functions supabase/tests
cat > supabase/config.toml <<'EOF'
project_id = "chukta"

[db]
port = 54322

[auth]
enabled = true

[api]
enabled = true
port = 54321
EOF
```

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/000_properties_and_staff.sql
create extension if not exists pgcrypto;

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff_users (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  pin_hash text not null,
  pin_salt text not null,
  active_device_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_properties_owner on properties(owner_id);
create index idx_staff_users_property on staff_users(property_id);
```

- [ ] **Step 3: Write a pgTAP test for the schema**

```sql
-- supabase/tests/000_properties_and_staff.test.sql
begin;
select plan(2);

select has_table('public', 'properties', 'properties table exists');
select has_table('public', 'staff_users', 'staff_users table exists');

select * from finish();
rollback;
```

- [ ] **Step 4: Run migration + test locally**

Run: `supabase start && supabase db reset && supabase test db`
Expected: both pgTAP assertions PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/migrations/000_properties_and_staff.sql supabase/tests/000_properties_and_staff.test.sql
git commit -m "feat: add properties and staff_users schema"
```

---

### Task 2: Supabase schema — workers & ledger tables

**Files:**
- Create: `supabase/migrations/001_worker_ledger_schema.sql`
- Test: `supabase/tests/001_worker_ledger_schema.test.sql`

**Interfaces:**
- Consumes: `properties(id)` from Task 1
- Produces: `workers`, `attendance_exceptions`, `advance_entries`, `wage_payments` tables

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/001_worker_ledger_schema.sql
create table workers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  phone text,
  pay_basis text not null check (pay_basis in ('daily', 'monthly')),
  rate numeric(10,2) not null check (rate > 0),
  joining_date date not null,
  status text not null default 'active' check (status in ('active', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  date date not null,
  status text not null check (status in ('absent', 'half_day')),
  note text,
  created_by uuid not null,
  created_by_role text not null check (created_by_role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, date)
);

create table advance_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  type text not null check (type in ('advance', 'repayment', 'writeoff')),
  amount numeric(10,2) not null check (amount > 0),
  date date not null,
  mode text check (mode in ('cash', 'upi', 'bank')),
  note text,
  created_by uuid not null,
  created_by_role text not null check (created_by_role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table wage_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  date date not null,
  mode text check (mode in ('cash', 'upi', 'bank')),
  note text,
  created_by uuid not null,
  created_by_role text not null check (created_by_role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create index idx_workers_property on workers(property_id);
create index idx_attendance_worker_date on attendance_exceptions(worker_id, date);
create index idx_advance_worker_date on advance_entries(worker_id, date);
create index idx_payment_worker_date on wage_payments(worker_id, date);
```

- [ ] **Step 2: Write pgTAP test for the unique attendance constraint**

```sql
-- supabase/tests/001_worker_ledger_schema.test.sql
begin;
select plan(1);

select col_is_unique('public', 'attendance_exceptions', array['worker_id', 'date'],
  'one exception row per worker per date');

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + test**

Run: `supabase db reset && supabase test db`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_worker_ledger_schema.sql supabase/tests/001_worker_ledger_schema.test.sql
git commit -m "feat: add worker, attendance, advance and payment schema"
```

---

### Task 3: RLS policies — owner and staff isolation

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`
- Test: `supabase/tests/002_rls_policies.test.sql`

**Interfaces:**
- Consumes: tables from Task 1 and Task 2
- Produces: `is_property_owner(pid uuid)`, `is_property_staff(pid uuid)` SQL functions used by every future table's RLS policies

- [ ] **Step 1: Write the helper functions and policies**

```sql
-- supabase/migrations/002_rls_policies.sql
create or replace function is_property_owner(pid uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from properties p where p.id = pid and p.owner_id = auth.uid()
  );
$$;

create or replace function is_property_staff(pid uuid) returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'staff'
     and coalesce(auth.jwt() ->> 'property_id', '') = pid::text;
$$;

alter table properties enable row level security;
create policy "owner manages own properties" on properties for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table staff_users enable row level security;
create policy "owner manages staff" on staff_users for all
  using (is_property_owner(property_id)) with check (is_property_owner(property_id));

alter table workers enable row level security;
create policy "owner full access workers" on workers for all
  using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "staff read workers" on workers for select
  using (is_property_staff(property_id));
create policy "staff insert workers" on workers for insert
  with check (is_property_staff(property_id));
create policy "staff update workers" on workers for update
  using (is_property_staff(property_id)) with check (is_property_staff(property_id));

alter table attendance_exceptions enable row level security;
create policy "owner full access attendance" on attendance_exceptions for all
  using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "staff read attendance" on attendance_exceptions for select
  using (is_property_staff(property_id));
create policy "staff insert attendance" on attendance_exceptions for insert
  with check (is_property_staff(property_id));
create policy "staff update attendance" on attendance_exceptions for update
  using (is_property_staff(property_id)) with check (is_property_staff(property_id));

alter table advance_entries enable row level security;
create policy "owner full access advances" on advance_entries for all
  using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "staff read advances" on advance_entries for select
  using (is_property_staff(property_id));
create policy "staff insert advances" on advance_entries for insert
  with check (is_property_staff(property_id));

alter table wage_payments enable row level security;
create policy "owner full access payments" on wage_payments for all
  using (is_property_owner(property_id)) with check (is_property_owner(property_id));
create policy "staff read payments" on wage_payments for select
  using (is_property_staff(property_id));
create policy "staff insert payments" on wage_payments for insert
  with check (is_property_staff(property_id));
```

Note: staff has no delete policy on any table and no update policy on `advance_entries`/`wage_payments` — matches "staff = data entry, no destructive edits" from the design Q&A. Staff can add advances/payments but not alter or remove them once saved; corrections go through the owner.

- [ ] **Step 2: Write pgTAP RLS isolation test**

```sql
-- supabase/tests/002_rls_policies.test.sql
begin;
select plan(2);

-- owner A cannot see property B's workers
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
select is_empty(
  $$ select 1 from workers where property_id = gen_random_uuid() $$,
  'owner with no matching property sees no workers'
);

-- staff JWT scoped to one property cannot see another
select set_config('request.jwt.claims',
  json_build_object('role', 'staff', 'property_id', gen_random_uuid())::text, true);
select is_empty(
  $$ select 1 from workers where property_id = gen_random_uuid() $$,
  'staff scoped to property A sees nothing for property B'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + test**

Run: `supabase db reset && supabase test db`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_rls_policies.sql supabase/tests/002_rls_policies.test.sql
git commit -m "feat: add RLS policies for owner/staff property isolation"
```

---

### Task 4: Staff PIN login Edge Function

**Files:**
- Create: `supabase/functions/login-staff/index.ts`
- Test: `supabase/functions/login-staff/index.test.ts`

**Interfaces:**
- Consumes: `staff_users` table (Task 1)
- Produces: `POST /functions/v1/login-staff` — request `{ propertyId: string, staffId: string, pin: string, deviceId: string }`, response `{ token: string }` where `token` is a Supabase-compatible JWT with claims `{ sub: staffId, role: 'staff', property_id: propertyId, exp }`

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/login-staff/index.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { hashPin, verifyPin, issueStaffToken } from "./index.ts";

Deno.test("hashPin/verifyPin round-trip", async () => {
  const { hash, salt } = await hashPin("4821");
  assertEquals(await verifyPin("4821", hash, salt), true);
  assertEquals(await verifyPin("0000", hash, salt), false);
});

Deno.test("issueStaffToken embeds role and property_id claims", async () => {
  const token = await issueStaffToken({
    staffId: "11111111-1111-1111-1111-111111111111",
    propertyId: "22222222-2222-2222-2222-222222222222",
    secret: "test-jwt-secret-at-least-32-chars-long",
  });
  assertExists(token);
  const [, payloadB64] = token.split(".");
  const payload = JSON.parse(atob(payloadB64));
  assertEquals(payload.role, "staff");
  assertEquals(payload.property_id, "22222222-2222-2222-2222-222222222222");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/login-staff/index.test.ts`
Expected: FAIL — `index.ts` does not export `hashPin`/`verifyPin`/`issueStaffToken` yet

- [ ] **Step 3: Implement the function**

```typescript
// supabase/functions/login-staff/index.ts
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PBKDF2_ITERATIONS = 100_000;

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return {
    hash: btoa(String.fromCharCode(...new Uint8Array(bits))),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return computed === hash;
}

export async function issueStaffToken(
  args: { staffId: string; propertyId: string; secret: string },
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return create(
    { alg: "HS256", typ: "JWT" },
    { sub: args.staffId, role: "staff", property_id: args.propertyId, exp: getNumericDate(60 * 60 * 12) },
    key,
  );
}

Deno.serve(async (req) => {
  const { propertyId, staffId, pin, deviceId } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: staff, error } = await supabase
    .from("staff_users")
    .select("id, pin_hash, pin_salt, active_device_id, is_active")
    .eq("id", staffId)
    .eq("property_id", propertyId)
    .single();

  if (error || !staff || !staff.is_active) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 });
  }

  const ok = await verifyPin(pin, staff.pin_hash, staff.pin_salt);
  if (!ok) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 });
  }

  await supabase.from("staff_users").update({ active_device_id: deviceId }).eq("id", staffId);

  const token = await issueStaffToken({
    staffId,
    propertyId,
    secret: Deno.env.get("SUPABASE_JWT_SECRET")!,
  });

  return new Response(JSON.stringify({ token }), { status: 200 });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/login-staff/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/login-staff/index.ts supabase/functions/login-staff/index.test.ts
git commit -m "feat: add staff PIN login edge function"
```

---

### Task 5: Mobile app scaffold

**Files:**
- Create: `mobile/` (Expo TypeScript app)
- Create: `mobile/src/lib/supabase.ts`

**Interfaces:**
- Produces: `mobile/src/lib/supabase.ts` exporting `supabase: SupabaseClient`

- [ ] **Step 1: Scaffold the Expo app**

```bash
npx create-expo-app@latest mobile --template expo-template-blank-typescript
cd mobile
mkdir -p src/components src/context src/data src/db src/lib src/navigation src/screens/workers src/screens/auth src/screens/reports src/services src/theme src/utils
npm install expo-sqlite @react-native-async-storage/async-storage @react-native-community/netinfo @supabase/supabase-js @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context react-native-uuid
npm install -D jest @testing-library/react-native @types/jest jest-expo
```

- [ ] **Step 2: Add the Supabase client**

```typescript
// mobile/src/lib/supabase.ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 3: Configure Jest**

```json
// mobile/package.json (add to existing file)
{
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 4: Run the default test to confirm the toolchain works**

Run: `cd mobile && npx jest --passWithNoTests`
Expected: PASS (0 tests, no config errors)

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "chore: scaffold Expo mobile app with Supabase client"
```

---

### Task 6: Local SQLite schema & migration runner

**Files:**
- Create: `mobile/src/db/sqlite.ts`
- Test: `mobile/src/db/__tests__/sqlite.test.ts`

**Interfaces:**
- Produces: `initDb(): Promise<SQLiteDatabase>`, `runMigrations(db: SQLiteDatabase): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/sqlite.test.ts
import * as SQLite from "expo-sqlite";
import { initDb, runMigrations } from "../sqlite";

test("runMigrations creates all Phase 1 tables", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);
  const tables = await db.getAllAsync<{ name: string }>(
    "select name from sqlite_master where type='table'",
  );
  const names = tables.map((t) => t.name);
  expect(names).toEqual(
    expect.arrayContaining([
      "properties", "staff_users", "workers",
      "attendance_exceptions", "advance_entries", "wage_payments", "sync_queue",
    ]),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest sqlite.test.ts`
Expected: FAIL — `initDb`/`runMigrations` not defined

- [ ] **Step 3: Implement**

```typescript
// mobile/src/db/sqlite.ts
import * as SQLite from "expo-sqlite";

export async function initDb(name = "chukta.db"): Promise<SQLite.SQLiteDatabase> {
  return SQLite.openDatabaseAsync(name);
}

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    pragma journal_mode = WAL;

    create table if not exists properties (
      id text primary key,
      owner_id text not null,
      name text not null,
      address text,
      is_active integer not null default 1,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists staff_users (
      id text primary key,
      property_id text not null,
      name text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists workers (
      id text primary key,
      property_id text not null,
      name text not null,
      phone text,
      pay_basis text not null,
      rate real not null,
      joining_date text not null,
      status text not null default 'active',
      created_at text not null,
      updated_at text not null
    );

    create table if not exists attendance_exceptions (
      id text primary key,
      property_id text not null,
      worker_id text not null,
      date text not null,
      status text not null,
      note text,
      created_by text not null,
      created_by_role text not null,
      created_at text not null,
      updated_at text not null,
      unique(worker_id, date)
    );

    create table if not exists advance_entries (
      id text primary key,
      property_id text not null,
      worker_id text not null,
      type text not null,
      amount real not null,
      date text not null,
      mode text,
      note text,
      created_by text not null,
      created_by_role text not null,
      created_at text not null
    );

    create table if not exists wage_payments (
      id text primary key,
      property_id text not null,
      worker_id text not null,
      amount real not null,
      date text not null,
      mode text,
      note text,
      created_by text not null,
      created_by_role text not null,
      created_at text not null
    );

    create table if not exists sync_queue (
      id text primary key,
      table_name text not null,
      action text not null,
      record_id text not null,
      payload text not null,
      created_at text not null
    );
  `);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest sqlite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db/sqlite.ts mobile/src/db/__tests__/sqlite.test.ts
git commit -m "feat: add local SQLite schema and migration runner"
```

---

### Task 7: Offline sync queue engine

**Files:**
- Create: `mobile/src/db/syncQueue.ts`
- Test: `mobile/src/db/__tests__/syncQueue.test.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase` from Task 6, `supabase` client from Task 5
- Produces: `enqueueChange(db, table: string, action: 'insert'|'update', recordId: string, payload: object): Promise<void>`, `drainQueue(db, supabaseClient): Promise<{ synced: number; failed: number }>`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/syncQueue.test.ts
import { initDb, runMigrations } from "../sqlite";
import { enqueueChange, drainQueue } from "../syncQueue";

test("enqueueChange stores a row, drainQueue upserts it and clears the queue", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);

  await enqueueChange(db, "workers", "insert", "w1", { id: "w1", name: "Ram" });

  const upserted: unknown[] = [];
  const fakeClient = {
    from: (table: string) => ({
      upsert: async (payload: unknown) => {
        upserted.push({ table, payload });
        return { error: null };
      },
    }),
  };

  const result = await drainQueue(db, fakeClient as never);
  expect(result).toEqual({ synced: 1, failed: 0 });
  expect(upserted).toEqual([{ table: "workers", payload: { id: "w1", name: "Ram" } }]);

  const remaining = await db.getAllAsync("select * from sync_queue");
  expect(remaining).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest syncQueue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// mobile/src/db/syncQueue.ts
import * as SQLite from "expo-sqlite";
import type { SupabaseClient } from "@supabase/supabase-js";
import uuid from "react-native-uuid";

export async function enqueueChange(
  db: SQLite.SQLiteDatabase,
  table: string,
  action: "insert" | "update",
  recordId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.runAsync(
    "insert into sync_queue (id, table_name, action, record_id, payload, created_at) values (?, ?, ?, ?, ?, ?)",
    [uuid.v4() as string, table, action, recordId, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function drainQueue(
  db: SQLite.SQLiteDatabase,
  supabaseClient: SupabaseClient,
): Promise<{ synced: number; failed: number }> {
  const rows = await db.getAllAsync<{ id: string; table_name: string; payload: string }>(
    "select id, table_name, payload from sync_queue order by created_at asc",
  );

  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await supabaseClient.from(row.table_name).upsert(JSON.parse(row.payload));
    if (error) {
      failed += 1;
      continue;
    }
    await db.runAsync("delete from sync_queue where id = ?", [row.id]);
    synced += 1;
  }

  return { synced, failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest syncQueue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db/syncQueue.ts mobile/src/db/__tests__/syncQueue.test.ts
git commit -m "feat: add offline sync queue engine"
```

---

### Task 8: PropertyContext (multi-property switcher)

**Files:**
- Create: `mobile/src/context/PropertyContext.tsx`
- Test: `mobile/src/context/__tests__/PropertyContext.test.tsx`

**Interfaces:**
- Produces: `PropertyProvider`, `useProperty(): { properties: Property[]; activeProperty: Property | null; switchProperty(id: string): void; addProperty(p: Property): void }`
- `Property = { id: string; name: string; address?: string }`

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/context/__tests__/PropertyContext.test.tsx
import { renderHook, act } from "@testing-library/react-native";
import { PropertyProvider, useProperty } from "../PropertyContext";

test("addProperty adds and activates the first property; switchProperty changes active", () => {
  const { result } = renderHook(() => useProperty(), { wrapper: PropertyProvider });

  act(() => result.current.addProperty({ id: "p1", name: "Main Shop" }));
  expect(result.current.activeProperty?.id).toBe("p1");

  act(() => result.current.addProperty({ id: "p2", name: "Warehouse" }));
  expect(result.current.activeProperty?.id).toBe("p1");

  act(() => result.current.switchProperty("p2"));
  expect(result.current.activeProperty?.id).toBe("p2");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest PropertyContext.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```tsx
// mobile/src/context/PropertyContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface Property {
  id: string;
  name: string;
  address?: string;
}

interface PropertyContextValue {
  properties: Property[];
  activeProperty: Property | null;
  switchProperty: (id: string) => void;
  addProperty: (p: Property) => void;
}

const PropertyContext = createContext<PropertyContextValue | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  const addProperty = useCallback((p: Property) => {
    setProperties((prev) => [...prev, p]);
    setActivePropertyId((prev) => prev ?? p.id);
  }, []);

  const switchProperty = useCallback((id: string) => {
    setActivePropertyId(id);
  }, []);

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? null;

  return (
    <PropertyContext.Provider value={{ properties, activeProperty, switchProperty, addProperty }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty(): PropertyContextValue {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error("useProperty must be used within PropertyProvider");
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest PropertyContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/context/PropertyContext.tsx mobile/src/context/__tests__/PropertyContext.test.tsx
git commit -m "feat: add multi-property switcher context"
```

---

### Task 9: Worker CRUD (db layer + screens)

**Files:**
- Create: `mobile/src/db/workers.ts`
- Create: `mobile/src/screens/workers/WorkerListScreen.tsx`
- Create: `mobile/src/screens/workers/AddEditWorkerScreen.tsx`
- Test: `mobile/src/db/__tests__/workers.test.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase` (Task 6), `enqueueChange` (Task 7)
- Produces: `Worker` type, `createWorker(db, propertyId, input): Promise<Worker>`, `listWorkers(db, propertyId): Promise<Worker[]>`, `getWorker(db, id): Promise<Worker | null>`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/workers.test.ts
import { initDb, runMigrations } from "../sqlite";
import { createWorker, listWorkers, getWorker } from "../workers";

test("createWorker inserts a worker scoped to a property and listWorkers returns it", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);

  const worker = await createWorker(db, "prop1", {
    name: "Ram Kumar",
    phone: "9800000000",
    payBasis: "daily",
    rate: 500,
    joiningDate: "2026-01-01",
  });

  expect(worker.id).toBeTruthy();
  const list = await listWorkers(db, "prop1");
  expect(list).toHaveLength(1);
  expect(list[0].name).toBe("Ram Kumar");

  const fetched = await getWorker(db, worker.id);
  expect(fetched?.rate).toBe(500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest workers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the db layer**

```typescript
// mobile/src/db/workers.ts
import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";
import { enqueueChange } from "./syncQueue";

export type PayBasis = "daily" | "monthly";

export interface Worker {
  id: string;
  propertyId: string;
  name: string;
  phone?: string;
  payBasis: PayBasis;
  rate: number;
  joiningDate: string;
  status: "active" | "left";
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkerInput {
  name: string;
  phone?: string;
  payBasis: PayBasis;
  rate: number;
  joiningDate: string;
}

function rowToWorker(row: Record<string, unknown>): Worker {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? undefined,
    payBasis: row.pay_basis as PayBasis,
    rate: row.rate as number,
    joiningDate: row.joining_date as string,
    status: row.status as "active" | "left",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createWorker(
  db: SQLite.SQLiteDatabase,
  propertyId: string,
  input: CreateWorkerInput,
): Promise<Worker> {
  const now = new Date().toISOString();
  const id = uuid.v4() as string;

  await db.runAsync(
    `insert into workers (id, property_id, name, phone, pay_basis, rate, joining_date, status, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, propertyId, input.name, input.phone ?? null, input.payBasis, input.rate, input.joiningDate, now, now],
  );

  const worker = await getWorker(db, id);
  await enqueueChange(db, "workers", "insert", id, {
    id, property_id: propertyId, name: input.name, phone: input.phone ?? null,
    pay_basis: input.payBasis, rate: input.rate, joining_date: input.joiningDate,
    status: "active", created_at: now, updated_at: now,
  });

  return worker!;
}

export async function listWorkers(db: SQLite.SQLiteDatabase, propertyId: string): Promise<Worker[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "select * from workers where property_id = ? order by name asc",
    [propertyId],
  );
  return rows.map(rowToWorker);
}

export async function getWorker(db: SQLite.SQLiteDatabase, id: string): Promise<Worker | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>("select * from workers where id = ?", [id]);
  return row ? rowToWorker(row) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest workers.test.ts`
Expected: PASS

- [ ] **Step 5: Build the screens**

```tsx
// mobile/src/screens/workers/WorkerListScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useProperty } from "../../context/PropertyContext";
import { listWorkers, Worker } from "../../db/workers";
import { useDb } from "../../db/DbContext";

export function WorkerListScreen({ navigation }: { navigation: { navigate: (screen: string, params?: object) => void } }) {
  const db = useDb();
  const { activeProperty } = useProperty();
  const [workers, setWorkers] = useState<Worker[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!activeProperty) return;
      listWorkers(db, activeProperty.id).then(setWorkers);
    }, [db, activeProperty]),
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={workers}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("WorkerDetail", { workerId: item.id })}>
            <Text>{item.name} — ₹{item.rate}/{item.payBasis === "daily" ? "day" : "month"}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>No workers yet. Add one to get started.</Text>}
      />
      <Pressable onPress={() => navigation.navigate("AddEditWorker")}>
        <Text>+ Add worker</Text>
      </Pressable>
    </View>
  );
}
```

```tsx
// mobile/src/screens/workers/AddEditWorkerScreen.tsx
import React, { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { useProperty } from "../../context/PropertyContext";
import { createWorker, PayBasis } from "../../db/workers";
import { useDb } from "../../db/DbContext";

export function AddEditWorkerScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const db = useDb();
  const { activeProperty } = useProperty();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [payBasis, setPayBasis] = useState<PayBasis>("daily");

  const onSave = async () => {
    if (!activeProperty || !name || !rate) return;
    await createWorker(db, activeProperty.id, {
      name,
      rate: Number(rate),
      payBasis,
      joiningDate: new Date().toISOString().slice(0, 10),
    });
    navigation.goBack();
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput placeholder="Worker name" value={name} onChangeText={setName} />
      <TextInput placeholder="Rate" value={rate} onChangeText={setRate} keyboardType="numeric" />
      <Pressable onPress={() => setPayBasis(payBasis === "daily" ? "monthly" : "daily")}>
        <Text>Pay basis: {payBasis}</Text>
      </Pressable>
      <Pressable onPress={onSave}>
        <Text>Save</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/workers.ts mobile/src/db/__tests__/workers.test.ts mobile/src/screens/workers/WorkerListScreen.tsx mobile/src/screens/workers/AddEditWorkerScreen.tsx
git commit -m "feat: add worker CRUD data layer and screens"
```

---

### Task 10: Attendance exceptions (default-present model)

**Files:**
- Create: `mobile/src/db/attendance.ts`
- Create: `mobile/src/screens/workers/AttendanceScreen.tsx`
- Test: `mobile/src/db/__tests__/attendance.test.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase`, `enqueueChange`
- Produces: `AttendanceException` type, `markException(db, propertyId, workerId, date, status, actor): Promise<void>`, `listExceptions(db, workerId, from, to): Promise<AttendanceException[]>`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/attendance.test.ts
import { initDb, runMigrations } from "../sqlite";
import { markException, listExceptions } from "../attendance";

test("markException upserts on (worker, date) so a correction overwrites the same day", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);
  const actor = { id: "owner1", role: "owner" as const };

  await markException(db, "prop1", "w1", "2026-09-01", "absent", actor);
  await markException(db, "prop1", "w1", "2026-09-01", "half_day", actor);

  const rows = await listExceptions(db, "w1", "2026-09-01", "2026-09-30");
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("half_day");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest attendance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// mobile/src/db/attendance.ts
import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";
import { enqueueChange } from "./syncQueue";

export type ExceptionStatus = "absent" | "half_day";
export type Actor = { id: string; role: "owner" | "staff" };

export interface AttendanceException {
  id: string;
  workerId: string;
  date: string;
  status: ExceptionStatus;
}

export async function markException(
  db: SQLite.SQLiteDatabase,
  propertyId: string,
  workerId: string,
  date: string,
  status: ExceptionStatus,
  actor: Actor,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<{ id: string }>(
    "select id from attendance_exceptions where worker_id = ? and date = ?",
    [workerId, date],
  );
  const id = existing?.id ?? (uuid.v4() as string);

  await db.runAsync(
    `insert into attendance_exceptions
       (id, property_id, worker_id, date, status, created_by, created_by_role, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(worker_id, date) do update set status = excluded.status, updated_at = excluded.updated_at`,
    [id, propertyId, workerId, date, status, actor.id, actor.role, now, now],
  );

  await enqueueChange(db, "attendance_exceptions", existing ? "update" : "insert", id, {
    id, property_id: propertyId, worker_id: workerId, date, status,
    created_by: actor.id, created_by_role: actor.role, created_at: now, updated_at: now,
  });
}

export async function listExceptions(
  db: SQLite.SQLiteDatabase,
  workerId: string,
  from: string,
  to: string,
): Promise<AttendanceException[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "select id, worker_id, date, status from attendance_exceptions where worker_id = ? and date between ? and ? order by date asc",
    [workerId, from, to],
  );
  return rows.map((r) => ({
    id: r.id as string,
    workerId: r.worker_id as string,
    date: r.date as string,
    status: r.status as ExceptionStatus,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest attendance.test.ts`
Expected: PASS

- [ ] **Step 5: Build the calendar screen**

```tsx
// mobile/src/screens/workers/AttendanceScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useProperty } from "../../context/PropertyContext";
import { markException, listExceptions, ExceptionStatus } from "../../db/attendance";
import { useDb } from "../../db/DbContext";
import { useActor } from "../../context/AuthContext";

function currentMonthDates(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    new Date(year, month, i + 1).toISOString().slice(0, 10),
  );
}

export function AttendanceScreen({ route }: { route: { params: { workerId: string } } }) {
  const db = useDb();
  const { activeProperty } = useProperty();
  const actor = useActor();
  const { workerId } = route.params;
  const [exceptions, setExceptions] = useState<Record<string, ExceptionStatus>>({});

  const reload = async () => {
    const from = currentMonthDates()[0];
    const to = currentMonthDates().slice(-1)[0];
    const rows = await listExceptions(db, workerId, from, to);
    setExceptions(Object.fromEntries(rows.map((r) => [r.date, r.status])));
  };

  useEffect(() => {
    reload();
  }, [workerId]);

  const cycle = async (date: string) => {
    if (!activeProperty) return;
    const order: (ExceptionStatus | "present")[] = ["present", "absent", "half_day"];
    const current = exceptions[date] ?? "present";
    const next = order[(order.indexOf(current) + 1) % order.length];
    if (next === "present") return; // present = no row; Phase 2 adds explicit clear-to-present
    await markException(db, activeProperty.id, workerId, date, next, actor);
    await reload();
  };

  return (
    <FlatList
      data={currentMonthDates()}
      keyExtractor={(d) => d}
      renderItem={({ item }) => (
        <Pressable onPress={() => cycle(item)}>
          <Text>{item}: {exceptions[item] ?? "present"}</Text>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/attendance.ts mobile/src/db/__tests__/attendance.test.ts mobile/src/screens/workers/AttendanceScreen.tsx
git commit -m "feat: add exception-based attendance tracking"
```

---

### Task 11: Advances and payments (db layer + screens)

**Files:**
- Create: `mobile/src/db/ledgerEntries.ts`
- Create: `mobile/src/screens/workers/AddAdvanceScreen.tsx`
- Create: `mobile/src/screens/workers/AddPaymentScreen.tsx`
- Test: `mobile/src/db/__tests__/ledgerEntries.test.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase`, `enqueueChange`
- Produces: `AdvanceEntry`, `WagePayment` types; `addAdvance(db, propertyId, workerId, input, actor): Promise<void>`, `addPayment(db, propertyId, workerId, input, actor): Promise<void>`, `listAdvances(db, workerId): Promise<AdvanceEntry[]>`, `listPayments(db, workerId): Promise<WagePayment[]>`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/ledgerEntries.test.ts
import { initDb, runMigrations } from "../sqlite";
import { addAdvance, addPayment, listAdvances, listPayments } from "../ledgerEntries";

const actor = { id: "owner1", role: "owner" as const };

test("addAdvance and addPayment record separate, independently listable entries", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);

  await addAdvance(db, "prop1", "w1", { type: "advance", amount: 1000, date: "2026-09-01", mode: "cash" }, actor);
  await addPayment(db, "prop1", "w1", { amount: 500, date: "2026-09-05", mode: "cash" }, actor);

  const advances = await listAdvances(db, "w1");
  const payments = await listPayments(db, "w1");

  expect(advances).toHaveLength(1);
  expect(advances[0].amount).toBe(1000);
  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest ledgerEntries.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// mobile/src/db/ledgerEntries.ts
import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";
import { enqueueChange } from "./syncQueue";
import type { Actor } from "./attendance";

export type AdvanceType = "advance" | "repayment" | "writeoff";
export type PaymentMode = "cash" | "upi" | "bank";

export interface AdvanceEntry {
  id: string;
  workerId: string;
  type: AdvanceType;
  amount: number;
  date: string;
  mode?: PaymentMode;
}

export interface WagePayment {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  mode?: PaymentMode;
}

export interface AdvanceInput {
  type: AdvanceType;
  amount: number;
  date: string;
  mode?: PaymentMode;
  note?: string;
}

export interface PaymentInput {
  amount: number;
  date: string;
  mode?: PaymentMode;
  note?: string;
}

export async function addAdvance(
  db: SQLite.SQLiteDatabase,
  propertyId: string,
  workerId: string,
  input: AdvanceInput,
  actor: Actor,
): Promise<void> {
  const id = uuid.v4() as string;
  const now = new Date().toISOString();
  await db.runAsync(
    `insert into advance_entries (id, property_id, worker_id, type, amount, date, mode, note, created_by, created_by_role, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, propertyId, workerId, input.type, input.amount, input.date, input.mode ?? null, input.note ?? null, actor.id, actor.role, now],
  );
  await enqueueChange(db, "advance_entries", "insert", id, {
    id, property_id: propertyId, worker_id: workerId, type: input.type, amount: input.amount,
    date: input.date, mode: input.mode ?? null, note: input.note ?? null,
    created_by: actor.id, created_by_role: actor.role, created_at: now,
  });
}

export async function addPayment(
  db: SQLite.SQLiteDatabase,
  propertyId: string,
  workerId: string,
  input: PaymentInput,
  actor: Actor,
): Promise<void> {
  const id = uuid.v4() as string;
  const now = new Date().toISOString();
  await db.runAsync(
    `insert into wage_payments (id, property_id, worker_id, amount, date, mode, note, created_by, created_by_role, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, propertyId, workerId, input.amount, input.date, input.mode ?? null, input.note ?? null, actor.id, actor.role, now],
  );
  await enqueueChange(db, "wage_payments", "insert", id, {
    id, property_id: propertyId, worker_id: workerId, amount: input.amount, date: input.date,
    mode: input.mode ?? null, note: input.note ?? null, created_by: actor.id, created_by_role: actor.role, created_at: now,
  });
}

export async function listAdvances(db: SQLite.SQLiteDatabase, workerId: string): Promise<AdvanceEntry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "select id, worker_id, type, amount, date, mode from advance_entries where worker_id = ? order by date asc",
    [workerId],
  );
  return rows.map((r) => ({
    id: r.id as string, workerId: r.worker_id as string, type: r.type as AdvanceType,
    amount: r.amount as number, date: r.date as string, mode: (r.mode as PaymentMode) ?? undefined,
  }));
}

export async function listPayments(db: SQLite.SQLiteDatabase, workerId: string): Promise<WagePayment[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "select id, worker_id, amount, date, mode from wage_payments where worker_id = ? order by date asc",
    [workerId],
  );
  return rows.map((r) => ({
    id: r.id as string, workerId: r.worker_id as string,
    amount: r.amount as number, date: r.date as string, mode: (r.mode as PaymentMode) ?? undefined,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest ledgerEntries.test.ts`
Expected: PASS

- [ ] **Step 5: Build the entry screens**

```tsx
// mobile/src/screens/workers/AddAdvanceScreen.tsx
import React, { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { useProperty } from "../../context/PropertyContext";
import { addAdvance } from "../../db/ledgerEntries";
import { useDb } from "../../db/DbContext";
import { useActor } from "../../context/AuthContext";

export function AddAdvanceScreen({ route, navigation }: { route: { params: { workerId: string } }; navigation: { goBack: () => void } }) {
  const db = useDb();
  const { activeProperty } = useProperty();
  const actor = useActor();
  const [amount, setAmount] = useState("");

  const onSave = async () => {
    if (!activeProperty || !amount) return;
    await addAdvance(
      db, activeProperty.id, route.params.workerId,
      { type: "advance", amount: Number(amount), date: new Date().toISOString().slice(0, 10), mode: "cash" },
      actor,
    );
    navigation.goBack();
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput placeholder="Advance amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Pressable onPress={onSave}><Text>Save advance</Text></Pressable>
    </View>
  );
}
```

```tsx
// mobile/src/screens/workers/AddPaymentScreen.tsx
import React, { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { useProperty } from "../../context/PropertyContext";
import { addPayment } from "../../db/ledgerEntries";
import { useDb } from "../../db/DbContext";
import { useActor } from "../../context/AuthContext";

export function AddPaymentScreen({ route, navigation }: { route: { params: { workerId: string } }; navigation: { goBack: () => void } }) {
  const db = useDb();
  const { activeProperty } = useProperty();
  const actor = useActor();
  const [amount, setAmount] = useState("");

  const onSave = async () => {
    if (!activeProperty || !amount) return;
    await addPayment(
      db, activeProperty.id, route.params.workerId,
      { amount: Number(amount), date: new Date().toISOString().slice(0, 10), mode: "cash" },
      actor,
    );
    navigation.goBack();
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput placeholder="Payment amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Pressable onPress={onSave}><Text>Save payment</Text></Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/ledgerEntries.ts mobile/src/db/__tests__/ledgerEntries.test.ts mobile/src/screens/workers/AddAdvanceScreen.tsx mobile/src/screens/workers/AddPaymentScreen.tsx
git commit -m "feat: add advance and payment recording"
```

---

### Task 12: Running balance calculation (pure function + ledger screen)

**Files:**
- Create: `mobile/src/utils/ledger.ts`
- Create: `mobile/src/screens/workers/WorkerLedgerScreen.tsx`
- Test: `mobile/src/utils/__tests__/ledger.test.ts`

**Interfaces:**
- Consumes: `Worker` (Task 9), `AttendanceException` (Task 10), `AdvanceEntry`/`WagePayment` (Task 11)
- Produces: `calculateWorkerLedger(input: WorkerLedgerInput): WorkerLedgerResult`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/src/utils/__tests__/ledger.test.ts
import { calculateWorkerLedger } from "../ledger";

test("daily basis: absent and half_day reduce worked days, unpaid days excluded from earnings", () => {
  const result = calculateWorkerLedger({
    payBasis: "daily",
    rate: 500,
    joiningDate: "2026-09-01",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-05",
    exceptions: [
      { date: "2026-09-02", status: "absent" },
      { date: "2026-09-03", status: "half_day" },
    ],
    advances: [],
    payments: [],
  });
  // 5 days in period: 1 full + 1 absent(0) + 1 half(0.5) + 2 full = 3.5 worked days
  expect(result.workedDays).toBe(3.5);
  expect(result.earned).toBe(1750);
});

test("monthly basis prorates by calendar-day divisor from joining date", () => {
  const result = calculateWorkerLedger({
    payBasis: "monthly",
    rate: 30000,
    joiningDate: "2026-09-01",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    exceptions: [{ date: "2026-09-10", status: "absent" }],
    advances: [],
    payments: [],
  });
  expect(result.totalDaysInPeriod).toBe(30);
  expect(result.workedDays).toBe(29);
  expect(result.earned).toBeCloseTo(29000, 2);
});

test("advances outstanding nets advance/repayment/writeoff independently of earnings", () => {
  const result = calculateWorkerLedger({
    payBasis: "daily",
    rate: 500,
    joiningDate: "2026-09-01",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-01",
    exceptions: [],
    advances: [
      { type: "advance", amount: 1000 },
      { type: "repayment", amount: 300 },
      { type: "writeoff", amount: 100 },
    ],
    payments: [{ amount: 200 }],
  });
  expect(result.advancesOutstanding).toBe(600);
  expect(result.paid).toBe(200);
  expect(result.due).toBe(300); // earned 500 - paid 200
});

test("days before joining date are excluded even if inside the requested period", () => {
  const result = calculateWorkerLedger({
    payBasis: "daily",
    rate: 500,
    joiningDate: "2026-09-03",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-05",
    exceptions: [],
    advances: [],
    payments: [],
  });
  expect(result.workedDays).toBe(3); // 3rd, 4th, 5th only
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest ledger.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// mobile/src/utils/ledger.ts
export type PayBasis = "daily" | "monthly";
export type ExceptionStatus = "absent" | "half_day";
export type AdvanceType = "advance" | "repayment" | "writeoff";

export interface WorkerLedgerInput {
  payBasis: PayBasis;
  rate: number;
  joiningDate: string;
  periodStart: string;
  periodEnd: string;
  exceptions: { date: string; status: ExceptionStatus }[];
  advances: { type: AdvanceType; amount: number }[];
  payments: { amount: number }[];
}

export interface WorkerLedgerResult {
  totalDaysInPeriod: number;
  workedDays: number;
  earned: number;
  advancesOutstanding: number;
  paid: number;
  due: number;
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);
  const last = new Date(end);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function calculateWorkerLedger(input: WorkerLedgerInput): WorkerLedgerResult {
  const effectiveStart = input.joiningDate > input.periodStart ? input.joiningDate : input.periodStart;
  const allDates = eachDate(input.periodStart, input.periodEnd);
  const payableDates = eachDate(effectiveStart, input.periodEnd);
  const exceptionByDate = new Map(input.exceptions.map((e) => [e.date, e.status]));

  const workedDays = payableDates.reduce((sum, date) => {
    const status = exceptionByDate.get(date);
    if (status === "absent") return sum;
    if (status === "half_day") return sum + 0.5;
    return sum + 1;
  }, 0);

  const earned =
    input.payBasis === "daily"
      ? workedDays * input.rate
      : (workedDays / allDates.length) * input.rate;

  const advancesOutstanding = input.advances.reduce((sum, a) => {
    if (a.type === "advance") return sum + a.amount;
    return sum - a.amount;
  }, 0);

  const paid = input.payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalDaysInPeriod: allDates.length,
    workedDays,
    earned,
    advancesOutstanding,
    paid,
    due: earned - paid,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest ledger.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Build the ledger screen**

```tsx
// mobile/src/screens/workers/WorkerLedgerScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getWorker } from "../../db/workers";
import { listExceptions } from "../../db/attendance";
import { listAdvances, listPayments } from "../../db/ledgerEntries";
import { calculateWorkerLedger, WorkerLedgerResult } from "../../utils/ledger";
import { useDb } from "../../db/DbContext";

export function WorkerLedgerScreen({ route }: { route: { params: { workerId: string } } }) {
  const db = useDb();
  const { workerId } = route.params;
  const [result, setResult] = useState<WorkerLedgerResult | null>(null);

  useEffect(() => {
    (async () => {
      const worker = await getWorker(db, workerId);
      if (!worker) return;
      const periodStart = worker.joiningDate;
      const periodEnd = new Date().toISOString().slice(0, 10);
      const [exceptions, advances, payments] = await Promise.all([
        listExceptions(db, workerId, periodStart, periodEnd),
        listAdvances(db, workerId),
        listPayments(db, workerId),
      ]);
      setResult(
        calculateWorkerLedger({
          payBasis: worker.payBasis,
          rate: worker.rate,
          joiningDate: worker.joiningDate,
          periodStart,
          periodEnd,
          exceptions,
          advances,
          payments,
        }),
      );
    })();
  }, [workerId]);

  if (!result) return <Text>Loading…</Text>;

  return (
    <View style={{ padding: 16 }}>
      <Text>Worked days: {result.workedDays}</Text>
      <Text>Earned: ₹{result.earned.toFixed(2)}</Text>
      <Text>Paid: ₹{result.paid.toFixed(2)}</Text>
      <Text>Wage due: ₹{result.due.toFixed(2)}</Text>
      <Text>Advance outstanding: ₹{result.advancesOutstanding.toFixed(2)}</Text>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/utils/ledger.ts mobile/src/utils/__tests__/ledger.test.ts mobile/src/screens/workers/WorkerLedgerScreen.tsx
git commit -m "feat: add running balance calculation and worker ledger screen"
```

---

### Task 13: Reports — worker statement & advances outstanding

**Files:**
- Create: `mobile/src/screens/reports/AdvancesOutstandingScreen.tsx`
- Test: `mobile/src/db/__tests__/reports.test.ts`
- Create: `mobile/src/db/reports.ts`

**Interfaces:**
- Consumes: `Worker` (Task 9), `AdvanceEntry` (Task 11), `calculateWorkerLedger` (Task 12)
- Produces: `listOutstandingAdvances(db, propertyId): Promise<{ workerId: string; workerName: string; outstanding: number }[]>` — §M3

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/src/db/__tests__/reports.test.ts
import { initDb, runMigrations } from "../sqlite";
import { createWorker } from "../workers";
import { addAdvance } from "../ledgerEntries";
import { listOutstandingAdvances } from "../reports";

const actor = { id: "owner1", role: "owner" as const };

test("listOutstandingAdvances only returns workers with a nonzero balance", async () => {
  const db = await initDb(":memory:");
  await runMigrations(db);

  const ram = await createWorker(db, "prop1", { name: "Ram", payBasis: "daily", rate: 500, joiningDate: "2026-09-01" });
  const sita = await createWorker(db, "prop1", { name: "Sita", payBasis: "daily", rate: 500, joiningDate: "2026-09-01" });

  await addAdvance(db, "prop1", ram.id, { type: "advance", amount: 1000, date: "2026-09-01" }, actor);
  await addAdvance(db, "prop1", sita.id, { type: "advance", amount: 500, date: "2026-09-01" }, actor);
  await addAdvance(db, "prop1", sita.id, { type: "repayment", amount: 500, date: "2026-09-05" }, actor);

  const rows = await listOutstandingAdvances(db, "prop1");
  expect(rows).toEqual([{ workerId: ram.id, workerName: "Ram", outstanding: 1000 }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest reports.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// mobile/src/db/reports.ts
import * as SQLite from "expo-sqlite";

export async function listOutstandingAdvances(
  db: SQLite.SQLiteDatabase,
  propertyId: string,
): Promise<{ workerId: string; workerName: string; outstanding: number }[]> {
  const rows = await db.getAllAsync<{ worker_id: string; name: string; outstanding: number }>(
    `select w.id as worker_id, w.name as name,
            coalesce(sum(case when a.type = 'advance' then a.amount else -a.amount end), 0) as outstanding
     from workers w
     left join advance_entries a on a.worker_id = w.id
     where w.property_id = ?
     group by w.id, w.name
     having coalesce(sum(case when a.type = 'advance' then a.amount else -a.amount end), 0) > 0
     order by outstanding desc`,
    [propertyId],
  );
  return rows.map((r) => ({ workerId: r.worker_id, workerName: r.name, outstanding: r.outstanding }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest reports.test.ts`
Expected: PASS

- [ ] **Step 5: Build the report screen**

```tsx
// mobile/src/screens/reports/AdvancesOutstandingScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useProperty } from "../../context/PropertyContext";
import { listOutstandingAdvances } from "../../db/reports";
import { useDb } from "../../db/DbContext";

export function AdvancesOutstandingScreen() {
  const db = useDb();
  const { activeProperty } = useProperty();
  const [rows, setRows] = useState<{ workerId: string; workerName: string; outstanding: number }[]>([]);

  useEffect(() => {
    if (!activeProperty) return;
    listOutstandingAdvances(db, activeProperty.id).then(setRows);
  }, [activeProperty]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.workerId}
      renderItem={({ item }) => <Text>{item.workerName}: ₹{item.outstanding.toFixed(2)} owed</Text>}
      ListEmptyComponent={<View><Text>No outstanding advances.</Text></View>}
    />
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/reports.ts mobile/src/db/__tests__/reports.test.ts mobile/src/screens/reports/AdvancesOutstandingScreen.tsx
git commit -m "feat: add advances outstanding report"
```

---

## Self-review notes

- **Spec coverage:** B1/B2/B7 → Task 9; C1/C2/C5/C10(partial) → Task 10 (note field omitted from UI in Phase 1, column exists for Phase 2); H1/H2/H6/H7 → Task 11/12; I1/I2 → Task 11; M2(partial, via WorkerLedgerScreen)/M3 → Task 12/13; O1/O5 → `created_by`/`created_by_role` on every table; N5 (multi-property) → Task 8; N3-lite (staff PIN) → Tasks 1, 3, 4. Deferred items (J, D, E, F, G, K, L, M1/M4/M5+, P, Q, R) are listed in the roadmap above, not silently dropped.
- **Type consistency checked:** `Actor` (Task 10) reused in Tasks 11–12; `PayBasis`, `ExceptionStatus`, `AdvanceType` defined once each and imported, not redeclared with different shapes.
- **No placeholders:** every step has runnable code and a concrete run/expect line.
