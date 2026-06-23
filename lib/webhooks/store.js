/**
 * Webhook event store.
 *
 * Persists received Stripe Identity webhook events so they can be
 * streamed to the browser. On Vercel (serverless) each invocation
 * may spin up a fresh instance, so we use Upstash Redis when
 * UPSTASH_REDIS_REST_URL is set; otherwise we fall back to an
 * in-memory array (fine for local dev with `next dev`).
 */

const MAX_EVENTS = 50;

// ── In-memory fallback ───────────────────────────────────────────────────────
const memStore = [];

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

const REDIS_KEY = "stripe-identity-tester:webhook-events";

// ── Public API ───────────────────────────────────────────────────────────────

export async function pushEvent(event) {
  const entry = {
    id:      event.id,
    type:    event.type,
    created: event.created,
    data:    event.data?.object ?? {},
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
