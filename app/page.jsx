"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    display: "flex", flexDirection: "column", height: "100vh",
    background: "var(--bg)", color: "var(--text)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 28px", borderBottom: "1px solid var(--border)",
    background: "var(--surface)", flexShrink: 0,
  },
  h1: { display: "flex", alignItems: "center", gap: 10, fontSize: "1.2rem", fontWeight: 700 },
  badge: {
    fontSize: "0.7rem", background: "var(--accent)", color: "#fff",
    padding: "2px 8px", borderRadius: 999, fontWeight: 600, letterSpacing: ".04em",
  },
  statusBadge: (ok) => ({
    fontSize: "0.7rem",
    background: ok ? "#14532d" : "#92400e",
    color:      ok ? "#bbf7d0" : "#fde68a",
    border:     `1px solid ${ok ? "#16a34a" : "#d97706"}`,
    padding: "2px 10px", borderRadius: 999, fontWeight: 600, letterSpacing: ".04em",
    display: "flex", alignItems: "center", gap: 5,
  }),
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  navLink: {
    fontSize: "0.82rem", color: "var(--text-dim)",
    textDecoration: "none", padding: "5px 12px",
    border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface2)", transition: "color .15s, border-color .15s",
  },
  main: {
    display: "grid", gridTemplateColumns: "320px 1fr",
    flex: 1, overflow: "hidden",
  },
  aside: {
    borderRight: "1px solid var(--border)", background: "var(--surface)",
    overflowY: "auto", padding: "20px 16px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  runAllBtn: (disabled) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "12px", borderRadius: "var(--radius)", border: "none",
    background: "var(--accent)", color: "#fff", fontSize: "0.95rem",
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, transition: "background .15s",
    marginBottom: 4,
  }),
  card: () => ({
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "14px 16px", cursor: "default",
    transition: "border-color .15s, background .15s",
  }),
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardName: { fontWeight: 600, fontSize: "0.95rem" },
  cardDesc: { fontSize: "0.78rem", color: "var(--text-dim)", lineHeight: 1.4 },
  dot: (state) => ({
    width: 8, height: 8, borderRadius: "50%", flexShrink: 0, transition: "background .2s",
    background: state === "ok" ? "var(--ok)" : state === "error" ? "var(--err)" : state === "running" ? "var(--suite)" : "var(--border)",
    animation: state === "running" ? "pulse 1s infinite" : "none",
  }),
  runBtn: (running) => ({
    marginTop: 10, width: "100%", padding: "7px",
    borderRadius: 6, border: "1px solid var(--border)",
    background: "transparent", color: "var(--text)", fontSize: "0.82rem",
    cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.45 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "background .15s, border-color .15s",
  }),
  outputPanel: { display: "flex", flexDirection: "column", overflow: "hidden" },
  toolbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px", borderBottom: "1px solid var(--border)",
    background: "var(--surface)", flexShrink: 0,
  },
  toolbarTitle: { fontWeight: 600, fontSize: "0.95rem" },
  toolbarActions: { display: "flex", gap: 8 },
  iconBtn: {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text-dim)", padding: "5px 12px", borderRadius: 6,
    fontSize: "0.8rem", cursor: "pointer", transition: "color .15s, border-color .15s",
  },
  log: {
    flex: 1, overflowY: "auto", padding: "16px 20px",
    fontFamily: "var(--font-mono)", fontSize: "0.82rem", lineHeight: 1.6,
    background: "var(--bg)",
  },
  logEntry: {
    display: "flex", gap: 10, padding: "3px 0",
    borderBottom: "1px solid transparent", animation: "fadeIn .15s ease",
  },
  logTs: { color: "var(--text-dim)", flexShrink: 0, userSelect: "none" },
  logIcon: (level) => ({
    flexShrink: 0,
    color: level === "ok" ? "var(--ok)" : level === "error" ? "var(--err)" : level === "suite" ? "var(--suite)" : "var(--text-dim)",
  }),
  logMsg: (level) => ({
    color: level === "ok" ? "var(--ok)" : level === "error" ? "var(--err)"
      : level === "suite" ? "var(--suite)" : level === "done" ? "var(--text-dim)" : "var(--info)",
    fontWeight: level === "suite" ? 700 : 400,
    fontSize: level === "suite" ? "0.88rem" : "0.82rem",
    marginTop: level === "suite" ? 6 : 0,
    wordBreak: "break-word",
  }),
  logData: {
    marginTop: 4, padding: "8px 12px", background: "var(--surface2)",
    borderLeft: "2px solid var(--border)", borderRadius: 4,
    color: "var(--text-dim)", whiteSpace: "pre-wrap", overflowX: "auto",
    fontSize: "0.78rem",
  },
  statsBar: {
    display: "flex", gap: 20, padding: "8px 20px",
    borderTop: "1px solid var(--border)", background: "var(--surface)",
    fontSize: "0.78rem", color: "var(--text-dim)", flexShrink: 0,
  },
  stat: { display: "flex", alignItems: "center", gap: 5 },
  statDot: (color) => ({ width: 6, height: 6, borderRadius: "50%", background: color }),
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "100%", gap: 12, color: "var(--text-dim)",
  },
};

