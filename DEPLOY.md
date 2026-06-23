# Stripe Identity Tester — Deployment Guide

---

## Part 1 — Stripe Account Setup

Complete this section before running the tester locally or deploying to Vercel.

---

### Step 1 — Create / Log In to Your Stripe Account

Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign in or create a free account. No credit card is required to use test mode.

---

### Step 2 — Enable Stripe Identity (Test Mode)

Stripe Identity must be explicitly enabled on your account before you can create VerificationSessions.

1. In the Stripe Dashboard, make sure the **Test mode** toggle (top-right) is **ON** (the header bar turns orange).
2. Go to **Settings → Identity** — direct link: [dashboard.stripe.com/test/settings/identity](https://dashboard.stripe.com/test/settings/identity)
3. Click **Enable Identity**.
4. Accept the Stripe Identity terms of service.
5. You should see "Identity is enabled" with a green checkmark.

> **Note:** Test mode Identity is enabled independently from live mode. You must repeat step 2 for live mode (step 5 below) when you're ready to go live.

---

### Step 3 — Get Your Test Mode API Keys

1. Go to **Developers → API keys** — direct link: [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. Copy the **Publishable key** (`pk_test_…`) and the **Secret key** (`sk_test_…`).
   - If the secret key is hidden, click **Reveal test key**.
3. Paste them into `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_…
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
   ```

---

### Step 4 — Configure a Test Webhook (Local Dev)

For local development you use the Stripe CLI to forward events instead of a public URL.

1. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows (scoop)
   scoop install stripe

   # Or download from https://github.com/stripe/stripe-cli/releases
   ```
2. Authenticate the CLI with your account:
   ```bash
   stripe login
   ```
3. Start forwarding Identity events to your local server:
   ```bash
   stripe listen \
     --events identity.verification_session.created,identity.verification_session.processing,identity.verification_session.verified,identity.verification_session.requires_input,identity.verification_session.canceled,identity.verification_session.redacted \
     --forward-to localhost:3000/api/webhooks/stripe
   ```
4. The CLI prints a `whsec_…` signing secret. Copy it into `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```

Leave the `stripe listen` process running while you develop. Every Identity event will appear on the `/webhooks` page within a few seconds.

---

### Step 5 — Enable Stripe Identity (Live / Production Mode)

Do this only when you are ready to perform real identity checks on real users.

> ⚠️ **Live mode checks are billable.** Review [Stripe Identity pricing](https://stripe.com/identity#pricing) before enabling.

1. Switch the Stripe Dashboard to **Live mode** (toggle top-right; header turns dark/black).
2. Go to **Settings → Identity** — direct link: [dashboard.stripe.com/settings/identity](https://dashboard.stripe.com/settings/identity)
3. Click **Enable Identity** and accept the live-mode terms of service.
4. Complete **Business verification** if prompted:
   - Stripe may require additional business details (legal name, address, tax ID, website URL, and a description of how you'll use Identity).
   - This is a one-time KYB (Know Your Business) step required before you can verify real end-users.
   - Approval typically takes minutes to a few hours.
5. Once approved, go to **Developers → API keys** (live mode): [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
6. Copy the live **Publishable key** (`pk_live_…`) and **Secret key** (`sk_live_…`).

---

### Step 6 — Configure Branding (Recommended)

Stripe displays your brand inside the Identity modal. Configure it so users see your logo and colors rather than the Stripe defaults.

1. Go to **Settings → Branding**: [dashboard.stripe.com/settings/branding](https://dashboard.stripe.com/settings/branding)
2. Upload your **logo** and **icon**.
3. Set your **brand color** and **accent color**.
4. The modal inherits these settings automatically — no code changes needed.

---

### Step 7 — Review Accepted ID Types (Optional)

By default Stripe accepts driving licenses, passports, and national ID cards. You can restrict this per-session in code (see `allowed_types` in the test suites), or set account-level defaults:

1. Go to **Settings → Identity → Accepted ID types**: [dashboard.stripe.com/test/settings/identity](https://dashboard.stripe.com/test/settings/identity)
2. Toggle the document types you want to allow globally.

---

### Test Mode vs. Live Mode Summary

| | Test Mode | Live Mode |
|---|---|---|
| API key prefix | `sk_test_` / `pk_test_` | `sk_live_` / `pk_live_` |
| Real IDs required | No — use Stripe test documents | Yes — real government-issued IDs |
| Billable | No | Yes |
| Webhooks CLI | `stripe listen` | Public HTTPS endpoint required |
| Enable location | Settings → Identity (test toggle ON) | Settings → Identity (live mode) |
| Business verification | Not required | Required before first real check |
| Dashboard URL | `dashboard.stripe.com/test/…` | `dashboard.stripe.com/…` |

---

## Part 2 — Local Development

```bash
cd stripe-identity-tester
cp .env.example .env.local        # fill in your Stripe keys (from Part 1 above)
npm install
npm run dev                        # http://localhost:3000
```

Webhook forwarding is covered in **Part 1, Step 4** above. Run `stripe listen` in a separate terminal before testing the `/verify` flow.

---

## Part 3 — Deploying to Vercel

### 1. Push to GitHub

```bash
cd stripe-identity-tester
git init
git add .
git commit -m "Initial commit"
gh repo create stripe-identity-tester --private --source=. --push
# or: git remote add origin https://github.com/YOUR_USERNAME/stripe-identity-tester.git && git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and click **Import Git Repository**.
2. Select the `stripe-identity-tester` repo.
3. Framework Preset: **Next.js** (auto-detected).
4. Click **Deploy** — the first deploy will fail because env vars aren't set yet. That's fine.

### 3. Set Environment Variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` | Server-side only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` or `pk_live_…` | Exposed to browser |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From Stripe Dashboard (step 4) |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` | No trailing slash |
| `UPSTASH_REDIS_REST_URL` | (optional) | For webhook event persistence |
| `UPSTASH_REDIS_REST_TOKEN` | (optional) | For webhook event persistence |

After adding vars: **Deployments → Redeploy** (check "Use existing build cache" OFF).

### 4. Register the Webhook Endpoint in Stripe

1. Open [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) (or test mode: [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)).
2. Click **Add endpoint**.
3. Endpoint URL: `https://your-app.vercel.app/api/webhooks/stripe`
4. Select events:
   - `identity.verification_session.created`
   - `identity.verification_session.processing`
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.canceled`
   - `identity.verification_session.redacted`
5. Click **Add endpoint**, then reveal the **Signing secret** (`whsec_…`).
6. Paste it into the `STRIPE_WEBHOOK_SECRET` Vercel env var and redeploy.

### 5. (Optional) Add Upstash Redis for Persistent Webhook Events

Vercel serverless functions are stateless — without Redis, webhook events only persist in memory for the current function invocation. To persist them across requests:

1. In Vercel Marketplace, search **Upstash Redis** and add the integration.
2. Vercel auto-injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Pull them locally: `vercel env pull .env.local`

---

## Part 4 — Verifying Stripe Identity is Enabled

If the **Config & Health** test suite returns `"Stripe Identity is NOT enabled"`:

1. Go to [dashboard.stripe.com/settings/identity](https://dashboard.stripe.com/settings/identity).
2. Enable Identity verification.
3. Accept the terms of service.

In test mode this is usually enabled by default on new Stripe accounts.

---

## Part 5 — Pages & API Reference

| Route | Purpose |
|---|---|
| `/` | API test runner dashboard — run test suites |
| `/verify` | Launch the Stripe Identity modal interactively |
| `/verify/complete` | Return URL after the hosted flow; fetches session status |
| `/webhooks` | Live view of received Identity webhook events |
| `POST /api/identity/session` | Create a VerificationSession |
| `GET /api/identity/session/[id]` | Retrieve a VerificationSession |
| `POST /api/identity/session/[id]` | Cancel or redact (`{ action: "cancel"|"redact" }`) |
| `GET /api/identity/sessions` | List sessions (`?limit=10&status=verified`) |
| `GET /api/identity/reports` | List reports (`?limit=10&session=vs_xxx`) |
| `GET /api/identity/report/[id]` | Retrieve a VerificationReport |
| `POST /api/webhooks/stripe` | Stripe webhook receiver |
| `GET /api/webhooks/events` | JSON list of recent Identity webhook events |

---

## Part 6 — Base44 / DateRealGirls Integration Pattern

To add identity verification to a Base44 app (e.g., DateRealGirls):

### Backend (Base44 custom action)

```javascript
// Custom action: "createVerificationSession"
// Call your deployed tester or replicate this logic in Base44's backend:
const session = await stripe.identity.verificationSessions.create({
  type: "document",
  options: {
    document: {
      allowed_types: ["driving_license", "passport", "id_card"],
      require_matching_selfie: true,
    },
  },
  metadata: { user_id: currentUser.id },
  return_url: `${APP_URL}/verify/complete`,
});
// Save session.id → currentUser.stripe_verification_session_id
// Return session.client_secret to the frontend
```

### Frontend (Base44 page / component)

```html
<!-- Load Stripe.js once -->
<script src="https://js.stripe.com/v3/"></script>

<script>
  async function startVerification() {
    // 1. Call your backend action to get a client_secret
    const { client_secret } = await callBackendAction("createVerificationSession");

    // 2. Open the Stripe Identity modal
    const stripe = Stripe("pk_live_…");   // your publishable key
    const { error } = await stripe.verifyIdentity(client_secret);

    if (error) {
      alert("Verification failed: " + error.message);
    }
    // On success, Stripe redirects to return_url
  }
</script>
<button onclick="startVerification()">Verify My Identity</button>
```

### Webhook handler (mark member as verified)

```javascript
// Base44 webhook handler OR your own Next.js /api/webhooks/stripe route:
if (event.type === "identity.verification_session.verified") {
  const session = event.data.object;
  const userId  = session.metadata.user_id;
  // Update member record: verified = true, verified_at = now()
  await db.users.update({ id: userId, identity_verified: true });
}
if (event.type === "identity.verification_session.requires_input") {
  // Notify member their check needs attention
}
```

### Member verification status check

Before allowing access to age-restricted features, check:

```javascript
if (!currentUser.identity_verified) {
  redirect("/verify");   // prompt them to complete verification
}
```

---

## Part 7 — Test Mode Documents

Use Stripe's [test identity documents](https://docs.stripe.com/identity/test-mode) to simulate different outcomes without real IDs:

| Document number | Simulated result |
|---|---|
| `000000000` | Verified |
| `000000001` | Consent declined |
| `000000002` | Document unverified |
| `000000003` | Selfie unverified |

Upload the [test document images](https://docs.stripe.com/identity/test-mode#test-files) provided by Stripe in the modal.
