import { stripe } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/identity/sessions?limit=10&status=verified
 * Lists VerificationSessions with optional filters.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit  = parseInt(searchParams.get("limit")  ?? "10", 10);
  const status = searchParams.get("status") ?? undefined;

  try {
    const list = await stripe.identity.verificationSessions.list({
      limit,
      ...(status ? { status } : {}),
    });
    return Response.json({
      data:     list.data,
      has_more: list.has_more,
      count:    list.data.length,
    });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode ?? 500 }
    );
  }
}
