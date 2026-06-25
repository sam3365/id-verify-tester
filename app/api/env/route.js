export const dynamic = "force-dynamic";

export async function GET() {
  const hasKey      = !!process.env.DIDIT_API_KEY;
  const hasWorkflow = !!(
    process.env.DIDIT_WORKFLOW_ID &&
    process.env.DIDIT_WORKFLOW_ID !== "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  );
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return Response.json({
    hasKey,
    hasWorkflow,
    workflowId:   hasWorkflow ? process.env.DIDIT_WORKFLOW_ID : null,
    baseUrl,
    dashboardUrl: "https://business.didit.me",
    docsUrl:      "https://docs.didit.me",
  });
}
