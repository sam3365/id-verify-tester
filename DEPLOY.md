# Didit Identity Tester — Deployment Guide

## Overview

**Didit** (didit.me) is a pay-per-use identity verification platform with no monthly subscription fee.
- 500 free verifications per feature per month on sandbox
- Live verifications are pay-per-use (no monthly fee)
- Docs: https://docs.didit.me
- Business Console: https://business.didit.me

---

## Part 1 — Didit Account Setup

### 1.1 Create an account

1. Go to https://business.didit.me and sign up.
2. Verify your email.
3. Accept the Terms of Service.

### 1.2 Create a Sandbox Application (for development)

1. In the top-right corner, click **Create Application**.
2. Choose **Sandbox** as the environment.
3. Fill in the application name (e.g. "DateRealGirls - Dev") and your organization details.
4. Submit — your sandbox application is immediately active.

### 1.3 Create a Live Application (for production)

1. Click **Create Application** again.
2. Choose **Live** as the environment.
3. Complete the KYB (Know Your Business) form — you will need:
   - Business name, website, and registered address
   - A brief description of how you use identity verification
   - Expected monthly volume
4. Submit for review. Didit typically approves within 1–3 business days.
5. Once approved, your live application will show **Active** status.

> **Tip:** Keep separate API keys for sandbox and live. Never mix them.

---

## Part 2 — Create a Workflow

A **workflow** defines which identity checks to run (document scan, liveness, face match, AML, etc.).

1. In your sandbox application, go to **Workflows → Create Workflow**.
2. Choose a template (e.g. "Document + Liveness") or build a custom one.
3. Toggle on the features you need:
   - **ID Verification** — government-issued document scan + OCR
   - **Liveness** — selfie + passive liveness detection
   - **Face Match** — compare selfie to document photo
   - **AML Screening** — check global sanctions/watchlists
4. Set the redirect behavior and allowed document types.
5. Click **Publish**. Copy the **Workflow ID** (UUID) — you will need it as `DIDIT_WORKFLOW_ID`.

> Each application (sandbox/live) has its own set of workflows and IDs.

---

## Part 3 — Get API Keys

1. In the Business Console, go to **API & Webhooks → API Keys**.
2. Click **Create API Key**.
3. Copy the key immediately — it is only shown once.
4. Store it in your `.env.local` as `DIDIT_API_KEY`.

> Sandbox and Live applications each have their own API keys.

---

## Part 4 — Local Development

### 4.1 Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
DIDIT_API_KEY=your_didit_api_key_here
DIDIT_WORKFLOW_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Required — must match where you deploy
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Webhook verification (get from Business Console → Webhook Destination)
DIDIT_WEBHOOK_SECRET=your_webhook_secret_here

# Optional — paste a completed session's ID to test the Decisions suite
TEST_SESSION_ID=

# Optional — Upstash Redis (for persistent webhook event storage on Vercel)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 4.2 Install dependencies

```bash
npm install
```

### 4.3 Run the dev server

```bash
npm run dev
# → http://localhost:3000
```

### 4.4 Receive webhooks locally

Didit has no CLI listener. Use **ngrok** to expose your local server:

```bash
npx ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL.

In the Business Console → **API & Webhooks → Webhook Destinations → Add Destination**:
- URL: `https://xxxx.ngrok.io/api/webhooks/didit`
- Events: `status.updated`, `data.updated`, `user.status.updated`

Copy the **Signing Secret** shown and set it as `DIDIT_WEBHOOK_SECRET` in `.env.local`.

---

## Part 5 — Deploy to Vercel

### 5.1 Push to GitHub

```bash
git init          # if not already a git repo
git add .
git commit -m "feat: Didit identity tester"
git remote add origin git@github.com:your-org/id-verify-tester.git
git push -u origin main
```

### 5.2 Import into Vercel

1. Go to https://vercel.com/new.
2. Click **Import Git Repository** and select your repo.
3. Framework: **Next.js** (auto-detected).
4. Root directory: `id-verify-tester` (or repo root if that is the project root).
5. Click **Deploy** (will fail — env vars not set yet).

