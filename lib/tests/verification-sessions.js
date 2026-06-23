import { stripe, BASE_URL, createLogger } from "../stripe-client.js";

/**
 * Test Suite: Stripe Identity – Verification Sessions
 *
 * Covers the full VerificationSession lifecycle:
 *   create → retrieve → list → cancel → redact
 *
 * Docs: https://docs.stripe.com/api/identity/verification_sessions
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Verification Sessions tests…");

  let createdSessionId = null;

  // ── 1. Create a VerificationSession (document + selfie) ─────────────────────
  try {
    log.info("Creating VerificationSession (type=document)…");
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      metadata: { source: "stripe-identity-tester", test: "true" },
      return_url: `${BASE_URL}/verify/complete`,
    });

    createdSessionId = session.id;
    log.ok("VerificationSession created", {
      id:           session.id,
      status:       session.status,
      type:         session.type,
      client_secret: session.client_secret
        ? session.client_secret.substring(0, 30) + "…"
        : null,
      url:          session.url,
    });
  } catch (err) {
    log.error("Create VerificationSession failed", {
      message: err.message,
      code:    err.code,
    });
  }

  // ── 2. Retrieve the session we just created ──────────────────────────────────
  const sessionId = createdSessionId ?? process.env.TEST_VERIFICATION_SESSION_ID;
  if (sessionId) {
    try {
      log.info(`Retrieving VerificationSession ${sessionId}…`);
      const session = await stripe.identity.verificationSessions.retrieve(sessionId);
      log.ok("VerificationSession retrieved", {
        id:           session.id,
        status:       session.status,
        type:         session.type,
        created:      new Date(session.created * 1000).toISOString(),
        last_error:   session.last_error ?? null,
      });
    } catch (err) {
      log.error("Retrieve VerificationSession failed", {
        message: err.message,
        code:    err.code,
      });
    }
  } else {
    log.info("Skipping retrieve — no session ID available (create must have failed)");
  }

  // ── 3. List VerificationSessions ────────────────────────────────────────────
  try {
    log.info("Listing VerificationSessions (limit=5)…");
    const list = await stripe.identity.verificationSessions.list({ limit: 5 });
    log.ok(`Listed ${list.data.length} session(s)`, {
      ids:      list.data.map((s) => s.id),
      statuses: list.data.map((s) => s.status),
      has_more: list.has_more,
    });
  } catch (err) {
    log.error("List VerificationSessions failed", {
      message: err.message,
      code:    err.code,
    });
  }

  // ── 4. Create a second session then cancel it ────────────────────────────────
  try {
    log.info("Creating second VerificationSession to test cancel…");
    const toCancel = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { source: "stripe-identity-tester", purpose: "cancel-test" },
      return_url: `${BASE_URL}/verify/complete`,
    });
    log.ok("Second session created", { id: toCancel.id, status: toCancel.status });

    log.info(`Cancelling session ${toCancel.id}…`);
    const cancelled = await stripe.identity.verificationSessions.cancel(toCancel.id);
    log.ok("VerificationSession cancelled", {
      id:     cancelled.id,
      status: cancelled.status,   // should be "canceled"
    });
  } catch (err) {
    log.error("Cancel VerificationSession failed", {
      message: err.message,
      code:    err.code,
    });
  }

  // ── 5. Redact a session (removes PII) ───────────────────────────────────────
  // NOTE: A session must be canceled or verified before it can be redacted.
  //       We use the session cancelled in step 4 if possible, but we don't
  //       hold the reference — create a fresh one and cancel it first.
  try {
    log.info("Creating session to test redact (cancel first, then redact)…");
    const toRedact = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { source: "stripe-identity-tester", purpose: "redact-test" },
      return_url: `${BASE_URL}/verify/complete`,
    });
    await stripe.identity.verificationSessions.cancel(toRedact.id);
    log.info(`Redacting session ${toRedact.id}…`);
    const redacted = await stripe.identity.verificationSessions.redact(toRedact.id);
    log.ok("VerificationSession redacted", {
      id:       redacted.id,
      status:   redacted.status,    // "redacted"
      redaction: redacted.redaction,
    });
  } catch (err) {
    log.error("Redact VerificationSession failed", {
      message: err.message,
      code:    err.code,
    });
  }
}
