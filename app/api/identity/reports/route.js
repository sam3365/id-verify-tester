// DEPRECATED — Didit uses /api/identity/session/[id] (GET) for decisions.
// Didit has no separate "reports" resource.
export async function GET() {
  return Response.json(
    { error: "Removed. Use GET /api/identity/session/{id} to retrieve a Didit decision." },
    { status: 410 }
  );
}
