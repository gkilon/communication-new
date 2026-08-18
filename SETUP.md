# Parallel build — Phase 1 + Phase 2

This is a separate copy of communication-styles-tool. The live app at
communication.kilon-consulting.com was not touched.

## What changed and why

**Phase 1 — Security**
- Removed the shared hardcoded password ("inspire") entirely. Every user now signs up/logs
  in with real Firebase Auth (email/password or Google). No more anonymous localStorage-only
  access.
- Removed the hardcoded admin-email backdoor in App.tsx (`admin@manager.com`,
  `gilad@kilon.org`). Admin status now comes only from the `role` field on the user's
  Firestore doc, and `firestore.rules` enforces that server-side.
- Added `firestore.rules` — every user, team, and org document is scoped to `orgId`, and only
  an admin of that same org can read other members' data. Deploy with:
  `firebase deploy --only firestore:rules` (needs `firebase-tools` and a project pointed at
  your Firebase project).
- Added server-side auth verification + a monthly per-org usage cap on the AI endpoint
  (`netlify/functions/gemini.ts`), using the Firebase Admin SDK. Requests without a valid
  Firebase ID token, or from an org that's hit its monthly AI-call limit, are rejected before
  any AI provider is called.

**Phase 2 — Multi-tenant + billing scaffold**
- New `orgId` field is the tenant boundary across users/teams/organizations. Signing up
  either creates a new org (you become its admin) or joins one via an invite link
  (`?org=<orgId>&team=<name>`).
- Admin dashboard now only ever sees its own org's users/teams — the old `getAllUsers()`
  (global, no scoping) is gone.
- Stripe scaffold: `netlify/functions/create-checkout-session.ts` and
  `netlify/functions/stripe-webhook.ts`. These are working skeletons, not wired to real
  pricing yet — see "Still needs your input" below.

## New environment variables needed (Netlify)

| Variable | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Base64-encoded JSON of a Firebase service account key (Project Settings → Service Accounts → Generate new private key, then `base64 -i key.json`). Used by the Netlify functions to verify ID tokens and read/write Firestore with the Admin SDK. |
| `STRIPE_SECRET_KEY` | From your Stripe dashboard. |
| `STRIPE_WEBHOOK_SECRET` | Generated when you register the webhook endpoint in Stripe. |
| `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_TEAM` | Price IDs for whatever plans you decide on. |
| `SITE_URL` | e.g. `https://communication-new.kilon-consulting.com`, used for Stripe redirect URLs. |

(`GEMINI_API_KEY` / `GROQ_API_KEY` / `VITE_FIREBASE_*` — same as the original app.)

## Still needs your input before this is launch-ready

1. **Pricing/plan tiers** — I put placeholder seat/usage limits (`starter`: 10 seats / 500
   AI calls/mo, `team`: 50 seats / 3000 AI calls/mo) in `stripe-webhook.ts`. You need to
   decide real numbers and create matching Products/Prices in Stripe.
2. **Deploy Firestore rules** — `firestore.rules` is written but not deployed anywhere yet;
   nothing enforces it until you run the deploy command above against your Firebase project.
3. **No "upgrade" UI yet** — the admin dashboard shows the org's current plan/usage but
   there's no button wired to `create-checkout-session` yet. Quick to add once pricing is
   settled.
4. **Existing production data** — if you ever want to migrate real users from the live app
   into this one, they don't have an `orgId` yet and will need a one-time backfill script.

## Not done in this pass (still Phase 3 on the original plan)

- Consolidating the duplicated AI system prompts (streaming vs non-streaming) — untouched.
- PDF/report export.
