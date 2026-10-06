# Execution Plan: Lifetime Pro via Stripe Checkout & Signed Unlock Codes

- **Date**: 2026-10-05
- **Status**: In Progress. Code complete; waiting on deployment and go-live (steps 10–12).
- **Owner**: Chris / Claude

## 1. Goal & Objectives

A coach goes from "that looks useful" to "I'm Pro" in under a minute on a phone, with no account and no key to type. After that, Pro keeps working on a field with no signal, forever.

- Tap **Unlock Pro**, pay on Stripe's hosted checkout (Apple Pay, Google Pay, Link, or card), and land back in Pinch Hitter already unlocked.
- Pro is verified on the device against a bundled public key and never needs the network again.
- A coach can move Pro to another device or restore it without contacting anyone.
- Free coaches never lose access to data they created, and live practice never shows an upsell.

## 2. Decisions

| Topic          | Decision                                                                                                                                                                                          |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seller         | Oxford Comma Development LLC (one Stripe account).                                                                                                                                                |
| Buyer          | Individual coach paying out of pocket. Multi-seat and organization licensing come later.                                                                                                          |
| Pricing        | One-time **Lifetime Pro**, covering every current and future Pro Coach feature. The price is still being decided with the coach partner (`PRO_PRICE_LABEL`).                                      |
| Checkout       | Stripe **hosted** Checkout Session, created by the license function with the Checkout Studio parameters. (This replaced the earlier Payment Link idea when the owner configured Checkout Studio.) |
| Code issuance  | A stateless GCP Cloud Run function in the private repo `Oxford-Comma-Development/pinch-hitter-license`. No database and no webhook.                                                               |
| License scope  | **Per coach, not per device.** The licensee name is shown in Settings.                                                                                                                            |
| Grandfathering | None. Everyone becomes free at launch (owner decision 2026-10-05). Existing teams stay usable.                                                                                                    |

## 3. Flow

```
App upgrade sheet ── POST /checkout {appUrl} ──▶ function: checkout.sessions.create(hosted_page)
                  ◀── { url } ─────────────────
location = Stripe hosted checkout ──▶ success_url <app>/activate?session_id={CHECKOUT_SESSION_ID}
/activate ── POST /activate {sessionId} ──▶ function: retrieve session, paid and our price? sign
          ◀── { code: "PH1.…" } ───────────
verify offline ▶ IndexedDB metadata `license` ▶ isPro() ▶ "You're Pro, Coach." ▶ keep-your-code
```

## 4. Implementation Steps

- [x] **Step 1: Private repo**: `Oxford-Comma-Development/pinch-hitter-license` was created and pushed. It contains the function, tests, and `STRIPE_INTEGRATION_TODO.md`.
- [x] **Step 2: ADR-011, code format, keypair**: `k1` was generated 2026-10-05 into `~/.pinch-hitter-license/` (outside the repo and OneDrive). The public key is committed.
- [x] **Step 3: Verifier and scripts**: `license.ts` (11 unit tests), `npm run license-keygen`, and `npm run mint-code`.
- [x] **Step 4: License storage**: The `metadata` store with `id: "license"`. No migration was needed, and it is never in backups (asserted in e2e).
- [x] **Step 5: EntitlementService**: Free by default, a dev-only simulator, and the `LICENSING_ENFORCED` rollback. The app shell waits for the license check, so there's no free-tier flash.
- [x] **Step 6: Free-tier data safety**: Creating a second team is Pro. Existing teams, imports, and exports are never blocked.
- [x] **Step 7: Function**: `/checkout` and `/activate`, with 8 tests. A code minted by the function was cross-verified with the app's verifier.
- [x] **Step 8: UI**: Upgrade sheet, `/activate`, the Settings license card, copy/email/share, the iOS Safari tip, and en/es strings.
- [x] **Step 9: Pro features**: Compare hitters, trend curves, enriched CSV, and scout cards. Free coaches preview Compare and Trends on sample data.
- [ ] **Step 10: Deploy the function** (owner): Follow `STRIPE_INTEGRATION_TODO.md` → Deploy. Then set `LICENSE_FUNCTION_URL` and `PRO_PRICE_LABEL` in `license-config.ts`.
- [ ] **Step 11: Test-mode purchase on the deployed site**: Test with `4242…`, 3DS `4000 0027 6000 3184`, and decline `4000 0000 0000 0002`. Also test the installed iOS PWA paste flow.
- [ ] **Step 12: Go live**: Live keys and price, one real purchase plus a refund, and an offline backup of `k1.private.jwk`. Then move this plan to `completed/`.

## 5. Verification (current)

- [x] `npm test -- --watch=false`: 112 passed
- [x] `npm run lint`, `npm run format:check`
- [x] `npm run e2e`: 109 passed, 1 skipped (pre-existing), across 5 viewports
- [x] `npm run build` and `npm run e2e:pwa`: offline notebook, plus production rejecting dev-key codes and hiding the simulator
- [x] Real browser (phone portrait): free card, upgrade sheet, activation link, and reload persistence
- [ ] Real devices against the deployed function (step 11)

## 6. Risks, Ceilings & Rollback

- **Ceiling: client-side checks are bypassable** in devtools. This is accepted: the goal is effortless purchase for honest coaches, not DRM.
- **Ceiling: no remote revocation.** A leaked code works until its `lic` ships in `REVOKED_LICENSES`.
- **Ceiling: Stripe's card fields can't be customised.** Auto-advance, wallets, and validation are Stripe's. Our levers are fewer fields, no lost context, instant unlock, and plain-language errors.
- **Deferred**: Defensive shift zones (B4); heatmap and radar on scout cards; launch-angle and exit-velocity bands. Those bands can't be derived honestly without radar data.
- **Risk: function outage** blocks new activations only. Existing codes verify offline, and `mint-code` is the manual fallback.
- **Rollback**: Set `LICENSING_ENFORCED = false` to restore everyone-is-Pro without touching stored licenses.
