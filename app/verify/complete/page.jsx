"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * /verify/complete — Landing page after Didit redirects the user back.
 *
 * Didit appends:
 *   ?verificationSessionId={session_id}&status={Approved|Declined|…}
 *
 * We fetch the full decision from /api/identity/session/[id] and display it.
 *
 * IMPORTANT (Base44 / DateRealGirls):
 *   Do NOT use the callback URL alone to set the member's verified flag in your DB —
 *   it can be spoofed. Use the webhook at /api/webhooks/didit instead.
 */

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" },
  h1: { display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", fontWeight: 700 },
  back: { fontSize: "0.82rem", color: "var(--text-dim)", textDecoration: "none", padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" },
  main: { maxWidth: 640, margin: "40px auto", padding: "0 24px" },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "28px 32px", marginBottom: 20 },
  h2: { fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 },
  badge: (status) => {
    const map = {
      Approved:    { bg: "rgba(34,197,94,0.15)",  color: "#22c55e", border: "#22c55e" },
      Declined:    { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", border: "#ef4444" },
      "In Review": { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "#d97706" },
      Expired:     { bg: "rgba(100,116,139,0.15)",color: "#94a3b8", border: "#475569" },
      Abandoned:   { bg: "rgba(100,116,139,0.15)",color: "#94a3b8", border: "#475569" },
    };
    const c = map[status] ?? { bg: "rgba(37,103,255,0.12)", color: "#2567ff", border: "#2567ff" };
    return {
      display: "inline-block", padding: "4px 14px", borderRadius: 999,
      fontWeight: 700, fontSize: "1.1rem",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    };
  },
  statusEmoji: (status) => ({
    Approved: "✅", Declined: "❌", "In Review": "🔍", Expired: "⏰",
    Abandoned: "🚪", "Not Started": "🆕", "In Progress": "⏳",
  }[status] ?? "🪪"),
  kv: { display: "flex", flexDirection: "column", gap: 0, marginTop: 16 },
  row: { display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" },
  label: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em", flexShrink: 0, width: 160, paddingTop: 2 },
  value: { fontSize: "0.85rem", color: "var(--text)", fontFamily: "var(--font-mono)", wordBreak: "break-all" },
  pre: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: "0.76rem", whiteSpace: "pre-wrap", overflowX: "auto", color: "var(--text-dim)", marginTop: 12 },
  warn: { background: "rgba(239,68,68,0.07)", border: "1px solid var(--err)", borderRadius: 8, padding: "10px 14px", fontSize: "0.82rem", color: "var(--err)" },
  info: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", fontSize: "0.82rem", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 16 },
  code: { fontFamily: "var(--font-mono)", background: "var(--surface)", padding: "1px 5px", borderRadius: 4, fontSize: "0.78rem", color: "var(--text)" },
  actionRow: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" },
  btn: (primary) => ({
    padding: "10px 18px", borderRadius: 8,
    border: `1px solid ${primary ? "var(--accent)" : "var(--border)"}`,
    background: primary ? "var(--accent)" : "transparent",
    color: primary ? "#fff" : "var(--text)", fontSize: "0.85rem", fontWeight: 600,
    cursor: "pointer", textDecoration: "none", display: "inline-block",
  }),
};

function CompleteInner() {
  const searchParams   = useSearchParams();
  const sessionId      = searchParams.get("verificationSessionId") ?? null;
  const callbackStatus = searchParams.get("status") ?? null;

  const [decision, setDecision] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("No verificationSessionId in the URL. Did you arrive here directly?");
      return;
    }
    fetch(`/api/identity/session/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDecision(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const status = decision?.status ?? callbackStatus ?? "Unknown";

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.h1}><span style={{ fontSize: "1.5rem" }}>🪪</span> Didit Identity Tester</h1>
        <Link href="/" style={S.back}>← Dashboard</Link>
      </header>

      <main style={S.main}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
            Fetching decision from Didit…
          </div>
        ) : (
          <>
            <div style={S.card}>
              <h2 style={S.h2}>Verification Complete</h2>
              <p>
                {S.statusEmoji(status)}{" "}
                <span style={S.badge(status)}>{status}</span>
              </p>

              <div style={S.kv}>
                {sessionId && (
                  <div style={S.row}>
                    <span style={S.label}>Session ID</span>
                    <span style={S.value}>{sessionId}</span>
                  </div>
                )}
                {callbackStatus && (
                  <div style={S.row}>
                    <span style={S.label}>Callback status</span>
                    <span style={S.value}>{callbackStatus}</span>
                  </div>
                )}
                {decision?.session_number && (
                  <div style={S.row}>
                    <span style={S.label}>Session #</span>
                    <span style={S.value}>{decision.session_number}</span>
                  </div>
                )}
                {decision?.vendor_data && (
                  <div style={S.row}>
                    <span style={S.label}>Vendor data</span>
                    <span style={S.value}>{decision.vendor_data}</span>
                  </div>
                )}
                {decision?.features && (
                  <div style={S.row}>
                    <span style={S.label}>Features</span>
                    <span style={S.value}>{(decision.features ?? []).join(", ") || "none"}</span>
                  </div>
                )}
              </div>
            </div>

            {decision && !error && (
              <div style={S.card}>
                <h2 style={S.h2}>Full Decision Payload</h2>
                <pre style={S.pre}>{JSON.stringify(decision, null, 2)}</pre>
              </div>
            )}

            {error && (
              <div style={{ ...S.card, borderColor: "var(--err)", marginBottom: 20 }}>
                <p style={S.warn}>⚠ {error}</p>
              </div>
            )}

            <div style={S.info}>
              <strong>Production note (Base44 / DateRealGirls):</strong> Do not trust the callback
              URL alone to set the member&apos;s verified status — it can be spoofed. Use the webhook at{" "}
              <code style={S.code}>/api/webhooks/didit</code> and listen for{" "}
              <code style={S.code}>status.updated</code> events with{" "}
              <code style={S.code}>status: &quot;Approved&quot;</code>.
              The HMAC-SHA256 <code style={S.code}>X-Signature-V2</code> ensures the event is genuine.
            </div>

            <div style={S.actionRow}>
              <Link href="/verify" style={S.btn(true)}>🔍 Run another verification</Link>
              <Link href="/webhooks" style={S.btn(false)}>🔔 Webhooks</Link>
              <Link href="/" style={S.btn(false)}>← Dashboard</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>Loading…</div>}>
      <CompleteInner />
    </Suspense>
  );
}
