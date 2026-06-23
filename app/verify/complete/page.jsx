"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "40px 44px", maxWidth: 520, width: "100%", textAlign: "center" },
  icon: { fontSize: "3rem", marginBottom: 16 },
  h2: { fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 },
  sub: { fontSize: "0.88rem", color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 24 },
  detailBox: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 18px", marginBottom: 24, textAlign: "left", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
  btnRow: { display: "flex", gap: 12, justifyContent: "center" },
  btn: (primary) => ({
    padding: "9px 20px", borderRadius: 8, border: primary ? "none" : "1px solid var(--border)",
    background: primary ? "var(--accent)" : "var(--surface2)",
    color: primary ? "#fff" : "var(--text)", fontWeight: 600, fontSize: "0.88rem",
    cursor: "pointer", textDecoration: "none", display: "inline-block",
  }),
};

function CompleteInner() {
  const searchParams = useSearchParams();
  const sessionId    = searchParams.get("session") ?? null;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/identity/session/${sessionId}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const statusIcon = {
    verified:       "✅",
    processing:     "⏳",
    requires_input: "⚠️",
    canceled:       "❌",
    created:        "🆕",
  }[session?.status] ?? "🪪";

  const statusMsg = {
    verified:       "Identity verified! The check passed successfully.",
    processing:     "Verification is still processing. Stripe will send a webhook when complete.",
    requires_input: "Additional input required. The check could not be completed automatically.",
    canceled:       "The verification session was cancelled.",
    created:        "Session created but verification not yet submitted.",
  }[session?.status] ?? "Verification flow complete.";

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.icon}>{loading ? "⏳" : statusIcon}</div>
        <h2 style={S.h2}>{loading ? "Loading…" : "Verification Complete"}</h2>
        <p style={S.sub}>{loading ? "Fetching session status…" : statusMsg}</p>

        {session && (
          <pre style={S.detailBox}>{JSON.stringify({
            id:         session.id,
            status:     session.status,
            type:       session.type,
            livemode:   session.livemode,
            created:    new Date(session.created * 1000).toISOString(),
            last_error: session.last_error ?? null,
          }, null, 2)}</pre>
        )}

        {!sessionId && !loading && (
          <pre style={S.detailBox}>
            No session ID in URL. This page is the return_url for the Stripe Identity modal.
            Stripe appends ?session=vs_xxx automatically.
          </pre>
        )}

        <div style={S.btnRow}>
          <Link href="/verify" style={S.btn(true)}>Verify Again</Link>
          <Link href="/" style={S.btn(false)}>← Dashboard</Link>
          <Link href="/webhooks" style={S.btn(false)}>🔔 Webhooks</Link>
        </div>
      </div>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <CompleteInner />
    </Suspense>
  );
}
