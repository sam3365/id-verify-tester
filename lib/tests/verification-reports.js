import { stripe, createLogger } from "../stripe-client.js";

/**
 * Test Suite: Stripe Identity – Verification Reports
 *
 * VerificationReports are created automatically by Stripe when a
 * VerificationSession is submitted. In test mode Stripe may not have
 * real reports unless the hosted flow was completed, so we list whatever
 * exists and optionally retrieve a specific one from TEST_VERIFICATION_REPORT_ID.
 *
 * Docs: https://docs.stripe.com/api/identity/verification_reports
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Verification Reports tests…");

  // ── 1. List VerificationReports ─────────────────────────────────────────────
  try {
    log.info("Listing VerificationReports (limit=5)…");
    const list = await stripe.identity.verificationReports.list({ limit: 5 });

    if (list.data.length === 0) {
      log.info(
        "No VerificationReports found. Complete at least one hosted identity check to generate reports.",
        { has_more: list.has_more }
      );
    } else {
      log.ok(`Listed ${list.data.length} report(s)`, {
        ids:   list.data.map((r) => r.id),
        types: list.data.map((r) => r.type),
      });
    }
  } catch (err) {
    log.error("List VerificationReports failed", {
      message: err.message,
      code:    err.code,
    });
  }

  // ── 2. Retrieve a specific report ───────────────────────────────────────────
  const reportId = process.env.TEST_VERIFICATION_REPORT_ID;
  if (reportId) {
    try {
      log.info(`Retrieving VerificationReport ${reportId}…`);
      const report = await stripe.identity.verificationReports.retrieve(reportId);
      log.ok("VerificationReport retrieved", {
        id:      report.id,
        type:    report.type,
        created: new Date(report.created * 1000).toISOString(),
        // Document check results
        document_status:    report.document?.status   ?? null,
        document_error:     report.document?.error    ?? null,
        // Selfie check results
        selfie_status:      report.selfie?.status     ?? null,
        selfie_error:       report.selfie?.error      ?? null,
        // ID number check results (if applicable)
        id_number_status:   report.id_number?.status  ?? null,
      });
    } catch (err) {
      log.error("Retrieve VerificationReport failed", {
        message: err.message,
        code:    err.code,
      });
    }
  } else {
    log.info(
      "Skipping single-report retrieve — set TEST_VERIFICATION_REPORT_ID in .env.local to enable"
    );
  }

  // ── 3. List reports for a specific session ───────────────────────────────────
  const sessionId = process.env.TEST_VERIFICATION_SESSION_ID;
  if (sessionId) {
    try {
      log.info(`Listing VerificationReports for session ${sessionId}…`);
      const list = await stripe.identity.verificationReports.list({
        verification_session: sessionId,
        limit: 10,
      });
      log.ok(`Found ${list.data.length} report(s) for session`, {
        ids:     list.data.map((r) => r.id),
        session: sessionId,
      });
    } catch (err) {
      log.error("List reports by session failed", {
        message: err.message,
        code:    err.code,
      });
    }
  } else {
    log.info(
      "Skipping session-filtered report list — set TEST_VERIFICATION_SESSION_ID in .env.local to enable"
    );
  }
}
