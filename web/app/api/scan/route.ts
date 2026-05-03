import { runScan } from "@/lib/agent/scanRunner";
import { hasRunningScan } from "@/lib/data/sqlite";

export async function POST(req: Request) {
  if (hasRunningScan()) {
    return new Response(JSON.stringify({ error: "scan already running" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as { priority?: boolean };

  const { events } = runScan({ priority: body.priority ?? false });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const ev of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === "done" || ev.type === "error") break;
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
