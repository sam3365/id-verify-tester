"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * /verify — Launch the Stripe Identity hosted verification modal.
 *
 * Flow:
 *  1. User picks options (type, selfie, id_number) and clicks "Start Verification"
 *  2. We POST to /api/identity/session → get back client_secret
 *  3. We load Stripe.js and call stripe.verifyIdentity(client_secret)
 *  4. Stripe opens its hosted modal — user completes the check
 *  5. On success Stripe redirects to /verify/complete
 *
 * Base44 / DateRealGirls integration notes are embedded as comments throughout.
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
  radioGroup: { display: "flex", gap: 10 },
  radioLabel: (selected) => ({
    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
    padding: "8px 14px", borderRadius: 8,
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    background: selected ? "rgba(99,91,255,0.08)" : "var(--surface2)",
    fontSize: "0.85rem", fontWeight: selected ? 600 : 400,
    transition: "border-color .15s, background .15s",
  }),
  checkbox: { display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem", cursor: "pointer", marginBottom: 8 },
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
    background: type === "error" ? "rgba(239,68,68,0.1)" : "rgba(99,91,255,0.08)",
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
  const [type, setType]             = useState("document");
  const [requireSelfie, setSelfie]  = useState(true);
  const [requireIdNum, setIdNum]    = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);

  // Load Stripe.js once on mount
  useEffect(() => {
    if (window.Stripe) { setStripeLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => setStripeLoaded(true);
    document.head.appendChild(script);
  }, []);

  const startVerification = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Step 1: Create a VerificationSession server-side
      const res = await fetch("/api/identity/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, requireSelfie, requireIdNumber: requireIdNum }),
      });
      const session = await res.json();

      if (!res.ok || session.error) {
        setResult({ type: "error", message: session.error ?? "Failed to create session" });
        setLoading(false);
        return;
      }

      setResult({ type: "info", message: `Session created: ${session.id}\nStatus: ${session.status}\nLaunching Stripe Identity modal…` });

      // Step 2: Launch the Stripe Identity hosted modal
      //
      // Base44 / DateRealGirls integration:
      //   Replace NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY with your Stripe publishable key.
      //   In Base44 you would call this from a custom action or a frontend script block.
      //   Pass the client_secret returned from your backend endpoint.
      //
      const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripePublishableKey) {
        setResult({ type: "error", message: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in .env.local" });
        setLoading(false);
        return;
      }

      const stripe = window.Stripe(stripePublishableKey);
      const { error } = await stripe.verifyIdentity(session.client_secret);

      if (error) {
        setResult({ type: "error", message: `Stripe modal error: ${error.message} (${error.code})` });
      } else {
        // User completed the flow — Stripe will redirect to return_url (/verify/complete)
        setResult({ type: "info", message: "Verification submitted — redirecting to /verify/complete…" });
      }
    } catch (err) {
      setResult({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.h1}><span style={{ fontSize: "1.5rem" }}>🪪</span> Stripe Identity Tester</h1>
        <Link href="/" style={S.back}>← Dashboard</Link>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          <h2 style={S.h2}>Launch Identity Verification</h2>
          <p style={S.sub}>
            Configures and launches the Stripe Identity hosted modal. A VerificationSession is created
            server-side; the modal opens client-side using <code style={S.code}>stripe.verifyIdentity(clientSecret)</code>.
          </p>

          {/* Verification type */}
          <fieldset style={S.fieldset}>
            <legend style={S.legend}>Verification Type</legend>
            <div style={S.radioGroup}>
              {["document", "id_number"].map((t) => (
                <label key={t} style={S.radioLabel(type === t)}>
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} style={{ display: "none" }} />
                  {t === "document" ? "📄 Document" : "🔢 ID Number"}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Options */}
          {type === "document" && (
            <fieldset style={S.fieldset}>
              <legend style={S.legend}>Options</legend>
              <label style={S.checkbox}>
                <input type="checkbox" checked={requireSelfie} onChange={(e) => setSelfie(e.target.checked)} />
                Require matching selfie
              </label>
              <label style={S.checkbox}>
                <input type="checkbox" checked={requireIdNum} onChange={(e) => setIdNum(e.target.checked)} />
                Require ID number extraction
              </label>
            </fieldset>
          )}

          <div style={S.divider} />

          <button style={S.btn(loading || !stripeLoaded)} disabled={loading || !stripeLoaded} onClick={startVerification}>
            {loading ? "⏳ Starting…" : !stripeLoaded ? "Loading Stripe.js…" : "🔍 Start Verification"}
          </button>

          {result && (
            <pre style={S.resultBox(result.type)}>{result.message}</pre>
          )}
        </div>

        {/* Integration notes */}
        <div style={S.infoBox}>
          <strong>Base44 / DateRealGirls Integration Notes</strong>
          <br /><br />
          <strong>1. Backend (Base44 custom action or Next.js API route):</strong><br />
          Call <code style={S.code}>POST /api/identity/session</code> server-side with your Stripe secret key.
          Return the <code style={S.code}>client_secret</code> to the frontend.<br /><br />
          <strong>2. Frontend (Base44 page or Next.js component):</strong><br />
          Load <code style={S.code}>https://js.stripe.com/v3/</code>, then call<br />
          <code style={S.code}>stripe.verifyIdentity(clientSecret)</code> to open the modal.<br /><br />
          <strong>3. Webhook (to update member status after verification):</strong><br />
          Listen for <code style={S.code}>identity.verification_session.verified</code> at<br />
          <code style={S.code}>/api/webhooks/stripe</code> and set the member&apos;s verified flag in your DB.<br /><br />
          <strong>4. Test mode documents:</strong><br />
          Use Stripe&apos;s <a href="https://docs.stripe.com/identity/test-mode" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>test identity documents</a> to simulate pass/fail scenarios without real IDs.
        </div>
      </main>
    </div>
  );
}
