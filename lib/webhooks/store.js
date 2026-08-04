/**
 * Webhook event store.
 *
 * Persists received Didit webhook events so they can be displayed in the
 * browser UI. On Vercel (serverless) each invocation may spin up a fresh
 * instance, so we use Upstash Redis when UPSTASH_REDIS_REST_URL is set;
 * otherwise we fall back to an in-memory array (fine for local dev).
 */

const MAX_EVENTS  = 50;
const SEEN_TTL    = 60 * 60 * 24; // 24 h — how long to track seen event_ids

// ── In-memory fallback ───────────────────────────────────────────────────────
const memStore  = [];
const memSeen   = new Set(); // event_id deduplication (local dev only)

// ── Upstash Redis helpers ────────────────────────────────────────────────────
let redis = null;
async function getRedis() {
  if (redis) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const REDIS_KEY = "id-verify-tester:webhook-events";

// ── Public API ───────────────────────────────────────────────────────────────

export async function pushEvent(event) {
  // Didit envelope uses event_id, webhook_type, session_id, status, decision
  const entry = {
    id:         event.event_id  ?? `evt-${Date.now()}`,
    type:       event.webhook_type ?? "unknown",
    session_id: event.session_id   ?? null,
    status:     event.status       ?? null,
    vendor_data: event.vendor_data ?? null,
    environment: event.environment ?? null,
    decision:   event.decision     ?? null,
    review:     event._review      ?? null, // age/gender review outcome (Approved events only)
    data:       event,             // full envelope for the UI
    receivedAt: Date.now(),
  };

  const r = await getRedis();
  if (r) {
    await r.lpush(REDIS_KEY, JSON.stringify(entry));
    await r.ltrim(REDIS_KEY, 0, MAX_EVENTS - 1);
    await r.expire(REDIS_KEY, 60 * 60 * 24); // 24 h TTL
  } else {
    memStore.unshift(entry);
    if (memStore.length > MAX_EVENTS) memStore.length = MAX_EVENTS;
  }
}

export async function getEvents() {
  const r = await getRedis();
  if (r) {
    const raw = await r.lrange(REDIS_KEY, 0, MAX_EVENTS - 1);
    return raw.map((e) => (typeof e === "string" ? JSON.parse(e) : e));
  }
  return [...memStore];
}

/**
 * Idempotency check — returns true if this event_id has already been processed.
 * Records the ID so subsequent calls for the same ID return true.
 */
export async function hasEvent(eventId) {
  if (!eventId) return false;
  const seenKey = `id-verify-tester:seen:${eventId}`;
  const r = await getRedis();
  if (r) {
    // SET NX returns 1 (new) or null (already exists)
    const result = await r.set(seenKey, "1", { nx: true, ex: SEEN_TTL });
    return result === null; // null → key already existed → duplicate
  }
  // In-memory fallback
  if (memSeen.has(eventId)) return true;
  memSeen.add(eventId);
  return false;
}
