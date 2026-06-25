"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /lookup — Query a Didit session decision by session_id.
 *
 * WEBHOOK TRIGGER:
 *   Listen for webhook_type === "status.updated" && status === "Approved"
 *   The body.session_id is your lookup key.
 *   Store it alongside vendor_data (your internal user ID) in your DB.
 *
 * LOOKUP KEY:
 *   session_id  →  GET /api/identity/lookup/{session_id}
 *                  which calls Didit: GET /v3/session/{session_id}/decision/
 *
 * Returns: name, DOB, nationality, address, document type/number/country,
 *          expiry, document front image, document back image, selfie image.
 */

const S = {
  wrap:    { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" },
  h1:      { display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", fontWeight: 700 },
  navRow:  { display: "flex", gap: 8 },
  navLink: { fontSize: "0.82rem", color: "var(--text-dim)", textDecoration: "none", padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface2)" },
  main:    { maxWidth: 820, margin: "36px auto", padding: "0 24px" },

  // Search card
  searchCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "24px 28px", marginBottom: 24 },
  label:   { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 8 },
  inputRow:{ display: "flex", gap: 10 },
  input:   { flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.88rem", fontFamily: "var(--font-mono)" },
  btn:     (loading) => ({
    padding: "10px 22px", borderRadius: 8, border: "none",
    background: loading ? "var(--surface2)" : "var(--accent)",
    color: loading ? "var(--text-dim)" : "#fff",
    fontWeight: 600, fontSize: "0.88rem", cursor: loading ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  }),
  hint:    { marginTop: 8, fontSize: "0.75rem", color: "var(--text-dim)" },

  // Result sections
  section: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 16 },
  h2:      { fontSize: "0.95rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
  grid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" },
  kv:      { padding: "6px 0", borderBottom: "1px solid var(--border)" },
  kvLabel: { fontSize: "0.7rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em" },
  kvVal:   { fontSize: "0.85rem", color: "var(--text)", fontFamily: "var(--font-mono)", marginTop: 2, wordBreak: "break-all" },
  kvNone:  { fontSize: "0.85rem", color: "var(--text-dim)", fontStyle: "italic", marginTop: 2 },

  // Status badge
  badge:   (status) => {
    const map = {
      Approved:    { bg: "rgba(34,197,94,0.15)",  color: "#22c55e" },
      Declined:    { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
      "In Review": { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    };
    const c = map[status] ?? { bg: "rgba(37,103,255,0.12)", color: "#2567ff" };
    return { padding: "2px 10px", borderRadius: 999, fontWeight: 700, fontSize: "0.8rem", background: c.bg, color: c.color };
  },

  // Images
  imgGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 4 },
  imgCard: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  imgLabel:{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em", padding: "6px 10px", borderBottom: "1px solid var(--border)" },
  img:     { width: "100%", display: "block", maxHeight: 200, objectFit: "cover" },
  imgUrl:  { padding: "6px 10px", fontSize: "0.68rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", wordBreak: "break-all", lineHeight: 1.4 },

  // Warnings
  warnBadge: { display: "inline-block", background: "rgba(239,68,68,0.1)", color: "var(--err)", border: "1px solid var(--err)", borderRadius: 4, fontSize: "0.72rem", padding: "2px 7px", marginRight: 4, marginBottom: 4 },

  // Raw JSON
  pre:  { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: "0.74rem", whiteSpace: "pre-wrap", overflowX: "auto", color: "var(--text-dim)", marginTop: 8 },
  err:  { background: "rgba(239,68,68,0.07)", border: "1px solid var(--err)", borderRadius: 8, padding: "12px 16px", fontSize: "0.85rem", color: "var(--err)", marginBottom: 16 },

  infoBox: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 18px", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 20 },
  code:    { fontFamily: "var(--font-mono)", background: "var(--surface)", padding: "1px 5px", borderRadius: 4, fontSize: "0.76rem", color: "var(--text)" },
};

function KV({ label, value }) {
  return (
    <div style={S.kv}>
      <div style={S.kvLabel}>{label}</div>
      {value != null && value !== ""
        ? <div style={S.kvVal}>{String(value)}</div>
        : <div style={S.kvNone}>—</div>}
    </div>
  );
}

function ImageCard({ label, url }) {
  if (!url) return null;
  return (
    <div style={S.imgCard}>
      <div style={S.imgLabel}>{label}</div>
      <img src={url} alt={label} style={S.img} onError={(e) => { e.target.style.display = "none"; }} />
      <div style={S.imgUrl}>{url}</div>
    </div>
  );
}

export default function LookupPage() {
  const [sessionId, setSessionId] = useState(process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID ?? "");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [showRaw, setShowRaw]     = useState(false);

  const lookup = async () => {
    const id = sessionId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowRaw(false);

    try {
      const res  = await fetch(`/api/identity/lookup/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const subj = result?.subject;
  const imgs = subj?.images ?? {};
  const doc  = subj?.document ?? {};
  const hasImages = imgs.front || imgs.back || imgs.selfie;

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.h1}><span style={{ fontSize: "1.5rem" }}>🔎</span> Identity Lookup</h1>
        <nav style={S.navRow}>
          <Link href="/verify"   style={S.navLink}>🪪 Verify</Link>
          <Link href="/webhooks" style={S.navLink}>🔔 Webhooks</Link>
          <Link href="/"         style={S.navLink}>← Dashboard</Link>
        </nav>
      </header>

      <main style={S.main}>

        {/* How to get the session_id */}
        <div style={S.infoBox}>
          <strong>Webhook trigger:</strong>{" "}
          <code style={S.code}>webhook_type === &quot;status.updated&quot;</code> +{" "}
          <code style={S.code}>status === &quot;Approved&quot;</code>
          <br />
          <strong>Lookup key:</strong> <code style={S.code}>body.session_id</code> from the webhook envelope.
          Store it in your DB alongside <code style={S.code}>vendor_data</code> (your internal user ID),
          then call this page (or <code style={S.code}>GET /api/identity/lookup/{"{session_id}"}</code>) to
          retrieve the full user record including name, DOB, address, document images, and liveness selfie.
        </div>

        {/* Search */}
        <div style={S.searchCard}>
          <label style={S.label}>Session ID</label>
          <div style={S.inputRow}>
            <input
              style={S.input}
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
            />
            <button style={S.btn(loading)} disabled={loading} onClick={lookup}>
              {loading ? "⏳ Loading…" : "🔎 Look up"}
            </button>
          </div>
          <p style={S.hint}>
            Find the session_id in the Webhooks tab or from a completed verification on the Verify page.
            Set <code style={S.code}>NEXT_PUBLIC_DEFAULT_SESSION_ID</code> in .env.local to pre-fill this field.
          </p>
        </div>

        {/* Error */}
        {error && <div style={S.err}>⚠ {error}</div>}

        {result && (
          <>
            {/* Session summary */}
            <div style={S.section}>
              <div style={S.h2}>
                📋 Session Summary
                <span style={S.badge(result.status)}>{result.status}</span>
              </div>
              <div style={S.grid}>
                <KV label="Session ID"     value={result.session_id} />
                <KV label="Session #"      value={result.session_number} />
                <KV label="Vendor Data"    value={result.vendor_data} />
                <KV label="Features"       value={(result.features ?? []).join(", ")} />
                <KV label="Created"        value={result.created_at ? new Date(result.created_at * 1000).toLocaleString() : null} />
              </div>
            </div>

            {/* Subject / personal info */}
            {subj && (
              <div style={S.section}>
                <div style={S.h2}>👤 Personal Information</div>
                <div style={S.grid}>
                  <KV label="Full Name"      value={subj.name} />
                  <KV label="Date of Birth"  value={subj.date_of_birth} />
                  <KV label="Nationality"    value={subj.nationality} />
                  <KV label="Gender"         value={subj.gender} />
                  {subj.address && typeof subj.address === "object" ? (
                    <>
                      <KV label="Address Line 1" value={subj.address.line1 ?? subj.address.street} />
                      <KV label="City"           value={subj.address.city} />
                      <KV label="State / Region" value={subj.address.state ?? subj.address.region} />
                      <KV label="Postal Code"    value={subj.address.postal_code ?? subj.address.zip} />
                      <KV label="Country"        value={subj.address.country} />
                    </>
                  ) : (
                    <KV label="Address" value={subj.address} />
                  )}
                </div>
              </div>
            )}

            {/* Document info */}
            {subj && (
              <div style={S.section}>
                <div style={S.h2}>🪪 Document</div>
                <div style={S.grid}>
                  <KV label="Type"           value={doc.type} />
                  <KV label="Number"         value={doc.number} />
                  <KV label="Issuing Country"value={doc.country} />
                  <KV label="Issuing State"  value={doc.state} />
                  <KV label="Issue Date"     value={doc.issued} />
                  <KV label="Expiry Date"    value={doc.expires} />
                </div>
              </div>
            )}

            {/* Document + selfie images */}
            {hasImages && (
              <div style={S.section}>
                <div style={S.h2}>📷 Images</div>
                <div style={S.imgGrid}>
                  <ImageCard label="Document — Front" url={imgs.front} />
                  <ImageCard label="Document — Back"  url={imgs.back} />
                  <ImageCard label="Selfie (Liveness)" url={imgs.selfie} />
                </div>
                <p style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Image URLs are signed and time-limited. If they return 403, re-fetch the decision.
                </p>
              </div>
            )}

            {/* Liveness */}
            {result.liveness_checks?.length > 0 && (
              <div style={S.section}>
                <div style={S.h2}>👁 Liveness Checks</div>
                {result.liveness_checks.map((l, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={S.grid}>
                      <KV label="Status" value={l.status} />
                      <KV label="Method" value={l.method} />
                      <KV label="Score"  value={l.score != null ? `${(l.score * 100).toFixed(1)}%` : null} />
                    </div>
                    {l.warnings?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {l.warnings.map((w, j) => <span key={j} style={S.warnBadge}>{w}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AML */}
            {result.aml_screenings?.some((a) => a.total_hits > 0) && (
              <div style={{ ...S.section, borderColor: "var(--err)" }}>
                <div style={S.h2}>⚠ AML Screening Hits</div>
                {result.aml_screenings.filter((a) => a.total_hits > 0).map((a, i) => (
                  <div key={i}>
                    <KV label="Status"     value={a.status} />
                    <KV label="Total Hits" value={a.total_hits} />
                    {a.hits.map((h, j) => (
                      <div key={j} style={{ marginTop: 4 }}>
                        <span style={S.warnBadge}>{h.type}</span>
                        <span style={{ fontSize: "0.8rem" }}>{h.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Raw JSON toggle */}
            <div style={S.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={S.h2}>📄 Raw Decision JSON</span>
                <button
                  style={{ ...S.navLink, cursor: "pointer", border: "1px solid var(--border)" }}
                  onClick={() => setShowRaw((v) => !v)}
                >
                  {showRaw ? "Hide" : "Show"}
                </button>
              </div>
              {showRaw && <pre style={S.pre}>{JSON.stringify(result.raw_decision, null, 2)}</pre>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
