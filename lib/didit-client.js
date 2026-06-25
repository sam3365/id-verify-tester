/**
 * Didit REST client.
 *
 * Didit does not publish a Node.js SDK — all calls are plain fetch() with an
 * x-api-key header against https://verification.didit.me/v3/
 *
 * Docs: https://docs.didit.me
 */

export const DIDIT_BASE_URL = "https://verification.didit.me/v3";

/** Base URL for callback URLs returned to the user after verification */
export const BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function getApiKey() {
  const key = process.env.DIDIT_API_KEY;
  if (!key) {
    throw new Error(
      "DIDIT_API_KEY is not set. Add it to .env.local (dev) or Vercel Environment Variables (production)."
    );
  }
  return key;
}

/**
 * Core fetch wrapper. Adds x-api-key header, throws on non-2xx.
 */
async function diditFetch(path, options = {}) {
  const url = `${DIDIT_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  if (!res.ok) {
    const message =
      data?.detail ??
      Object.entries(data ?? {})
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" | ");
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Didit Sessions API
 * Docs: https://docs.didit.me/sessions-api/overview
 */
export const didit = {
  sessions: {
    /**
     * Create a verification session.
     * Returns: { session_id, url, session_token, status, vendor_data, ... }
     * Docs: https://docs.didit.me/sessions-api/create-session
     */
    create: (body) =>
      diditFetch("/session/", { method: "POST", body: JSON.stringify(body) }),

    /**
     * Retrieve the full decision for a session.
     * Returns: { session_id, status, id_verifications[], liveness_checks[], ... }
     * Docs: https://docs.didit.me/sessions-api/retrieve-session
     */
    retrieve: (sessionId) => diditFetch(`/session/${sessionId}/decision/`),

    /**
     * List sessions with optional filters.
     * Docs: https://docs.didit.me/sessions-api/list-sessions
     */
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return diditFetch(`/sessions${qs ? "?" + qs : ""}`);
    },

    /**
     * Delete a session (removes PII — irreversible).
     * Docs: https://docs.didit.me/sessions-api/delete-session
     */
    delete: (sessionId) =>
      diditFetch(`/session/${sessionId}/`, { method: "DELETE" }),
  },
};

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
