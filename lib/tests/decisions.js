import { didit, createLogger } from "../didit-client.js";

/**
 * Test Suite: Didit – Decisions
 *
 * Retrieves and displays the full decision payload for a completed session.
 * A decision includes per-feature results (id_verifications[], liveness_checks[],
 * face_matches[], aml_screenings[], etc.) and overall warnings.
 *
 * Requires: TEST_SESSION_ID in .env.local (from a previously completed verification)
 * Docs: https://docs.didit.me/sessions-api/retrieve-session
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Decisions tests…");

  const sessionId = process.env.TEST_SESSION_ID;

  if (!sessionId || sessionId === "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") {
    log.info(
      "TEST_SESSION_ID is not set — complete a real verification via the /verify page, then paste the session_id into .env.local",
      { env_var: "TEST_SESSION_ID" }
    );
    return;
  }

  // ── 1. Retrieve the full decision ────────────────────────────────────────────
  try {
    log.info(`Retrieving decision for session ${sessionId}…`);
    const d = await didit.sessions.retrieve(sessionId);

    log.ok("Decision retrieved — top-level summary", {
      session_id:     d.session_id,
      session_number: d.session_number,
      status:         d.status,
      features:       d.features ?? [],
      vendor_data:    d.vendor_data,
      created_at:     d.created_at,
    });

    // ── ID Verification results ──────────────────────────────────────────────
    const idChecks = d.id_verifications ?? [];
    if (idChecks.length > 0) {
      for (const check of idChecks) {
        log.ok(`ID Verification [${check.node_id}]`, {
          status:         check.status,
          document_type:  check.document_type,
          first_name:     check.first_name,
          last_name:      check.last_name,
          date_of_birth:  check.date_of_birth,
          issuing_state:  check.issuing_state,
          expiration_date: check.expiration_date,
          warnings:       (check.warnings ?? []).map((w) => w.risk),
        });
      }
    } else {
      log.info("No ID Verification results in this decision");
    }

    // ── Liveness results ─────────────────────────────────────────────────────
    const liveness = d.liveness_checks ?? [];
    if (liveness.length > 0) {
      for (const check of liveness) {
        log.ok(`Liveness [${check.node_id}]`, {
          status:   check.status,
          method:   check.method,
          score:    check.score,
          warnings: (check.warnings ?? []).map((w) => w.risk),
        });
      }
    }

    // ── Face Match results ───────────────────────────────────────────────────
    const faceMatches = d.face_matches ?? [];
    if (faceMatches.length > 0) {
      for (const check of faceMatches) {
        log.ok(`Face Match [${check.node_id}]`, {
          status:   check.status,
          score:    check.score,
          warnings: (check.warnings ?? []).map((w) => w.risk),
        });
      }
    }

    // ── AML Screening results ────────────────────────────────────────────────
    const aml = d.aml_screenings ?? [];
    if (aml.length > 0) {
      for (const check of aml) {
        log.ok(`AML Screening [${check.node_id}]`, {
          status:      check.status,
          entity_type: check.entity_type,
          total_hits:  check.total_hits,
          hits:        (check.hits ?? []).map((h) => h.name ?? h.type),
        });
      }
    }

    // ── Reviews ──────────────────────────────────────────────────────────────
    const reviews = d.reviews ?? [];
    if (reviews.length > 0) {
      for (const review of reviews) {
        log.info(`Manual Review [${review.node_id}]`, {
          status: review.status,
          notes:  review.notes,
        });
      }
    }

    // ── Overall warnings summary ─────────────────────────────────────────────
    const allWarnings = [
      ...(idChecks.flatMap((c) => c.warnings ?? [])),
      ...(liveness.flatMap((c) => c.warnings ?? [])),
      ...(faceMatches.flatMap((c) => c.warnings ?? [])),
      ...(aml.flatMap((c) => c.warnings ?? [])),
    ];

    if (allWarnings.length > 0) {
      log.info(`${allWarnings.length} warning(s) across all features`, {
        risks: allWarnings.map((w) => ({
          feature: w.feature,
          risk:    w.risk,
          desc:    w.short_description,
        })),
      });
    } else {
      log.ok("No warnings across any feature — clean decision");
    }
  } catch (err) {
    if (err.status === 404) {
      log.error(`Session ${sessionId} not found — it may have been deleted`, {
        message: err.message,
      });
    } else {
      log.error("Retrieve decision failed", { message: err.message, status: err.status });
    }
  }
}
