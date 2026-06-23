import { SUITES } from "@/lib/tests/index.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const suites = SUITES.map(({ id, label, description }) => ({ id, label, description }));
  return Response.json(suites);
}
