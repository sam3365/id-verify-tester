# Didit ID Verification Tester

A Next.js dashboard and API test harness for the [Didit](https://didit.me) identity verification platform. Use it to validate your Didit integration during development: create verification sessions, receive webhooks, retrieve decision results, and run automated test suites — all from a single UI.

## Features

- **Test runner** — Run automated suites (Config & Health, Sessions, Decisions) via a real-time SSE log stream
- **Verification launcher** — Create a Didit session and redirect users to the hosted verification flow
- **Session lookup** — Retrieve and display personal data, document images, liveness photos, and AML results for any session
- **Webhook monitor** — Live-poll incoming webhook events with full payload inspection

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19
- Serverless API routes (Next.js route handlers)
- In-memory storage (dev) / [Upstash Redis](https://upstash.com/) (production)
- HMAC-SHA256 webhook signature verification
- CSS custom properties for dark/light theming

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — run test suites |
| `/verify` | Launch a new verification session |
| `/verify/complete` | Callback handler after Didit redirects back |
| `/lookup` | Retrieve decision by session ID |
| `/webhooks` | Real-time webhook event monitor |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

**Required:**

```env
DIDIT_API_KEY=                   # From business.didit.me → API & Webhooks → API Keys
DIDIT_WORKFLOW_ID=               # UUID from Workflows in Didit console
NEXT_PUBLIC_BASE_URL=            # http://localhost:3000 (dev) or your Vercel URL (prod)
DIDIT_WEBHOOK_SECRET=            # Signing secret from your Webhook Destination config
```

**Optional:**

```env
NEXT_PUBLIC_DEFAULT_VENDOR_DATA= # Pre-fills the user ID field on /verify
NEXT_PUBLIC_DEFAULT_SESSION_ID=  # Pre-fills the session ID field on /lookup
TEST_SESSION_ID=                 # Session used by the Decisions test suite
UPSTASH_REDIS_REST_URL=          # Persistent webhook storage on Vercel
UPSTASH_REDIS_REST_TOKEN=
```

## Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your DIDIT_API_KEY, DIDIT_WORKFLOW_ID, etc.

# Start dev server
npm run dev
# → http://localhost:3000
```

### Receiving Webhooks Locally

Didit needs a public HTTPS URL to deliver webhook events. Use ngrok (or any tunnel) to expose your local server:

```bash
npx ngrok http 3000
```

Register the tunnel URL in the Didit console under **API & Webhooks → Webhook Destinations**:

- URL: `https://<your-ngrok-id>.ngrok.io/api/webhooks/didit`
- Events: `status.updated`, `data.updated`, `user.status.updated`
- Copy the signing secret to `DIDIT_WEBHOOK_SECRET` in `.env.local`

## Deployment (Vercel)

1. Push to GitHub and connect the repo at [vercel.com/new](https://vercel.com/new)
2. Add all environment variables in the Vercel project settings (same as `.env.local`, with `NEXT_PUBLIC_BASE_URL` set to your Vercel URL)
3. Deploy, then register `https://your-app.vercel.app/api/webhooks/didit` as a Webhook Destination in Didit
4. For persistent webhook storage across serverless invocations, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

See `DEPLOY.md` for a full step-by-step guide including Didit account setup, workflow creation, and KYB requirements.

## Scripts

```bash
npm run dev    # Development server with hot reload
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Lint with Next.js ESLint config
```
