# Pore measured beta release checklist

This checklist is the handoff between the local product build and the later
Supabase, authenticated analysis-service, and RevenueCat integrations.

## Product truth

- [ ] Beta is restricted to adults 18 and older.
- [ ] Photo analysis requires an explicit, versioned consent; declining keeps
      the answer-based path available.
- [ ] Results distinguish scan-and-intake from intake-only plans.
- [ ] The initial results, routine, explanations, default reminders, three
      monthly Active Compatibility checks, and first weekly comparison are free.
- [ ] The app never claims a routine caused a visible change.
- [ ] Pore Plus is the only paid plan shown; TestFlight does not charge users.
- [ ] Privacy and Terms links open the current notices on `pore.skin`.

## Automated gates

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm --filter @pore/mobile exec expo install --check`
- [ ] `pnpm audit:copy`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Expo Doctor passes, with the documented VisionCamera peer-dependency risk.

## Physical iPhone matrix

Run the full protocol in `apps/mobile/docs/scan-qa-protocol.md` on at least:

- [ ] Small supported iPhone display.
- [ ] Standard supported iPhone display.
- [ ] Large supported iPhone display.
- [ ] Current iOS and oldest supported iOS.
- [ ] VoiceOver, largest Dynamic Type, Reduce Motion, and reduced-contrast checks.
- [ ] Camera interruption, permission denial, background/foreground recovery,
      poor light, blur, obstruction, wrong pose, retake, upload loss, and retry.

## Measured beta gates

- [ ] 10-20 testers complete assessment, scan, results, and first routine.
- [ ] Onboarding completion is at least 70%.
- [ ] Scan completion is at least 60% and analysis success is at least 95%.
- [ ] Routine view after results is at least 80%.
- [ ] Average clarity rating is at least 4/5.
- [ ] At least 35% of activated users complete three routine check-ins in a week.
- [ ] At least 20% view the first weekly comparison.
- [ ] Median analysis readiness is at most 15 seconds and p95 at most 30 seconds.

## Deferred production integrations

- [ ] Replace local profile/history storage with owned Supabase records and
      private object storage.
- [ ] Add and verify explicit iOS complete file protection and backup exclusion
      for locally retained scan photos before external beta distribution.
- [ ] Authenticate and rate-limit analysis jobs; add idempotency and remote
      deletion.
- [ ] Replace the local analytics outbox with a privacy-reviewed remote sink.
- [ ] Replace beta paywall intent with StoreKit/RevenueCat purchase, restore,
      webhook, grace-period, and entitlement reconciliation flows.
