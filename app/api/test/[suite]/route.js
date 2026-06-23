import { SUITES, runAll } from "@/lib/tests/index.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { suite: suiteId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (entry) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        if (suiteId === "all") {
          await runAll(enqueue);
        } else {
          const suite = SUITES.find((s) => s.id === suiteId);
          if (!suite) {
            enqueue({ level: "error", message: `Unknown suite: "${suiteId}"` });
          } else {
            enqueue({ level: "suite", message: suite.label });
            await suite.run(enqueue);
          }
        }
      } catch (err) {
        enqueue({ level: "error", message: `Unexpected error: ${err.message}` });
      }

      enqueue({ level: "done", message: "Tests complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}
