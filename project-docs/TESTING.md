# Unit testing strategy

Logic-first Vitest suite. Do **not** chase coverage of every app page.

## Pyramid

1. **Unit (majority)** — pure functions in `packages/api`, `packages/utils`, `packages/ui`, and app `lib/` helpers  
2. **Component** — interactive shared UI when behavior is non-trivial  
3. **Screen smoke** — critical Customer/Partner route files exist + key UX contracts (source checks; full mount later)  
4. **E2E** — manual UAT guides in this folder; automation optional later  

## Commands

```bash
# All unit + smoke tests
npm test

# Watch mode
npm run test:watch

# Full workspace coverage report (no hard gate)
npm run test:coverage

# Soft gate: high-value packages/api modules must stay ≥ ~40% statements
npm run test:coverage:api
```

## Soft coverage gate (`packages/api`)

`packages/api/vitest.config.ts` includes only targeted modules (`razorpay-errors` / `razorpay-status`, GST + capacity pricing, launch-area helpers, vendor intake + fallback, AMC eligibility / generation / display). CI fails if that scoped coverage drops below **40% statements/lines** (functions 30%, branches 25%).

Raise thresholds as more tests land. Do not gate the entire monorepo % yet.

## Colocation

- `*.test.ts` next to the module under test  
- `*.smoke.test.ts` under `apps/*/lib/` for critical screen contracts  

## Anti-goals

- Snapshot-testing every Expo Router / Vite page  
- Live Supabase or Razorpay in unit tests  
- Blocking releases until “all pages” have tests  

## Related

- [MOBILE-STRESS.md](MOBILE-STRESS.md) — UAT-only k6 API + Maestro device stress (not part of the Vitest CI gate)  

