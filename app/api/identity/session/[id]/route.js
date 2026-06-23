import { stripe } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

/**
 * GET  /api/identity/session/[id]   — retrieve a VerificationSession
 * POST /api/identity/session/[id]   — cancel or redact  (body: { action: "cancel"|"redact" })
 */
export async function GET(_req, { params }) {
  const { id } = await params;
  try {
    const session = await stripe.identity.verificationSessions.retrieve(id);
    return Response.json(session);
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { action } = await request.json().catch(() => ({}));

  try {
    let result;
    if (action === "cancel") {
      result = await stripe.identity.verificationSessions.cancel(id);
    } else if (action === "redact") {
      result = await stripe.identity.verificationSessions.redact(id);
    } else {
      return Response.json({ error: "action must be 'cancel' or 'redact'" }, { status: 400 });
    }
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode ?? 500 }
    );
  }
}
