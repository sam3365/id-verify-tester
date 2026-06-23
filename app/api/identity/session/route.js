import { stripe, BASE_URL } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/identity/session
 * Creates a new VerificationSession and returns its client_secret.
 * The client uses the client_secret to launch the Stripe Identity modal
 * via stripe.verifyIdentity(clientSecret).
 *
 * Body (optional JSON):
 * {
 *   type?: "document" | "id_number",       default: "document"
 *   requireSelfie?: boolean,               default: true
 *   requireIdNumber?: boolean,             default: false
 *   metadata?: Record<string, string>
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const type          = body.type          ?? "document";
    const requireSelfie = body.requireSelfie ?? true;
    const requireIdNum  = body.requireIdNumber ?? false;
    const metadata      = body.metadata ?? {};

    const sessionParams = {
      type,
      metadata: { source: "stripe-identity-tester", ...metadata },
      return_url: `${BASE_URL}/verify/complete`,
    };

    if (type === "document") {
      sessionParams.options = {
        document: {
          allowed_types:          ["driving_license", "passport", "id_card"],
          require_id_number:      requireIdNum,
          require_live_capture:   true,
          require_matching_selfie: requireSelfie,
        },
      };
    } else if (type === "id_number") {
      sessionParams.options = {
        id_number: {},
      };
    }

    const session = await stripe.identity.verificationSessions.create(sessionParams);

    return Response.json({
      id:            session.id,
      client_secret: session.client_secret,
      status:        session.status,
      url:           session.url,
      type:          session.type,
    });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode ?? 500 }
    );
  }
}
