import { stripe } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/identity/reports?limit=10&session=vs_xxx
 * Lists VerificationReports with optional session filter.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit   = parseInt(searchParams.get("limit")   ?? "10", 10);
  const session = searchParams.get("session") ?? undefined;

  try {
    const list = await stripe.identity.verificationReports.list({
      limit,
      ...(session ? { verification_session: session } : {}),
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
