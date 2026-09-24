// bench-boot.mjs — Boot- & Frame-Bench für brain-galaxy über CDP (Port 9223).
// Misst: Zeit bis erster gerenderter Frame, Render-fps (Ø/min), minDist-
// Verletzungen (B11), Node-Zahlen. Für 10k: ?benchgraph=http://127.0.0.1:8790/graph.json
// Aufruf: node scripts/bench-boot.mjs [url] [sekunden]
import { WebSocket } from 'ws';
const http = await import('http');
const base = 'http://localhost:9223';
const url = process.argv[2] || 'http://127.0.0.1:4173/?bench=1';
const seconds = Number(process.argv[3] || 30);

function put(u) {
  return new Promise((res, rej) => {
    const r = http.request(u, { method: 'PUT' }, (r2) => {
      let b = ''; r2.on('data', (c) => (b += c)); r2.on('end', () => res(JSON.parse(b)));
    });
    r.on('error', rej); r.end();
  });
}

const tab = await put(`${base}/json/new?about:blank`);
const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let id = 0;
const send = (m, p = {}) => new Promise((res) => {
  const my = ++id;
  const on = (d) => { const j = JSON.parse(d); if (j.id === my) { ws.off('message', on); res(j.result); } };
  ws.on('message', on); ws.send(JSON.stringify({ id: my, method: m, params: p }));
});
await send('Page.enable');
const t0 = Date.now();
await send('Page.navigate', { url });

const probe = async () => await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    stats: window.__weaveStats || null,
    renderFps: window.__renderFps || 0,
    minDist: window.__minDistViolations ?? null,
  })`,
  returnByValue: true,
}).then((r) => JSON.parse(r?.result?.value || '{}')).catch(() => ({}));

let firstFrame = null;
const fps = [];
const deadline = Date.now() + seconds * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 1000));
  const s = await probe();
  if (firstFrame === null && s.stats?.visible > 0) firstFrame = Date.now() - t0;
  if (firstFrame !== null && s.renderFps > 0) fps.push(s.renderFps);
}
const end = await probe();
const avg = fps.length ? (fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1) : null;
const min = fps.length ? Math.min(...fps) : null;
console.log(JSON.stringify({
  url, firstFrameMs: firstFrame, avgFps: avg, minFps: min,
  minDistViolations: end.minDist, stats: end.stats,
}));
ws.close();
await fetch(`${base}/json/close/${tab.id}`).catch(() => {});
process.exit(0);
