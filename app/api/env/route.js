import { isTestMode } from "@/lib/stripe-client.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const isTest  = isTestMode;

  return Response.json({
    baseUrl,
    isTest,
    label:      isTest ? "Test Mode" : "Live Mode",
    dashboardUrl: isTest
      ? "https://dashboard.stripe.com/test/identity/verification-sessions"
      : "https://dashboard.stripe.com/identity/verification-sessions",
  });
}
