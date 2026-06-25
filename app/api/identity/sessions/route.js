import { didit } from "@/lib/didit-client.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/identity/sessions?limit=10&status=Approved
 *
 * Lists verification sessions with optional filters.
 * Docs: https://docs.didit.me/sessions-api/list-sessions
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit  = searchParams.get("limit")  ?? "10";
  const status = searchParams.get("status") ?? undefined;

  try {
    const result = await didit.sessions.list({
      limit,
      ...(status ? { status } : {}),
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err.message, data: err.data },
      { status: err.status ?? 500 }
    );
  }
}
