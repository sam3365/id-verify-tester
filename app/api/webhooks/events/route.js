import { getEvents } from "@/lib/webhooks/store.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/events
 * Returns the most recent Identity webhook events (JSON array, newest first).
 * Polled by the Webhooks UI page every few seconds.
 */
export async function GET() {
  const events = await getEvents();
  return Response.json(events);
}
