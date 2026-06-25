import { createHmac, timingSafeEqual } from "crypto";
import { pushEvent } from "@/lib/webhooks/store.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/didit
 *
 * Didit webhook receiver. Configure this URL in the Business Console:
 *   https://business.didit.me → API & Webhooks → Add Webhook Destination
 *   URL: https://your-app.vercel.app/api/webhooks/didit
 *
 * Recommended events:
 *   status.updated       — session status changed (Approved, Declined, In Review…)
 *   data.updated         — verification data edited after session creation
 *   user.status.updated  — consolidated user entity status changed
 *
 * Docs: https://docs.didit.me/integration/webhooks
 *
 * Signature: Didit sends X-Signature-V2 (preferred), X-Signature, and
 * X-Signature-Simple. We verify X-Signature-V2 — HMAC-SHA256 over the
 * sorted, Unicode-preserved canonical JSON of the body.
 *
 * For local testing, use the Business Console → Try Webhook, or send a
 * real verification through a test workflow.
 */

/** Sort object keys recursively (matches Didit's canonical JSON). */
function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => { acc[key] = sortKeys(obj[key]); return acc; }, {});
  }
  return obj;
}

/** Match Didit's float normalisation: whole floats → ints. */
function shortenFloats(data) {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, shortenFloats(v)]));
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function verifySignatureV2(jsonBody, signatureHeader, timestampHeader, secret) {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestampHeader, 10)) > 300) return false; // reject stale

  // Re-encode with sorted keys + Unicode preserved — matches Didit's canonical form
  const canonical = JSON.stringify(sortKeys(shortenFloats(jsonBody)));
  const expected  = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("⚠️  DIDIT_WEBHOOK_SECRET not set — skipping signature verification");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const signatureV2  = request.headers.get("x-signature-v2")   ?? "";
  const timestampHdr = request.headers.get("x-timestamp")       ?? "";

  if (!timestampHdr) {
    return Response.json({ error: "Missing X-Timestamp header" }, { status: 400 });
  }

  const valid = signatureV2 && verifySignatureV2(body, signatureV2, timestampHdr, secret);

  if (!valid) {
    console.error("Didit webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const webhookType = body.webhook_type ?? "unknown";
  const sessionId   = body.session_id   ?? "n/a";
  console.log(`Received Didit webhook: ${webhookType} | session: ${sessionId} | status: ${body.status}`);

  // Store for the /webhooks UI page
  await pushEvent(body);

  return Response.json({ received: true });
}
