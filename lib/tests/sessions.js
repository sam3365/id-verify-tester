import { didit, BASE_URL, createLogger } from "../didit-client.js";

/**
 * Test Suite: Didit – Sessions
 *
 * Covers the full VerificationSession lifecycle:
 *   create → retrieve decision → list → delete
 *
 * Requires: DIDIT_WORKFLOW_ID in .env.local
 * Docs: https://docs.didit.me/sessions-api/overview
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Sessions tests…");

  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!workflowId || workflowId === "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") {
    log.error(
      "DIDIT_WORKFLOW_ID is not set — skipping create/retrieve tests. Add it to .env.local.",
      { env_var: "DIDIT_WORKFLOW_ID" }
    );
    // Still run list test
  }

  let createdSessionId = null;

  // ── 1. Create a session ──────────────────────────────────────────────────────
  if (workflowId) {
    try {
      log.info(`Creating session with workflow ${workflowId}…`);
      const session = await didit.sessions.create({
        workflow_id:  workflowId,
        vendor_data:  `test-user-${Date.now()}`,
        callback:     `${BASE_URL}/verify/complete`,
        callback_method: "both",
        metadata:     { source: "id-verify-tester", suite: "sessions" },
        language:     "en",
      });

      createdSessionId = session.session_id;
      log.ok("Session created", {
        session_id:     session.session_id,
        session_number: session.session_number,
        status:         session.status,         // "Not Started"
        workflow_id:    session.workflow_id,
        url:            session.url,
      });
    } catch (err) {
      log.error("Create session failed", { message: err.message, status: err.status, data: err.data });
    }
  }

  // ── 2. Retrieve decision for the session we just created ─────────────────────
  const sessionId = createdSessionId ?? process.env.TEST_SESSION_ID;
  if (sessionId) {
    try {
      log.info(`Retrieving decision for session ${sessionId}…`);
      const decision = await didit.sessions.retrieve(sessionId);
      log.ok("Decision retrieved", {
        session_id:       decision.session_id,
        session_number:   decision.session_number,
        status:           decision.status,
        features:         decision.features ?? [],
        id_verifications: (decision.id_verifications ?? []).length,
        liveness_checks:  (decision.liveness_checks ?? []).length,
        face_matches:     (decision.face_matches ?? []).length,
        aml_screenings:   (decision.aml_screenings ?? []).length,
      });
    } catch (err) {
      log.error("Retrieve decision failed", { message: err.message, status: err.status });
    }
  } else {
    log.info("Skipping retrieve — no session ID available (set TEST_SESSION_ID in .env.local)");
  }

  // ── 3. List sessions ────────────────────────────────────────────────────────
  try {
    log.info("Listing sessions (limit=5)…");
    const result = await didit.sessions.list({ limit: 5 });

    const sessions = result?.results ?? result?.data ?? [];
    const count    = result?.count ?? sessions.length;

    log.ok(`Listed ${sessions.length} session(s) (${count} total)`, {
      ids:      sessions.map((s) => s.session_id),
      statuses: sessions.map((s) => s.status),
      has_next: !!result?.next,
    });
  } catch (err) {
    log.error("List sessions failed", { message: err.message, status: err.status });
  }

  // ── 4. Create a second session just to delete it ─────────────────────────────
  if (workflowId) {
    try {
      log.info("Creating a second session to test deletion…");
      const toDelete = await didit.sessions.create({
        workflow_id: workflowId,
        vendor_data: `delete-test-${Date.now()}`,
        callback:    `${BASE_URL}/verify/complete`,
        metadata:    { source: "id-verify-tester", purpose: "delete-test" },
      });
      log.ok("Second session created", {
        session_id: toDelete.session_id,
        status:     toDelete.status,
      });

      log.info(`Deleting session ${toDelete.session_id}…`);
      await didit.sessions.delete(toDelete.session_id);
      log.ok("Session deleted successfully", { session_id: toDelete.session_id });
    } catch (err) {
      log.error("Create-then-delete test failed", { message: err.message, status: err.status });
    }
  }

  // ── 5. Clean up the session created in step 1 ────────────────────────────────
  if (createdSessionId) {
    try {
      await didit.sessions.delete(createdSessionId);
      log.info(`Session ${createdSessionId} deleted (cleanup)`);
    } catch {
      // Non-fatal — session may already be gone
    }
  }
}
