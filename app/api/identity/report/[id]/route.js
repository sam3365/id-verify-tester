import { stripe } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/identity/report/[id]
 * Retrieve a single VerificationReport by ID.
 */
export async function GET(_req, { params }) {
  const { id } = await params;
  try {
    const report = await stripe.identity.verificationReports.retrieve(id);
    return Response.json(report);
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode ?? 500 }
    );
  }
}
