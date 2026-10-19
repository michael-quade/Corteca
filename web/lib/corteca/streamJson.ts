// Long-running JSON responses (MCP analyze / troubleshoot take 30 s – 2.5 min).
// Proxies between the browser and Vercel (e.g. corporate web gateways) drop
// requests that send nothing back for too long, which the browser reports as
// "Failed to fetch". So the response starts at once and sends a space every few
// seconds while the work runs; the JSON follows. Leading whitespace is valid JSON,
// so clients just call res.json(). The status is always 200 once streaming has
// started: failures arrive as { error }.

const HEARTBEAT_MS = 5_000;

export function streamJson(work: () => Promise<unknown>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(" "));
      const beat = setInterval(() => {
        try { controller.enqueue(enc.encode(" ")); } catch { /* closed */ }
      }, HEARTBEAT_MS);
      let body: unknown;
      try {
        body = await work();
      } catch (e) {
        body = { error: e instanceof Error ? e.message : String(e) };
      } finally {
        clearInterval(beat);
      }
      controller.enqueue(enc.encode(JSON.stringify(body)));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      // Ask proxies (nginx-style) not to buffer, so the heartbeat reaches the browser.
      'X-Accel-Buffering': 'no',
    },
  });
}
