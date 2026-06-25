// DEPRECATED — replaced by /api/webhooks/didit/route.js
// Returns 410 Gone so any stale registrations fail loudly.
export async function POST() {
  return Response.json(
    { error: "This endpoint has been removed. Use /api/webhooks/didit instead." },
    { status: 410 }
  );
}