const ICONS = { ok: "✓", error: "✗", info: "·", suite: "▸", done: "—" };

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [suites, setSuites]       = useState([]);
  const [logs, setLogs]           = useState([]);
  const [cardState, setCardState] = useState({});
  const [running, setRunning]     = useState(false);
  const [stats, setStats]         = useState({ ok: 0, error: 0, elapsed: null });
  const [title, setTitle]         = useState("Output");
  const [env, setEnv]             = useState(null);
  const logRef   = useRef(null);
  const statsRef = useRef({ ok: 0, error: 0, startMs: 0 });

  useEffect(() => {
    fetch("/api/suites").then((r) => r.json()).then((data) => {
      setSuites(data);
      const initial = {};
      data.forEach((s) => (initial[s.id] = "idle"));
      setCardState(initial);
    });
    fetch("/api/env").then((r) => r.json()).then((data) => setEnv(data));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const appendLog = useCallback((entry) => {
    setLogs((prev) => [...prev, { ...entry, id: Date.now() + Math.random() }]);
  }, []);

  const runSuite = useCallback(async (id) => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    statsRef.current = { ok: 0, error: 0, startMs: Date.now() };
    setStats({ ok: 0, error: 0, elapsed: null });
    setTitle(id === "all" ? "All Suites" : suites.find((s) => s.id === id)?.label ?? id);

    setCardState((prev) => {
      const next = { ...prev };
      if (id === "all") suites.forEach((s) => (next[s.id] = "running"));
      else next[id] = "running";
      return next;
    });

    const evtSource = new EventSource(`/api/test/${id}`);

    evtSource.onmessage = (e) => {
      const entry = JSON.parse(e.data);

      if (entry.level === "done") {
        evtSource.close();
        const elapsed = ((Date.now() - statsRef.current.startMs) / 1000).toFixed(1);
        appendLog({ ...entry, message: `Finished in ${elapsed}s` });
        setStats({ ...statsRef.current, elapsed });
        setRunning(false);
        setCardState((prev) => {
          const next = { ...prev };
          if (id === "all") {
            suites.forEach((s) => (next[s.id] = statsRef.current.error > 0 ? "error" : "ok"));
          } else {
            next[id] = statsRef.current.error > 0 ? "error" : "ok";
          }
          return next;
        });
        return;
      }

      if (entry.level === "ok")    statsRef.current.ok++;
      if (entry.level === "error") statsRef.current.error++;
      setStats({ ...statsRef.current, elapsed: null });

      if (entry.level === "suite" && id === "all") {
        const suiteId = suites.find((s) => s.label === entry.message)?.id;
        if (suiteId) {
          setCardState((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => { if (next[k] === "running" && k !== suiteId) next[k] = "idle"; });
            next[suiteId] = "running";
            return next;
          });
        }
      }

      appendLog(entry);
    };

    evtSource.onerror = () => {
      evtSource.close();
      appendLog({ level: "error", message: "Connection lost — is the dev server running?" });
      setRunning(false);
      setCardState((prev) => {
        const next = { ...prev };
        if (id === "all") suites.forEach((s) => { if (next[s.id] === "running") next[s.id] = "error"; });
        else if (next[id] === "running") next[id] = "error";
        return next;
      });
    };
  }, [running, suites, appendLog]);

  const clearLog = () => {
    setLogs([]);
    setStats({ ok: 0, error: 0, elapsed: null });
    setTitle("Output");
  };

  const copyLog = () => {
    const text = logs.map((e) => {
      const ts   = new Date(e.id).toLocaleTimeString("en-US", { hour12: false });
      const data = e.data ? "\n" + JSON.stringify(e.data, null, 2) : "";
      return `[${ts}] ${e.message}${data}`;
    }).join("\n");
    navigator.clipboard.writeText(text);
  };

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  return (
    <div style={S.wrap}>
      {/* Header */}
      <header style={S.header}>
        <h1 style={S.h1}>
          <span style={{ fontSize: "1.5rem" }}>🪪</span>
          Didit Identity Tester
        </h1>
        <div style={S.headerRight}>
          {env && (
            <span style={S.statusBadge(env.hasKey && env.hasWorkflow)}>
              <span>{env.hasKey && env.hasWorkflow ? "✓" : "⚠️"}</span>
              {env.hasKey && env.hasWorkflow ? "Ready" : env.hasKey ? "No Workflow" : "No API Key"}
            </span>
          )}
          <Link href="/verify"   style={S.navLink}>🪪 Verify</Link>
          <Link href="/lookup"   style={S.navLink}>🔎 Lookup</Link>
          <Link href="/webhooks" style={S.navLink}>🔔 Webhooks</Link>
          <a href="https://business.didit.me" target="_blank" rel="noreferrer" style={S.navLink}>
            ↗ Console
          </a>
          <span style={S.badge}>DEV</span>
        </div>
      </header>

      <main style={S.main}>
        {/* Sidebar */}
        <aside style={S.aside}>
          <button style={S.runAllBtn(running)} disabled={running} onClick={() => runSuite("all")}>
            ▶ Run All Suites
          </button>

          {suites.map((suite) => {
            const state = cardState[suite.id] ?? "idle";
            return (
              <div key={suite.id} style={S.card()}>
                <div style={S.cardHeader}>
                  <span style={S.cardName}>{suite.label}</span>
                  <span style={S.dot(state)} />
                </div>
                <div style={S.cardDesc}>{suite.description}</div>
                <button
                  style={S.runBtn(running)}
                  disabled={running}
                  onClick={() => runSuite(suite.id)}
                >
                  {state === "running" ? (
                    <span style={{ animation: "spin .7s linear infinite", display: "inline-block" }}>↻</span>
                  ) : "▶ Run"}
                </button>
              </div>
            );
          })}
        </aside>

        {/* Output panel */}
        <section style={S.outputPanel}>
          <div style={S.toolbar}>
            <span style={S.toolbarTitle}>{title}</span>
            <div style={S.toolbarActions}>
              <button style={S.iconBtn} onClick={clearLog}>Clear</button>
              <button style={S.iconBtn} onClick={copyLog}>Copy</button>
            </div>
          </div>

          <div ref={logRef} style={S.log}>
            {logs.length === 0 ? (
              <div style={S.emptyState}>
                <span style={{ fontSize: "2.5rem" }}>🪪</span>
                <p style={{ fontSize: "0.9rem" }}>Select a suite and click Run to start testing.</p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Make sure DIDIT_API_KEY and DIDIT_WORKFLOW_ID are set in .env.local
                </p>
              </div>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} style={S.logEntry}>
                  <span style={S.logTs}>{now()}</span>
                  <span style={S.logIcon(entry.level)}>{ICONS[entry.level] ?? "·"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.logMsg(entry.level)}>{entry.message}</div>
                    {entry.data && (
                      <pre style={S.logData}>{JSON.stringify(entry.data, null, 2)}</pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Stats bar */}
          {(stats.ok > 0 || stats.error > 0 || stats.elapsed) && (
            <div style={S.statsBar}>
              <span style={S.stat}>
                <span style={S.statDot("var(--ok)")} />
                {stats.ok} passed
              </span>
              <span style={S.stat}>
                <span style={S.statDot("var(--err)")} />
                {stats.error} failed
              </span>
              {stats.elapsed && (
                <span style={S.stat}>
                  <span style={S.statDot("var(--text-dim)")} />
                  {stats.elapsed}s
                </span>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
