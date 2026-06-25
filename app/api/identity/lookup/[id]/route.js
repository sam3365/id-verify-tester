import { didit } from "@/lib/didit-client.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/identity/lookup/[id]
 *
 * Fetches the full decision for a session and extracts a structured
 * user profile: name, DOB, address, document type/country, and
 * document image URLs (front + back).
 *
 * LOOKUP KEY:
 *   Use the session_id from the webhook envelope — available on every
 *   webhook event as body.session_id.  The most reliable trigger is:
 *     webhook_type === "status.updated" && status === "Approved"
 *   because only then does Didit guarantee body.decision is populated.
 *
 * Docs: https://docs.didit.me/sessions-api/retrieve-session
 */
export async function GET(_req, { params }) {
  const { id: sessionId } = await params;

  try {
    const decision = await didit.sessions.retrieve(sessionId);

    // ── Primary ID Verification ──────────────────────────────────────────────
    // id_verifications[] is populated for document + OCR workflows.
    // A workflow can include multiple nodes; we surface all of them.
    const idVerifications = (decision.id_verifications ?? []).map((v) => ({
      node_id:        v.node_id,
      status:         v.status,
      // Personal info
      first_name:     v.first_name     ?? null,
      last_name:      v.last_name      ?? null,
      full_name:      v.full_name      ?? null,
      date_of_birth:  v.date_of_birth  ?? null,
      nationality:    v.nationality    ?? null,
      gender:         v.gender         ?? null,
      // Document info
      document_type:        v.document_type        ?? null,
      document_number:      v.document_number      ?? null,
      issuing_state:        v.issuing_state        ?? null,
      issuing_country:      v.issuing_country      ?? null,
      issuing_date:         v.issuing_date         ?? null,
      expiration_date:      v.expiration_date      ?? null,
      personal_number:      v.personal_number      ?? null,
      // Address (may be on the document or separately verified)
      address:              v.address              ?? null,
      // Document images — try all known Didit field name variants.
      // May be a signed URL (https://…) or a raw base64 string.
      document_front_image:
        v.document_front_image ?? v.front_image ?? v.id_front ??
        v.documentFrontImage   ?? v.front       ?? null,
      document_back_image:
        v.document_back_image  ?? v.back_image  ?? v.id_back  ??
        v.documentBackImage    ?? v.back        ?? null,
      // MRZ / barcode raw strings (useful for cross-checking)
      mrz_line1: v.mrz_line1 ?? null,
      mrz_line2: v.mrz_line2 ?? null,
      // Warnings
      warnings: (v.warnings ?? []).map((w) => ({ risk: w.risk, description: w.short_description })),
      // Raw node for debugging — lets UI find image fields even if names differ
      _raw: v,
    }));

    // ── Liveness ─────────────────────────────────────────────────────────────
    const livenessChecks = (decision.liveness_checks ?? []).map((l) => ({
      node_id:  l.node_id,
      status:   l.status,
      method:   l.method  ?? null,
      score:    l.score   ?? null,
      // Try all known portrait/selfie field name variants
      selfie_image:
        l.selfie_image  ?? l.portrait       ?? l.face_image  ??
        l.selfieImage   ?? l.portrait_image ?? l.photo       ?? null,
      warnings: (l.warnings ?? []).map((w) => w.risk),
    }));

    // ── Face Match ───────────────────────────────────────────────────────────
    const faceMatches = (decision.face_matches ?? []).map((f) => ({
      node_id:  f.node_id,
      status:   f.status,
      score:    f.score   ?? null,
      warnings: (f.warnings ?? []).map((w) => w.risk),
    }));

    // ── AML ──────────────────────────────────────────────────────────────────
    const amlScreenings = (decision.aml_screenings ?? []).map((a) => ({
      node_id:     a.node_id,
      status:      a.status,
      total_hits:  a.total_hits ?? 0,
      hits:        (a.hits ?? []).map((h) => ({ name: h.name, type: h.type, score: h.score })),
    }));

    // ── Convenience: primary subject from first approved ID verification ─────
    const primary = idVerifications.find((v) => v.status === "Approved") ?? idVerifications[0] ?? null;

    return Response.json({
      // Session summary
      session_id:     decision.session_id,
      session_number: decision.session_number,
      status:         decision.status,
      vendor_data:    decision.vendor_data,
      created_at:     decision.created_at,
      features:       decision.features ?? [],

      // Primary subject (convenience — first ID verification)
      subject: primary ? {
        name:          [primary.first_name, primary.last_name].filter(Boolean).join(" ") || primary.full_name,
        date_of_birth: primary.date_of_birth,
        nationality:   primary.nationality,
        gender:        primary.gender,
        address:       primary.address,
        document: {
          type:       primary.document_type,
          number:     primary.document_number,
          country:    primary.issuing_country,
          state:      primary.issuing_state,
          issued:     primary.issuing_date,
          expires:    primary.expiration_date,
        },
        images: {
          front:  primary.document_front_image,
          back:   primary.document_back_image,
          selfie: livenessChecks[0]?.selfie_image ?? null,
        },
      } : null,

      // Full per-feature arrays
      id_verifications: idVerifications,
      liveness_checks:  livenessChecks,
      face_matches:     faceMatches,
      aml_screenings:   amlScreenings,

      // Raw decision for completeness
      raw_decision: decision,
    });
  } catch (err) {
    return Response.json(
      { error: err.message, status: err.status },
      { status: err.status ?? 500 }
    );
  }
}
