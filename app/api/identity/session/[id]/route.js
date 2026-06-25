import { didit } from "@/lib/didit-client.js";

export const dynamic = "force-dynamic";

/**
 * GET    /api/identity/session/[id]  — retrieve full decision for a session
 * DELETE /api/identity/session/[id]  — delete a session (removes PII)
 *
 * Docs:
 *   Retrieve: https://docs.didit.me/sessions-api/retrieve-session
 *   Delete:   https://docs.didit.me/sessions-api/delete-session
 */
export async function GET(_req, { params }) {
  const { id } = await params;
  try {
    const decision = await didit.sessions.retrieve(id);
    return Response.json(decision);
  } catch (err) {
    return Response.json(
      { error: err.message, data: err.data },
      { status: err.status ?? 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  try {
    await didit.sessions.delete(id);
    return Response.json({ deleted: true, session_id: id });
  } catch (err) {
    return Response.json(
      { error: err.message, data: err.data },
      { status: err.status ?? 500 }
    );
  }
}
