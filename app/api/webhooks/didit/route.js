import { createHmac, timingSafeEqual } from "crypto";
import { pushEvent, hasEvent } from "@/lib/webhooks/store.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/didit
 *
 * Didit webhook receiver — adheres to the V3 webhook specification:
 *   https://docs.didit.me/integration/webhooks
 *
 * Configure this URL in the Business Console:
 *   API & Webhooks → Add Webhook Destination
 *   URL: https://your-app.vercel.app/api/webhooks/didit
 *
 * Recommended subscribed_events:
 *   status.updated, data.updated,
 *   user.status.updated, user.data.updated,
 *   business.status.updated, business.data.updated,
 *   activity.created, transaction.created, transaction.status.updated
 *
 * Verification order (per spec):
 *   1. Read raw body text — do NOT parse JSON first
 *   2. Validate X-Timestamp is within 300 seconds
 *   3. Recompute HMAC and constant-time compare
 *   4. Parse JSON and process by webhook_type
 *   5. Return 2xx immediately; heavy work goes async
 */

// ── Signature helpers ────────────────────────────────────────────────────────

/** Sort object keys recursively — produces Didit's canonical JSON form. */
function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
  }
  return obj;
}

/**
 * Verify X-Signature-V2:
 *   HMAC-SHA256 over sorted, Unicode-preserved canonical JSON.
 *   Didit re-serialises the body with sorted keys before signing,
 *   so we must do the same (parse → sort → re-stringify).
 */
function verifyV2(parsedBody, sig, secret) {
  const canonical = JSON.stringify(sortKeys(parsedBody));
  const expected  = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  const a = Buffer.from(expected,  "utf8");
  const b = Buffer.from(sig ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify X-Signature:
 *   HMAC-SHA256 over the exact raw bytes — no re-encoding.
 *   Only reliable when the network stack does not alter the body.
 */
function verifyRaw(rawBody, sig, secret) {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected,  "utf8");
  const b = Buffer.from(sig ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify X-Signature-Simple:
 *   HMAC-SHA256 over "{timestamp}:{session_id}:{status}:{webhook_type}".
 *   Fallback only — does not authenticate the decision body.
 */
function verifySimple(parsed, sig, timestampHdr, secret) {
  const envelope  = `${timestampHdr}:${parsed.session_id}:${parsed.status}:${parsed.webhook_type}`;
  const expected  = createHmac("sha256", secret).update(envelope, "utf8").digest("hex");
  const a = Buffer.from(expected,  "utf8");
  const b = Buffer.from(sig ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Webhook event handler ────────────────────────────────────────────────────

function handleEvent(body) {
  const { webhook_type, status, session_id, event_id, vendor_data } = body;

  switch (webhook_type) {
    case "status.updated":
      // Session status changed — primary event to act on
      switch (status) {
        case "Approved":
          // TODO: mark user as verified in your DB
          // user.verified = true; store decision data from body.decision
          console.log(`✅ Approved | session: ${session_id} | vendor: ${vendor_data}`);
          break;
        case "Declined":
          // TODO: user.verification_status = "declined"; log body.decision warnings
          console.log(`❌ Declined | session: ${session_id} | vendor: ${vendor_data}`);
          break;
        case "In Review":
          // TODO: user.verification_status = "pending_review"
          console.log(`🔍 In Review | session: ${session_id}`);
          break;
        case "In Progress":
          console.log(`⏳ In Progress | session: ${session_id}`);
          break;
        case "Resubmitted":
          // TODO: reopen listed feature nodes per body.resubmit_info
          console.log(`🔄 Resubmitted | session: ${session_id}`);
          break;
        case "Abandoned":
          // TODO: optionally trigger reminder to user
          console.log(`🚪 Abandoned | session: ${session_id}`);
          break;
        case "Expired":
        case "KYC Expired":
          // TODO: mark session expired; optionally create a new one
          console.log(`⏰ ${status} | session: ${session_id}`);
          break;
        default:
          console.log(`status.updated | status: ${status} | session: ${session_id}`);
      }
      break;

    case "data.updated":
      console.log(`data.updated | session: ${session_id}`);
      break;

    case "user.status.updated":
    case "user.data.updated":
      console.log(`${webhook_type} | event: ${event_id}`);
      break;

    case "business.status.updated":
    case "business.data.updated":
      console.log(`${webhook_type} | business_session: ${body.business_session_id}`);
      break;

    case "activity.created":
      console.log(`activity.created | event: ${event_id}`);
      break;

    case "transaction.created":
    case "transaction.status.updated":
      console.log(`${webhook_type} | event: ${event_id}`);
      break;

    default:
      console.warn(`Unknown webhook_type: ${webhook_type}`);
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;

  if (!secret) {
    console.error("DIDIT_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // ── Step 1: Read raw body text BEFORE any parsing ─────────────────────────
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Could not read request body" }, { status: 400 });
  }

  // ── Step 2: Read signature headers ────────────────────────────────────────
  const sigV2     = request.headers.get("x-signature-v2");
  const sigRaw    = request.headers.get("x-signature");
  const sigSimple = request.headers.get("x-signature-simple");
  const timestamp = request.headers.get("x-timestamp") ?? "";

  if (!timestamp) {
    return Response.json({ error: "Missing X-Timestamp header" }, { status: 400 });
  }

  // ── Step 3: Validate timestamp freshness (≤ 300 seconds) ─────────────────
  const now     = Math.floor(Date.now() / 1000);
  const tsEpoch = parseInt(timestamp, 10);
  if (isNaN(tsEpoch) || Math.abs(now - tsEpoch) > 300) {
    console.error(`Stale or invalid timestamp: ${timestamp} (now: ${now})`);
    return Response.json({ error: "Timestamp expired or invalid" }, { status: 401 });
  }

  // ── Step 4: Parse JSON (needed for V2 canonical form + Simple envelope) ───
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("Invalid JSON body:", rawBody.slice(0, 200));
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Step 5: Verify signature — try V2, then raw, then simple ─────────────
  let verified = false;
  let verifiedBy = null;

  if (sigV2) {
    verified   = verifyV2(body, sigV2, secret);
    verifiedBy = "X-Signature-V2";
  }
  if (!verified && sigRaw) {
    verified   = verifyRaw(rawBody, sigRaw, secret);
    verifiedBy = "X-Signature";
  }
  if (!verified && sigSimple) {
    verified   = verifySimple(body, sigSimple, timestamp, secret);
    verifiedBy = "X-Signature-Simple";
  }

  if (!verified) {
    // Log raw body to help debug signature mismatches
    console.error("Signature verification failed. Raw body:", rawBody.slice(0, 500));
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log(`Webhook verified via ${verifiedBy}`);

  // ── Step 6: Idempotency — deduplicate on event_id ────────────────────────
  const eventId = body.event_id;
  if (eventId && await hasEvent(eventId)) {
    console.log(`Duplicate webhook ignored: ${eventId}`);
    return Response.json({ received: true, duplicate: true });
  }

  // ── Step 7: Process event by webhook_type ─────────────────────────────────
  // Return 2xx immediately; handleEvent logs synchronously.
  // Move DB writes here or kick off a background job for heavy work.
  handleEvent(body);

  // ── Step 8: Persist for the /webhooks UI page ────────────────────────────
  await pushEvent(body);

  return Response.json({ received: true });
}
