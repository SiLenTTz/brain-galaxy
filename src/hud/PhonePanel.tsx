// PhonePanel — Verbindung zum Phone: QR-Code, URL-Einstellung (persistiert),
// Live-Status und Kurzanleitung. Der 📱-Button in der TopBar öffnet es.
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { useHand } from '../lib/handControl';
import { useUi } from '../state/stores';

const LS_KEY = 'weave-phone-url';

/** Phone-URL ableiten: gleiche Herkunft (Tailscale serve) wenn möglich,
 *  sonst localhost-Fallback — im Panel überschreibbar und gespeichert. */
function defaultPhoneUrl(): string {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return 'https://<dein-rechner>.ts.net/handcam';
  }
  return `${location.origin}/handcam`;
}

export function phoneUrl(): string {
  try {
    return localStorage.getItem(LS_KEY) || defaultPhoneUrl();
  } catch {
    return defaultPhoneUrl();
  }
}

export function PhonePanel() {
  const open = useUi((s) => s.phonePanelOpen);
  const setOpen = useUi((s) => s.setPhonePanel);
  const hands = useUi((s) => s.hands);
  const setHands = useUi((s) => s.setHands);
  const connected = useHand((s) => s.connected);
  const phoneUp = useHand((s) => s.phoneUp);
  const [url, setUrl] = useState(phoneUrl());
  const [copied, setCopied] = useState(false);
  const [relayUp, setRelayUp] = useState<boolean | null>(null);

  useEffect(() => { if (open) setUrl(phoneUrl()); }, [open]);

  // Relay-Erreichbarkeit auch ohne laufende Gesten-Engine anzeigen
  useEffect(() => {
    if (!open) return;
    const probe = () => fetch('/healthz').then((r) => setRelayUp(r.ok)).catch(() => setRelayUp(false));
    probe();
    const iv = setInterval(probe, 3000);
    return () => clearInterval(iv);
  }, [open]);

  const qrData = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createDataURL(5, 6);
    } catch {
      return '';
    }
  }, [url]);

  if (!open) return null;

  const save = (u: string) => {
    setUrl(u);
    try { localStorage.setItem(LS_KEY, u); } catch { /* privater Modus */ }
  };

  const relayAlive = relayUp === true || (relayUp === null && connected);
  const status = !relayAlive
    ? { icon: '🔴', text: 'Relay getrennt — läuft `node handcam/server.js`?' }
    : phoneUp
      ? { icon: '🟢', text: 'Phone streamt — Gesten bereit' }
      : relayUp === true && hands === 'off' && !connected
        ? { icon: '🟡', text: 'Relay läuft — Phone verbinden (QR) und ✋ starten' }
        : { icon: '🟡', text: 'Relay da, Phone noch nicht verbunden' };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal corners phone-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Phone verbinden">
        <div className="modal-head">
          <b>📱 PHONE VERBINDEN</b>
          <button className="x" onClick={() => setOpen(false)} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">
          <div className="pp-status">{status.icon} {status.text}</div>

          <div className="pp-grid">
            <div className="pp-qr">
              {qrData
                ? <img src={qrData} alt="QR-Code zur Phone-Seite" width={168} height={168} />
                : <div className="pp-qr-fallback">QR<br />nicht<br />möglich</div>}
              <div className="pp-qr-hint">mit dem Phone scannen</div>
            </div>
            <div className="pp-steps">
              <div className="sec-label">So geht's</div>
              <ol>
                <li>QR scannen → Kamera erlauben (Seite offen lassen)</li>
                <li>Hier Gesten starten:{' '}
                  <button
                    className={hands !== 'off' ? 'on' : ''}
                    onClick={() => setHands(hands === 'off' ? 'phone' : 'off')}
                  >{hands === 'off' ? '✋ Gesten starten' : '✋ Gesten stoppen'}</button>
                </li>
                <li>Hand vor die Phone-Kamera — Pinch klickt, Faust diktiert,
                    offene Hand dreht die Kamera (alles: <code>docs/GESTURES.md</code>)</li>
              </ol>
              <div className="sec-label" style={{ marginTop: 10 }}>Phone-URL</div>
              <input
                value={url}
                onChange={(e) => save(e.target.value)}
                spellCheck={false}
                aria-label="Phone-URL"
              />
              <div className="pp-actions">
                <button onClick={() => {
                  navigator.clipboard?.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}>{copied ? 'kopiert ✓' : 'URL kopieren'}</button>
                <a href={url} target="_blank" rel="noreferrer">Seite öffnen</a>
              </div>
              <div className="tk" style={{ marginTop: 8 }}>
                Galaxy selbst auf dem Phone: <code>{`${location.origin.replace(/:\d+$/, '')}/galaxy/`}</code>
                (mobile Ansicht, Touch-Steuerung)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
