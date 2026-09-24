const WebSocket = (await import('ws')).default;
const fs = (await import('fs')).default;
const http = await import('http');
const base = 'http://localhost:9223';
const dir = process.argv[2];
// shots: [ [name, {theme, mode, tuning}], ... ]
const shots = JSON.parse(process.argv[3]);

function put(url) {
  return new Promise((res, rej) => {
    const r = http.request(url, { method: 'PUT' }, (resp) => {
      let b = ''; resp.on('data', (c) => (b += c)); resp.on('end', () => res(JSON.parse(b)));
    });
    r.on('error', rej); r.end();
  });
}

for (const [name, cfg] of shots) {
  const tab = await put(`${base}/json/new?about:blank`);
  const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.once('open', r));
  let id = 0;
  const send = (m, p = {}) => new Promise((res) => {
    const my = ++id;
    const on = (d) => { const j = JSON.parse(d); if (j.id === my) { ws.off('message', on); res(j.result); } };
    ws.on('message', on);
    ws.send(JSON.stringify({ id: my, method: m, params: p }));
  });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });
  const init = `try{
    ${cfg.theme ? `localStorage.setItem('weave-theme','${cfg.theme}');` : ''}
    ${cfg.mode ? `localStorage.setItem('weave-mode','${cfg.mode}');` : ''}
    ${cfg.tuning ? `localStorage.setItem('weave-tuning','${JSON.stringify(cfg.tuning)}');` : ''}
  }catch(e){}`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await send('Page.navigate', { url: 'http://127.0.0.1:5174/' + (cfg.hash || '') });
  await new Promise((r) => setTimeout(r, cfg.wait || 13000));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${dir}/${name}.png`, Buffer.from(shot.data, 'base64'));
  console.log('ok', name);
  ws.close();
  await fetch(`${base}/json/close/${tab.id}`).catch(() => {});
}
process.exit(0);
