import Stripe from "stripe";

/**
 * Stripe Node SDK client — lazily instantiated so Next.js static analysis
 * during `next build` doesn't throw when STRIPE_SECRET_KEY isn't present.
 */
let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (dev) or Vercel Environment Variables (production)."
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: "2025-05-28.basil",
    appInfo: { name: "stripe-identity-tester", version: "1.0.0" },
  });
  return _stripe;
}

/** Convenience proxy — works like the old `stripe` export but initializes lazily. */
export const stripe = new Proxy({}, {
  get(_target, prop) {
    return getStripe()[prop];
  },
});

/** Base URL for return_url / refresh_url callbacks */
export const BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** True when running with a test-mode key */
export const isTestMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

/**
 * Returns a logger that calls emit(entry) and also console.logs.
 * @param {Function|null} emit  (entry: {level, message, data}) => void
 */
export function createLogger(emit = null) {
  const send = (level, message, data = null) => {
    const entry = { level, message, data, ts: Date.now() };
    if (emit) emit(entry);
    const icon = level === "ok" ? "✅" : level === "error" ? "❌" : "ℹ️ ";
    console.log(`${icon} [${level}] ${message}`, data ? JSON.stringify(data) : "");
  };
  return {
    ok:    (msg, data) => send("ok",    msg, data),
    error: (msg, data) => send("error", msg, data),
    info:  (msg, data) => send("info",  msg, data),
  };
}
