import { didit, DIDIT_BASE_URL, createLogger } from "../didit-client.js";

/**
 * Test Suite: Didit – Configuration & API Health
 *
 * Verifies the API key is valid, the workflow ID is configured, and that the
 * account can create sessions (i.e. has credits or is in sandbox mode).
 *
 * Docs: https://docs.didit.me/getting-started/quick-start
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Configuration & API Health tests…");

  log.info(`API base URL: ${DIDIT_BASE_URL}`);

  // ── 1. Verify API key by listing sessions ───────────────────────────────────
  try {
    log.info("Verifying API key via GET /v3/sessions (limit=1)…");
    const result = await didit.sessions.list({ limit: 1 });
    log.ok("API key valid — sessions endpoint reachable", {
      count:    result?.count ?? result?.results?.length ?? "unknown",
      has_next: !!result?.next,
    });
  } catch (err) {
    if (err.status === 403) {
      log.error(
        "API key is invalid or missing. Get your key from: https://business.didit.me → API & Webhooks → API Keys",
        { message: err.message }
      );
    } else {
      log.error("API key validation failed", { message: err.message, status: err.status });
    }
    return; // no point running further tests
  }

  // ── 2. Check workflow ID is configured ──────────────────────────────────────
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!workflowId || workflowId === "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") {
    log.error(
      "DIDIT_WORKFLOW_ID is not set. Create a workflow at: https://business.didit.me → Workflows, then paste its UUID into .env.local",
      { env_var: "DIDIT_WORKFLOW_ID" }
    );
    return;
  }
  log.ok("DIDIT_WORKFLOW_ID is configured", { workflow_id: workflowId });

  // ── 3. Probe by creating + immediately deleting a test session ───────────────
  try {
    log.info("Probing session creation (create + immediate delete)…");
    const session = await didit.sessions.create({
      workflow_id: workflowId,
      vendor_data: `health-check-${Date.now()}`,
      callback:    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/verify/complete`,
      metadata:    { source: "id-verify-tester", purpose: "health-check" },
    });

    log.ok("Session created successfully — Didit Identity is operational", {
      session_id: session.session_id,
      status:     session.status,
      url_prefix: session.url?.substring(0, 40) + "…",
    });

    // Clean up immediately
    await didit.sessions.delete(session.session_id);
    log.info(`Probe session ${session.session_id} deleted (cleanup)`);
  } catch (err) {
    if (err.status === 400 && err.message?.includes("credits")) {
      log.error(
        "Account has no credits. Top up at: https://business.didit.me (sandbox applications bypass the credit check)",
        { message: err.message }
      );
    } else if (err.status === 400 && err.message?.includes("workflow_id")) {
      log.error(
        "Invalid DIDIT_WORKFLOW_ID — check the UUID in your .env.local matches a published workflow in the Didit console",
        { message: err.message, workflow_id: process.env.DIDIT_WORKFLOW_ID }
      );
    } else {
      log.error("Session creation probe failed", { message: err.message, status: err.status });
    }
  }

  // ── 4. Environment info ──────────────────────────────────────────────────────
  log.info(
    "Tip: Didit uses separate Sandbox and Live applications. Create a Sandbox app at https://business.didit.me for free testing (no credits needed).",
    { docs: "https://docs.didit.me/getting-started/quick-start" }
  );
}
