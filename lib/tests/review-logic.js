import { createLogger } from "../didit-client.js";
import { evaluateVerification, mapGender, MIN_AGE } from "../review-logic.js";

/**
 * Test Suite: Age & Gender Review Logic
 *
 * Exercises the age/gender cross-check rules added to the production Didit
 * webhook handler (didit-id-verification-webhook): gender-code mapping,
 * mismatch/unknown detection, underage/age-mismatch/DOB-mismatch/unknown-age
 * detection, and the hard-reject vs. flag-for-review admin-setting branch.
 *
 * Pure logic — no network calls, no env vars required. See lib/review-logic.js
 * for the shared implementation used here and by the live webhook route.
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Age & Gender Review Logic tests…");

  const scenarios = [
    {
      name: "Clean match — auto-verifies",
      input: {
        diditGender: "F", diditDob: "1990-01-01", diditAge: 36,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "auto_verified", gender_review_needed: false, age_review_needed: false },
    },
    {
      name: "Gender mismatch (document says M, profile says female) → flagged for review",
      input: {
        diditGender: "M", diditDob: "1990-01-01", diditAge: 36,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: true, age_review_needed: false },
    },
    {
      name: 'Gender unknown ("U" on document) → flagged for review',
      input: {
        diditGender: "U", diditDob: "1990-01-01", diditAge: 36,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: true, age_review_needed: false },
    },
    {
      name: `Underage (< ${MIN_AGE}) → flagged for review`,
      input: {
        diditGender: "F", diditDob: "2012-01-01", diditAge: 14,
        profile: { gender: "female", age: 14, date_of_birth: "2012-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: false, age_review_needed: true },
    },
    {
      name: "Age mismatch (> 1yr vs. profile) → flagged for review",
      input: {
        diditGender: "F", diditDob: "1990-01-01", diditAge: 36,
        profile: { gender: "female", age: 40, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: false, age_review_needed: true },
    },
    {
      name: "DOB mismatch vs. profile → flagged for review",
      input: {
        diditGender: "F", diditDob: "1990-06-15", diditAge: 36,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: false, age_review_needed: true },
    },
    {
      name: "Age unextractable (webhook + decision fallback both missing it) → flagged for review",
      input: {
        diditGender: "F", diditDob: null, diditAge: null,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: false,
      },
      expect: { outcome: "flagged_for_review", gender_review_needed: false, age_review_needed: true },
    },
    {
      name: "Underage + hard_reject admin setting → auto-rejected, reason: underage",
      input: {
        diditGender: "F", diditDob: "2012-01-01", diditAge: 14,
        profile: { gender: "female", age: 14, date_of_birth: "2012-01-01" },
        hardReject: true,
      },
      expect: {
        outcome: "hard_rejected",
        verification_status: "rejected",
        verification_rejection_reason: "underage",
      },
    },
    {
      name: "Gender + age mismatch + hard_reject → reasons ordered, first is photo_mismatch",
      input: {
        diditGender: "M", diditDob: "1990-01-01", diditAge: 40,
        profile: { gender: "female", age: 36, date_of_birth: "1990-01-01" },
        hardReject: true,
      },
      expect: {
        outcome: "hard_rejected",
        verification_rejection_reason: "photo_mismatch",
      },
    },
    {
      name: "No on-file profile to compare (first-time verification) — age/gender still extracted, no mismatch possible",
      input: {
        diditGender: "F", diditDob: "1990-01-01", diditAge: 36,
        profile: {},
        hardReject: false,
      },
      expect: { outcome: "auto_verified", gender_review_needed: false, age_review_needed: false },
    },
  ];

  let passed = 0;
  for (const s of scenarios) {
    const result = evaluateVerification(s.input);
    const failures = Object.entries(s.expect).filter(([k, v]) => result[k] !== v);
    if (failures.length === 0) {
      passed++;
      log.ok(s.name, {
        outcome: result.outcome,
        gender_review_needed: result.gender_review_needed,
        age_review_needed: result.age_review_needed,
        ...(result.verification_rejection_reason ? { rejection_reason: result.verification_rejection_reason } : {}),
      });
    } else {
      log.error(`${s.name} — mismatch on ${failures.map(([k]) => k).join(", ")}`, {
        expected: s.expect,
        actual: result,
      });
    }
  }

  log.info(`${passed}/${scenarios.length} scenario(s) passed`);

  // ── Gender code mapping edge cases ───────────────────────────────────────
  log.info("Verifying raw gender-code mapping…");
  const mapChecks = [
    ["M", "male"],
    ["F", "female"],
    ["U", null],
    [null, null],
    [undefined, null],
  ];
  let mapOk = true;
  for (const [raw, expected] of mapChecks) {
    const got = mapGender(raw);
    if (got !== expected) {
      mapOk = false;
      log.error(`mapGender(${JSON.stringify(raw)}) → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    }
  }
  if (mapOk) {
    log.ok("Gender code mapping correct (M→male, F→female, U/null/undefined→null)");
  }
}
