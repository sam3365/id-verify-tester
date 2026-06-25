import { didit, BASE_URL } from "@/lib/didit-client.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/identity/session
 *
 * Creates a Didit verification session server-side and returns the
 * hosted verification URL plus the session_id.
 *
 * The client redirects the user to `url` — Didit's hosted verification page.
 * After the user completes (or abandons) the flow, Didit redirects back to
 * the callback URL with ?verificationSessionId={id}&status={status}.
 *
 * Body (optional JSON):
 * {
 *   vendorData?: string      — your internal user ID (recommended)
 *   language?:  string       — ISO 639-1 code, default "en"
 *   metadata?:  object
 * }
 *
 * Docs: https://docs.didit.me/sessions-api/create-session
 */
export async function POST(request) {
  try {
    const body       = await request.json().catch(() => ({}));
    const workflowId = process.env.DIDIT_WORKFLOW_ID;

    if (!workflowId || workflowId === "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") {
      return Response.json(
        { error: "DIDIT_WORKFLOW_ID is not configured. Add it to .env.local." },
        { status: 500 }
      );
    }

    const session = await didit.sessions.create({
      workflow_id:     workflowId,
      vendor_data:     body.vendorData ?? `tester-${Date.now()}`,
      callback:        `${BASE_URL}/verify/complete`,
      callback_method: "both",
      language:        body.language ?? "en",
      metadata:        { source: "id-verify-tester", ...body.metadata },
    });

    return Response.json({
      session_id:     session.session_id,
      session_number: session.session_number,
      url:            session.url,
      status:         session.status,
      vendor_data:    session.vendor_data,
    });
  } catch (err) {
    return Response.json(
      { error: err.message, data: err.data },
      { status: err.status ?? 500 }
    );
  }
}
