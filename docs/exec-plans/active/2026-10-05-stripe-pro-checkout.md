# Execution Plan: Lifetime Pro via Stripe Payment Link & Signed Unlock Codes

- **Date**: 2026-10-05
- **Status**: In Progress (steps 2–3 done; launch price pending)
- **Owner**: Chris / Claude

## 1. Goal & Objectives

A coach goes from "that looks useful" to "I'm Pro" in under a minute on a phone, with no account to
create and no key to type. Pro then keeps working on a field with no signal, forever.

Success criteria:

- Tap **Unlock Pro**, pay on Stripe's hosted page (Apple Pay, Google Pay, Link, or card), and land back
  in Pinch Hitter already unlocked, with no copy or paste.
- Pro is verified on-device against a bundled public key. It never needs the network again.
- A coach can move Pro to another device or restore it without contacting anyone.
- Free coaches never lose access to data they created.
- Live practice is never interrupted by an upsell (pro-tier-strategy §3.1).

## 2. Context & Decisions

### 2.1 Decided

| Topic             | Decision                                                                                                                                                                                           |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seller            | Oxford Comma Development LLC (one Stripe account).                                                                                                                                                 |
| Buyer             | An individual coach paying out of pocket. Multi-seat or organization licensing is out of scope for v1.                                                                                             |
| Pricing model     | **One-time Lifetime Pro**: every current and future Pro Coach feature. A separate Organization product may exist later.                                                                            |
| Checkout          | **Stripe Payment Link** (hosted) with **Managed Payments** on, so Stripe is merchant of record and handles tax, fraud, disputes, and buyer support. Wallets come from Stripe with no domain setup. |
| Code issuance     | **Option C**: one stateless GCP Cloud Run function signs an unlock code on the success redirect.                                                                                                   |
| Function location | Private repo `Oxford-Comma-Development/pinch-hitter-license`. Secrets live in **GCP Secret Manager**, never in either repo.                                                                        |

### 2.2 Existing foundation

- `src/app/data/entitlement.service.ts` gates features (`canAccess`, `isPro`). It currently defaults to
  Pro for everyone, with a `localStorage` simulator.
- Custom-fence gating and preview are live in `reports.component`. Settings shows the tier and the simulator.
- ADR-008 and pro-tier-strategy §1.2 already chose offline-verifiable Ed25519 license tokens.

### 2.3 Where each value lives

| Value                             | Secret? | Lives in                                                   |
| :-------------------------------- | :-----: | :--------------------------------------------------------- |
| Payment Link URL                  |   No    | `src/app/data/license-config.ts` (committed)               |
| Ed25519 **public** key            |   No    | `src/app/data/license-config.ts` (committed)               |
| Ed25519 **private** key           | **Yes** | GCP Secret Manager, plus an offline backup kept by the LLC |
| Stripe restricted key `rk_live_…` | **Yes** | GCP Secret Manager                                         |

The restricted key needs read access only: Checkout Sessions and Customers. No GitHub repository
secrets are required unless the function deploy is later automated.

### 2.4 License scope

Decided: **per coach, not per device.** Codes carry the licensee's name, which is shown in Settings.
v1 has no activation limit. Device binding was considered and deferred; see §6.

## 3. Proposed Changes

### 3.1 Flow

```
App: Unlock Pro ──▶ Stripe Payment Link (hosted, Managed Payments, Link/wallets/card)
                        │ success_url = <app>/#/activate?session_id={CHECKOUT_SESSION_ID}
                        ▼
App /activate ── POST {sessionId} ──▶ GCP function: retrieve session, assert paid,
                                       sign {v, lic, name, iat, kid}  (no coaching data)
              ◀── unlock code ────────
App verifies signature locally ──▶ IndexedDB `license` store ──▶ isPro() ──▶ "✦ You're Pro, Coach."
```

- The function is idempotent. The same `session_id` always mints an equivalent code, so the activate
  link doubles as a **permanent restore link**.
- The success page offers **"Email this to myself"**. This is a `mailto:` link prefilled with the
  restore link: zero server, and the buyer's own inbox becomes the backup.
- Codes are delivered as a link, a copy button, and a QR code. They are about 100 characters and are
  never typed.
- The activation link uses the URL fragment (`#`), so codes never reach GitHub Pages logs.
- iOS installed PWA: Stripe returns to Safari, which has separate storage from the installed app. The
  Safari activate page detects this and says "Open Pinch Hitter from your home screen and tap
  _Paste unlock code_". The code is already on the clipboard via the copy button.

### 3.2 Client (`pinch-hitter`)

- `src/app/data/license.ts` (new, pure): decode, Ed25519 verify via `crypto.subtle` (feature-detect,
  with `@noble/ed25519` as fallback), and schema checks. A `kid` field enables key rotation.
- `repository.ts`: add a `license` object store via migration. It is **excluded from JSON backups**.
- `entitlement.service.ts`:
  - Source of truth becomes the verified license.
  - Default flips to free behind a `LICENSING_ENFORCED` constant.
  - Simulator becomes `isDevMode()`-only.
  - Add `activate(code)` and `deactivate()`.
- `activate` route: reads the fragment, calls the function, verifies, stores, and celebrates. It also
  covers the offline, already-active, invalid, and iOS-Safari states.
