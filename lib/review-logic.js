/**
 * Age & gender review logic — mirrors the checks added to the production
 * Didit ID-verification webhook (didit-id-verification-webhook, Base44
 * function) on the `status.updated` / "Approved" event.
 *
 * The production handler:
 *   1. Extracts gender, date_of_birth, and age from the webhook payload's
 *      id_verifications[0], falling back to GET /v3/session/{id}/decision/
 *      when any field is missing.
 *   2. Maps Didit's gender code (M/F/U) to a profile gender value and flags
 *      a mismatch (mapped != on-file) or an unknown code (U / absent).
 *   3. Validates age: under 18 ("underage"), more than 1 year off the
 *      on-file age ("mismatch"), a DOB that disagrees with the on-file DOB
 *      ("mismatch"), or an age that couldn't be extracted at all ("unknown").
 *   4. If any check needs review, either flags the profile for manual admin
 *      review, or — when the admin has set verification_mismatch_action to
 *      "hard_reject" — auto-rejects with an ordered reason list. A clean
 *      pass on both checks auto-verifies.
 *
 * This module extracts that decision tree into pure, dependency-free
 * functions so it can be exercised by both the live webhook route and a
 * dedicated test suite, without needing a real MemberProfile database.
 */

export const MIN_AGE = 18;
export const AGE_MISMATCH_TOLERANCE = 1; // years

/** Didit gender code → profile gender value. */
const GENDER_MAP = { M: "male", F: "female" };

/** Map a raw Didit gender code ("M" | "F" | "U" | null | undefined) to a profile value. */
export function mapGender(diditGender) {
  return GENDER_MAP[diditGender] ?? null;
}

/**
 * Compare the extracted (mapped) gender against the profile's on-file gender.
 * @returns {{mappedGender: string|null, genderMismatch: boolean, genderUnknown: boolean, reviewNeeded: boolean}}
 */
export function evaluateGender(diditGender, profileGender) {
  const mappedGender = mapGender(diditGender);
  const genderMismatch = !!(mappedGender && profileGender && mappedGender !== profileGender);
  const genderUnknown = !mappedGender; // "U" or missing from the document
  return {
    mappedGender,
    genderMismatch,
    genderUnknown,
    reviewNeeded: genderMismatch || genderUnknown,
  };
}

/**
 * Validate extracted age/DOB against the profile.
 * @returns {{ageUnderage: boolean, ageMismatch: boolean, ageUnknown: boolean, reviewNeeded: boolean}}
 */
export function evaluateAge(diditAge, diditDob, profile = {}) {
  let ageUnderage = false;
  let ageMismatch = false;
  let ageUnknown = false;

  if (diditAge !== null && diditAge !== undefined) {
    if (diditAge < MIN_AGE) {
      ageUnderage = true;
    } else if (profile.age != null && Math.abs(diditAge - profile.age) > AGE_MISMATCH_TOLERANCE) {
      ageMismatch = true;
    }
  } else {
    ageUnknown = true;
  }

  if (diditDob && profile.date_of_birth && diditDob !== profile.date_of_birth) {
    ageMismatch = true;
  }

  return {
    ageUnderage,
    ageMismatch,
    ageUnknown,
    reviewNeeded: ageUnderage || ageMismatch || ageUnknown,
  };
}

/**
 * Derive the ordered hard-reject reason codes from gender/age evaluation
 * results. Mirrors the production `reasons[]` construction exactly
 * (order matters — reasons[0] becomes verification_rejection_reason).
 */
export function determineRejectionReasons({ age, gender }) {
  const reasons = [];
  if (age.ageUnderage) reasons.push("underage");
  if (gender.genderMismatch || gender.genderUnknown) reasons.push("photo_mismatch");
  if (age.ageMismatch) reasons.push("invalid_id");
  if (age.ageUnknown) reasons.push("incomplete_verification");
  return reasons;
}

/**
 * Full Approved-status evaluation — mirrors the production webhook's
 * three-way branch: auto-verify (clean), flag-for-review, or hard-reject.
 *
 * @param {object}      params
 * @param {string|null} params.diditGender  Raw gender code from Didit ("M"|"F"|"U"|null)
 * @param {string|null} params.diditDob     Extracted date_of_birth (YYYY-MM-DD)
 * @param {number|null} params.diditAge     Extracted age
 * @param {object}      [params.profile]    On-file comparison values: { gender, age, date_of_birth }
 * @param {boolean}     [params.hardReject] Admin setting: verification_mismatch_action === 'hard_reject'
 */
export function evaluateVerification({ diditGender, diditDob, diditAge, profile = {}, hardReject = false }) {
  const gender = evaluateGender(diditGender, profile.gender);
  const age = evaluateAge(diditAge, diditDob, profile);

  const reviewNeeded = gender.reviewNeeded || age.reviewNeeded;

  if (!reviewNeeded) {
    return {
      outcome: "auto_verified",
      gender,
      age,
      gender_review_needed: false,
      age_review_needed: false,
      verification_status: "verified",
    };
  }

  if (hardReject) {
    const reasons = determineRejectionReasons({ age, gender });
    return {
      outcome: "hard_rejected",
      gender,
      age,
      gender_review_needed: gender.reviewNeeded,
      age_review_needed: age.reviewNeeded,
      verification_status: "rejected",
      verification_rejection_reason: reasons[0] || "other",
      verification_rejection_details: `Automatically rejected: ${reasons.join(", ") || "mismatch detected"}`,
      profile_review_status: "pending",
    };
  }

  return {
    outcome: "flagged_for_review",
    gender,
    age,
    gender_review_needed: gender.reviewNeeded,
    age_review_needed: age.reviewNeeded,
    profile_review_status: "pending",
  };
}
