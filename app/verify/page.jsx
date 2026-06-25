"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /verify — Create a Didit session and redirect the user to the hosted
 * verification flow at verify.didit.me.
 *
 * Flow:
 *  1. User clicks "Start Verification"
 *  2. POST /api/identity/session (server-side, uses DIDIT_API_KEY)
 *  3. Server returns { url, session_id }
 *  4. Browser redirects to `url` — Didit's hosted verification page
 *  5. User completes ID check, liveness, etc. on Didit's UI
 *  6. Didit redirects back to /verify/complete?verificationSessionId=xxx&status=Approved
 *
 * Base44 / DateRealGirls integration notes are embedded as comments.
 */

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" },
  h1: { display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", fontWeight: 700 },
  back: { fontSize: "0.82rem", color: "var(--text-dim)", textDecoration: "none", padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" },
  main: { maxWidth: 600, margin: "40px auto", padding: "0 24px" },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "28px 32px" },
  h2: { fontSize: "1.15rem", fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: "0.85rem", color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 24 },
  fieldset: { border: "none", padding: 0, marginBottom: 20 },
  legend: { fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.88rem" },
  divider: { borderTop: "1px solid var(--border)", margin: "20px 0" },
  btn: (loading) => ({
    width: "100%", padding: "13px", borderRadius: "var(--radius)", border: "none",
    background: loading ? "var(--surface2)" : "var(--accent)",
    color: loading ? "var(--text-dim)" : "#fff",
    fontSize: "1rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
    transition: "background .2s",
  }),
  resultBox: (type) => ({
    marginTop: 16, padding: "12px 16px", borderRadius: 8,
    background: type === "error" ? "rgba(239,68,68,0.1)" : "rgba(37,103,255,0.08)",
    border: `1px solid ${type === "error" ? "var(--err)" : "var(--border)"}`,
    fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: type === "error" ? "var(--err)" : "var(--text-dim)",
    whiteSpace: "pre-wrap",
  }),
  infoBox: {
    marginTop: 24, padding: "14px 18px", borderRadius: 8,
    background: "var(--surface2)", border: "1px solid var(--border)",
    fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-dim)",
  },
  code: { fontFamily: "var(--font-mono)", background: "var(--surface)", padding: "1px 5px", borderRadius: 4, fontSize: "0.78rem", color: "var(--text)" },
};

export default function VerifyPage() {
  const [vendorData, setVendorData] = useState(process.env.NEXT_PUBLIC_DEFAULT_VENDOR_DATA ?? "");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  const startVerification = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Step 1: Create a session server-side
      // In Base44 / DateRealGirls: call a custom action that creates the Didit
      // session and returns { url, session_id } — never expose the API key client-side.
      const res = await fetch("/api/identity/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorData: vendorData.trim() || undefined,
          metadata:   { source: "id-verify-tester" },
        }),
      });
      const session = await res.json();

      if (!res.ok || session.error) {
        setResult({ type: "error", message: session.error ?? "Failed to create session" });
        setLoading(false);
        return;
      }

      setResult({
        type: "info",
        message: `Session created: ${session.session_id}\nStatus: ${session.status}\nRedirecting to Didit hosted verification…`,
      });

      // Step 2: Redirect to Didit's hosted verification page
      // Didit appends ?verificationSessionId={id}&status={status} to the callback
      // URL when the user finishes (or abandons) the flow.
      setTimeout(() => {
        window.location.href = session.url;
      }, 800);
    } catch (err) {
      setResult({ type: "error", message: err.message });
      setLoading(false);
    }
  };

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.h1}><span style={{ fontSize: "1.5rem" }}>🪪</span> Didit Identity Tester</h1>
        <Link href="/" style={S.back}>← Dashboard</Link>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          <h2 style={S.h2}>Launch Identity Verification</h2>
          <p style={S.sub}>
            Creates a Didit verification session server-side, then redirects the user to
            Didit&apos;s hosted verification flow. After completion, Didit redirects back to{" "}
            <code style={S.code}>/verify/complete</code>.
          </p>

          {/* Optional vendor data */}
          <fieldset style={S.fieldset}>
            <legend style={S.legend}>User ID (vendor_data)</legend>
            <input
              style={S.input}
              type="text"
              placeholder="e.g. your-internal-user-id (optional)"
              value={vendorData}
              onChange={(e) => setVendorData(e.target.value)}
            />
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Binds the session to a user in the Didit console. Strongly recommended in production.
            </p>
          </fieldset>

          <div style={S.divider} />

          <button style={S.btn(loading)} disabled={loading} onClick={startVerification}>
            {loading ? "⏳ Creating session…" : "🔍 Start Verification"}
          </button>

          {result && (
            <pre style={S.resultBox(result.type)}>{result.message}</pre>
          )}
        </div>

        {/* Integration notes */}
        <div style={S.infoBox}>
          <strong>Base44 / DateRealGirls Integration Notes</strong>
          <br /><br />
          <strong>1. Backend (Base44 custom action or API route):</strong><br />
          Call <code style={S.code}>POST /api/identity/session</code> server-side with your{" "}
          <code style={S.code}>DIDIT_API_KEY</code> and <code style={S.code}>DIDIT_WORKFLOW_ID</code>.
          Return the <code style={S.code}>url</code> and <code style={S.code}>session_id</code> to the frontend.<br /><br />
          <strong>2. Frontend (Base44 page or Next.js component):</strong><br />
          Redirect the user to <code style={S.code}>session.url</code> — no Stripe.js or SDK needed.
          Didit&apos;s entire flow runs on their hosted page.<br /><br />
          <strong>3. Callback:</strong><br />
          Didit appends <code style={S.code}>?verificationSessionId=xxx&status=Approved</code> to your
          return URL. Handle this in <code style={S.code}>/verify/complete</code>.<br /><br />
          <strong>4. Webhook (update member status):</strong><br />
          Listen for <code style={S.code}>status.updated</code> with <code style={S.code}>status: &quot;Approved&quot;</code>{" "}
          at <code style={S.code}>/api/webhooks/didit</code> and set the member&apos;s verified flag in your DB.<br /><br />
          <strong>5. Free tier:</strong><br />
          Didit gives 500 free verifications per feature per month — no credit card needed for sandbox.
          Visit{" "}
          <a href="https://business.didit.me" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            business.didit.me
          </a>{" "}
          to create a free sandbox application.
        </div>
      </main>
    </div>
  );
}