- Upgrade sheet (TODO-C3): value and price, then one button to the Payment Link. Offline-aware. Never
  shown in live practice.
- Settings license panel shows "Licensed to …", Copy / QR / Email my code, Paste unlock code, and Remove
  from this device.
- Free-tier data safety: teams beyond the free limit become read-only, never hidden. Export always works.
- Local mint script, `npm run mint-code` (reads the private key from a local file, gitignored). Used for
  comp codes, the coach partner, conference demos, and support re-issues.

### 3.3 Function (`pinch-hitter-license`, private)

- Single HTTP handler. `POST /activate {sessionId}` retrieves the session, requires
  `status=complete` and `payment_status=paid`, signs, and returns the code.
- CORS allows only the production origin and localhost.
- Cloud Run settings: `min-instances 0` and **`max-instances 2`** as a hard cost ceiling. Add a GCP
  billing budget alert at $5.
- Pin the Stripe API version. The Node runtime will need an occasional bump when GCP deprecates old
  versions. That is the only maintenance.

### 3.4 Stripe dashboard (owner)

- Test mode first. Create the product "Pinch Hitter Pro (Lifetime)" and a Payment Link with Managed
  Payments on.
- Set the success URL as in §3.1.
- Set the email to required (Stripe needs it for receipts anyway). Collect no phone and no custom fields.
- Collect the coach's name as the licensee name. Either use a custom field (optional, defaulting to the
  card name) or take it from `customer_details.name`.
- Turn on promotion codes so the coach partner can run a conference code.
- Branding: icon and field green `#235d42`. Statement descriptor `PINCHHITTER PRO`.

### 3.5 Docs

- Add a new ADR ("Signed unlock codes minted by a stateless function"). It amends "zero server-side
  runtime": purchase-time only, holds no coaching data.
- Update ARCHITECTURE, pro-tier-strategy (§1.3 and Phase D), ROADMAP (C3, D1, D2), the privacy page,
  and the user manual ("Going Pro", "Moving Pro to another device").
- Add an AGENTS guardrail: never put Stripe secret keys or the signing key in the client or the repo.

## 4. Implementation Steps

- [ ] **Step 1: Owner setup**: Stripe test-mode product and Payment Link; GCP project, Secret Manager,
      and budget alert; create the private repo.
- [x] **Step 2: ADR + code format + keypair** (ADR-011; `k1` generated 2026-10-05): generate the Ed25519 keypair locally and store the private
      key in Secret Manager and an offline backup. Commit the public key.
- [x] **Step 3: `license.ts` verifier + `mint-code` script**, with unit tests for valid, tampered, wrong
      `kid`, malformed, and fallback-crypto cases.
- [ ] **Step 4: IndexedDB `license` store**, with migration and backup-exclusion tests.
- [ ] **Step 5: EntitlementService rewire** behind `LICENSING_ENFORCED`, with the dev-only simulator.
- [ ] **Step 6: Free-tier data safety** (read-only extra teams), with e2e coverage.
- [ ] **Step 7: GCP function**: build, test with a mocked Stripe client, deploy to test mode, and test
      end to end with the Stripe test card.
- [ ] **Step 8: `/activate` route, upgrade sheet, and Settings license panel**, including i18n, 44px
      targets, safe areas, and left-handed mirroring.
- [ ] **Step 9: Service worker check**: `/activate` works from a cached shell. Function responses are never cached.
- [ ] **Step 10: Live switch**: live keys and live Payment Link. Make one real purchase, then refund it.
      Flip `LICENSING_ENFORCED`.

## 5. Verification Plan

- [ ] `npm test -- --watch=false`, `npm run lint`, `npm run format:check`
- [ ] `npm run e2e`: activate with a minted test code; a tampered code is rejected; Pro persists after reload.
- [ ] `npm run e2e:pwa`: activate, go offline, reload, Pro persists.
- [ ] Real devices: iOS Safari, iOS installed PWA (paste flow), Android installed PWA, desktop.
- [ ] Test-mode purchase on the deployed site, including the decline card `4000 0000 0000 0002`.
- [ ] `gitleaks`: no `sk_`, `rk_`, or private-key material in either repo.

## 6. Risks, Ceilings & Rollback

- **Ceiling: client-side checks are bypassable** by editing JavaScript in devtools. This is accepted.
  The goal is effortless purchase for honest coaches, not DRM.
- **Ceiling: no revocation.** A leaked code works until a release ships a small deny-list of `lic` IDs.
  The licensee name in Settings deters casual sharing.
- **Deferred: device-bound licenses.** Browsers have no stable device ID. A generated install ID dies
  when storage is cleared, when iOS evicts it, or when moving between Safari and the installed app.
  Binding would make honest coaches pay twice for the same phone, and would split phone capture from
  laptop review (the core Pro use case). Revisit with an activation count only if sharing is observed.
  Stripe customer metadata could store that count, so no database would be needed.
- **Risk: function outage** blocks new activations only. Existing codes verify offline, and
  `mint-code` is the manual fallback.
- **Rollback**: set `LICENSING_ENFORCED = false` to restore everyone-is-Pro without touching stored
  licenses.