### 5.3 Add environment variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DIDIT_API_KEY` | Your Didit API key |
| `DIDIT_WORKFLOW_ID` | Your workflow UUID |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |
| `DIDIT_WEBHOOK_SECRET` | From Webhook Destination setup |
| `UPSTASH_REDIS_REST_URL` | (optional, for persistent webhook log) |
| `UPSTASH_REDIS_REST_TOKEN` | (optional) |

### 5.4 Redeploy

Go to **Deployments → Redeploy** (or push a new commit).

### 5.5 Register the Vercel webhook endpoint

In the Business Console → **API & Webhooks → Webhook Destinations → Add Destination**:
- URL: `https://your-app.vercel.app/api/webhooks/didit`
- Events: `status.updated`, `data.updated`, `user.status.updated`

Copy the Signing Secret → add to Vercel env var `DIDIT_WEBHOOK_SECRET` → redeploy.

---

## Part 6 — Production Checklist

- [ ] Live application approved by Didit KYB review
- [ ] Live API key set in Vercel env vars
- [ ] Live workflow ID set in Vercel env vars
- [ ] `NEXT_PUBLIC_BASE_URL` set to production domain
- [ ] Webhook endpoint registered for live application
- [ ] `DIDIT_WEBHOOK_SECRET` set from live webhook destination
- [ ] Upstash Redis configured (webhook events persist across Vercel invocations)
- [ ] Callback URL (`/verify/complete`) reachable from Didit's servers

---

## Part 7 — Base44 / DateRealGirls Integration

### Backend: Create a session (Base44 custom action)

```javascript
// Action: createVerificationSession
// Inputs: userId (string)
// Env: DIDIT_API_KEY, DIDIT_WORKFLOW_ID, BASE_URL

const response = await fetch("https://verification.didit.me/v3/session/", {
  method: "POST",
  headers: {
    "x-api-key": env.DIDIT_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    workflow_id:     env.DIDIT_WORKFLOW_ID,
    vendor_data:     inputs.userId,          // bind session to your user
    callback:        `${env.BASE_URL}/verify/complete`,
    callback_method: "both",
    metadata:        { source: "daterealgirls" },
  }),
});
const session = await response.json();
// Return session.url to the frontend — redirect the user to it
return { url: session.url, session_id: session.session_id };
```

### Frontend: Redirect the user

```javascript
// In your Base44 page or Next.js component:
const result = await actions.createVerificationSession({ userId: currentUser.id });
window.location.href = result.url;
// No SDK, no modal, no publishable key needed on the frontend.
```

### Callback page: Handle the return

Didit redirects to your callback URL with:
```
/verify/complete?verificationSessionId=xxx&status=Approved
```

**Do not** update the member's verified flag from the callback URL alone — it can be spoofed.
Use the webhook (below) instead.

### Webhook: Update the member's status

```javascript
// POST /api/webhooks/didit
// Verify X-Signature-V2 header (see app/api/webhooks/didit/route.js for full implementation)

if (body.webhook_type === "status.updated" && body.status === "Approved") {
  await db.users.update(
    { where: { didit_vendor_data: body.vendor_data } },
    { identity_verified: true, verified_at: new Date() }
  );
}
```

### Session statuses

| Status | Meaning |
|---|---|
| `Not Started` | Session created; user has not started yet |
| `In Progress` | User has opened the verification flow |
| `Approved` | All checks passed — member is verified |
| `Declined` | One or more checks failed |
| `In Review` | Manual review required |
| `Expired` | Session timed out (default: 24h) |
| `Abandoned` | User closed the flow without completing |
| `Awaiting User` | Didit requested additional info from the user |

---

## Part 8 — Didit API Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| Create session | POST | `/v3/session/` |
| Retrieve decision | GET | `/v3/session/{id}/decision/` |
| List sessions | GET | `/v3/sessions` |
| Delete session | DELETE | `/v3/session/{id}/` |

All requests require `x-api-key: YOUR_KEY` header.

Webhook signature: HMAC-SHA256 over sorted-key canonical JSON body, delivered in `X-Signature-V2`.
Reject requests where `X-Timestamp` is more than 300 seconds old.

Full docs: https://docs.didit.me/sessions-api/overview
