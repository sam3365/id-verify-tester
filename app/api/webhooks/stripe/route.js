import { stripe } from "@/lib/stripe-client.js";
import { pushEvent } from "@/lib/webhooks/store.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint. Configure this URL in the Stripe Dashboard:
 *   Dashboard → Developers → Webhooks → Add endpoint
 *   URL: https://your-app.vercel.app/api/webhooks/stripe
 *
 * Recommended events to subscribe to (Identity):
 *   identity.verification_session.created
 *   identity.verification_session.processing
 *   identity.verification_session.verified
 *   identity.verification_session.requires_input
 *   identity.verification_session.canceled
 *   identity.verification_session.redacted
 *
 * For local testing use the Stripe CLI:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
export async function POST(request) {
  const body      = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("⚠️  STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`Received Stripe webhook: ${event.type} (${event.id})`);

  // Only process Identity events — ignore everything else silently
  if (event.type.startsWith("identity.")) {
    await pushEvent(event);
  }

  return Response.json({ received: true });
}
