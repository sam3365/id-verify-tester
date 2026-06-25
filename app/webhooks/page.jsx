"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

/**
 * /webhooks — Live view of received Didit webhook events.
 *
 * Polls /api/webhooks/events every 3 seconds and displays the results.
 *
 * To receive events locally, use the Didit console's "Try Webhook" feature or
 * tunnel your local dev server with:
 *   npx ngrok http 3000
 * Then register: https://{your-ngrok-id}.ngrok.io/api/webhooks/didit
 * in the Didit Business Console → API & Webhooks → Webhook Destinations.
 *
 * On Vercel, register: https://your-app.vercel.app/api/webhooks/didit
 *
 * Docs: https://docs.didit.me/integration/webhooks
 */

// Didit webhook event types → colors
const EVENT_COLORS = {
  "status.updated":      "var(--ok)",
  "data.updated":        "var(--accent)",
  "user.status.updated": "var(--suite)",
  "Approved":            "var(--ok)",
  "Declined":            "var(--err)",
  "In Review":           "#f59e0b",
  "In Progress":         "var(--accent)",
  "Expired":             "var(--text-dim)",
  "Abandoned":           "var(--text-dim)",
};

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" },
  h1: { display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", fontWeight: 700 },
  headerRight: { display: "flex", gap: 10, alignItems: "center" },
  back: { fontSize: "0.82rem", color: "var(--text-dim)", textDecoration: "none", padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" },
  pill: (color) => ({ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 999, background: color, color: "#fff", fontWeight: 600 }),
  main: { maxWidth: 900, margin: "0 auto", padding: "24px 24px" },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  h2: { fontSize: "1rem", fontWeight: 700 },
  clearBtn: { fontSize: "0.8rem", padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text-dim)", cursor: "pointer" },
  empty: { textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: "0.9rem" },
  event: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 12, overflow: "hidden" },
  eventHeader: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", userSelect: "none" },
  eventType: { fontWeight: 600, fontSize: "0.88rem", flex: 1 },
  eventId: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-dim)" },
  eventTs: { fontSize: "0.75rem", color: "var(--text-dim)" },
  eventBody: { borderTop: "1px solid var(--border)", padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-dim)", background: "var(--surface2)", whiteSpace: "pre-wrap", overflowX: "auto" },
  dot: (color) => ({ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }),
  infoBox: { marginTop: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" },
  cliTitle: { fontSize: "0.85rem", fontWeight: 600, marginBottom: 10 },
  code: { fontFamily: "var(--font-mono)", background: "var(--surface2)", padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem", color: "var(--text)", display: "block", marginBottom: 6, overflowX: "auto" },
};

export default function WebhooksPage() {
  const [events, setEvents]     = useState([]);
  const [expanded, setExpanded] = useState({});
  const [polling, setPolling]   = useState(true);
  const timerRef = useRef(null);

  const fetchEvents = () => {
    fetch("/api/webhooks/events")
      .then((r) => r.json())
      .then(setEvents)
      .catch(console.error);
  };

  useEffect(() => {
    fetchEvents();
    if (polling) {
      timerRef.current = setInterval(fetchEvents, 3000);
    }
    return () => clearInterval(timerRef.current);
  }, [polling]);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const fmt = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour12: false });

  const eventColor = (ev) =>
    EVENT_COLORS[ev.type] ?? EVENT_COLORS[ev.status] ?? "var(--text-dim)";

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.h1}><span style={{ fontSize: "1.5rem" }}>🔔</span> Didit Webhooks</h1>
        <div style={S.headerRight}>
          <span style={S.pill(polling ? "var(--ok)" : "var(--border)")}>
            {polling ? "● Live" : "Paused"}
          </span>
          <button style={S.back} onClick={() => setPolling((p) => !p)}>
            {polling ? "⏸ Pause" : "▶ Resume"}
          </button>
          <Link href="/verify" style={S.back}>🔍 Verify</Link>
          <Link href="/" style={S.back}>← Dashboard</Link>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.toolbar}>
          <span style={S.h2}>
            {events.length} event{events.length !== 1 ? "s" : ""} received
          </span>
          <button style={S.clearBtn} onClick={() => setEvents([])}>Clear</button>
        </div>

        {events.length === 0 ? (
          <div style={S.empty}>
            <p>🔕 No webhook events yet.</p>
            <p style={{ marginTop: 8, fontSize: "0.82rem" }}>
              Complete a verification via the{" "}
              <Link href="/verify" style={{ color: "var(--accent)" }}>Verify</Link> page,
              then check back here.
            </p>
          </div>
        ) : (
          events.map((ev) => (
            <div key={(ev.id ?? ev.event_id) + ev.receivedAt} style={S.event}>
              <div style={S.eventHeader} onClick={() => toggle(ev.id ?? ev.event_id)}>
                <span style={S.dot(eventColor(ev))} />
                <span style={S.eventType}>{ev.type ?? "unknown"}</span>
                {ev.session_id && (
                  <span style={S.eventId}>{ev.session_id}</span>
                )}
                {ev.status && (
                  <span style={{ ...S.eventId, color: eventColor(ev) }}>{ev.status}</span>
                )}
                <span style={S.eventTs}>{fmt(ev.receivedAt)}</span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                  {expanded[ev.id ?? ev.event_id] ? "▲" : "▼"}
                </span>
              </div>
              {expanded[ev.id ?? ev.event_id] && (
                <pre style={S.eventBody}>{JSON.stringify(ev.data, null, 2)}</pre>
              )}
            </div>
          ))
        )}

        {/* Local dev instructions */}
        <div style={S.infoBox}>
          <div style={S.cliTitle}>📡 Receiving webhooks locally</div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 10 }}>
            Didit has no CLI forwarder, so use ngrok (or similar) to tunnel your local server:
          </p>
          <code style={S.code}>npx ngrok http 3000</code>
          <code style={S.code}># → https://xxxx.ngrok.io/api/webhooks/didit</code>
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
            Register the ngrok URL as a webhook destination in the Didit Business Console under{" "}
            <strong>API &amp; Webhooks → Webhook Destinations</strong>. Copy the displayed signing
            secret into <code>DIDIT_WEBHOOK_SECRET</code> in <code>.env.local</code>.
            <br /><br />
            On Vercel, register:{" "}
            <code>https://your-app.vercel.app/api/webhooks/didit</code>
            <br /><br />
            Recommended events to subscribe to:{" "}
            <code>status.updated</code>, <code>data.updated</code>, <code>user.status.updated</code>
            <br /><br />
            <a href="https://business.didit.me" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              business.didit.me
            </a>
            {" · "}
            <a href="https://docs.didit.me/integration/webhooks" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              Webhook docs
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
