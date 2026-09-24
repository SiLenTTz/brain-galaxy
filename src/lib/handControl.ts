// handControl.ts — Hand-Gesten-Steuerung für brain-galaxy
// Verbindet sich als Viewer am handcam-Relay (127.0.0.1:8787), lädt
// MediaPipe HandLandmarker selbst und stellt erkannte Gesten als
// Zustand bereit. Kalibriert auf einen Sampler-Korpus (2026-09-09).
//
// GESTEN-VOKABULAR (v2, Spec 2026-09-09):
//   FAUST halten      → voxtype-Aufnahme; beim Öffnen stoppt voxtype und
//                       tippt das Transkript ins AKTIVE FENSTER (systemweit,
//                       via Relay: `voxtype record start/stop`)
//   OK/PINCH halten   → Voice-NAVIGATION: Palette offen, Interim-Transkript
//                       filtert live, erster Treffer markiert; beim Loslassen
//                       wird der markierte Eintrag ausgewählt + Menü schließt
//   OFFENE HAND 600ms → Voice-SUCHE: Sprache → Palette mit Suchergebnissen
//                       (Transkript als Suchbegriff, Bedeutungssuche via /agent)
//
// HCI-Fundament: Hysterese an allen Grenzen, Verzögerungen gegen
// Midas-Touch, klares visuelles Feedback pro Geste.
import { create } from 'zustand';

export interface HandState {
  active: boolean;
  connected: boolean;
  /** B2: Producer (Phone) hängt am Relay — Relay broadcastet {phone:true/false}. */
  phoneUp: boolean;
  x: number;
  y: number;
  /** v4: Kreis-Auswahl — Fortschritt (0..1) und Commit (Sequenz + Position). */
  circleProgress: number;
  commitSeq: number;
  commitX: number;
  commitY: number;
  fisting: boolean;      // v4: Faust = Menü gehalten
  /** v4: Flug/Zoom-Impuls (CameraRig konsumiert pro Frame). */
  fly: { active: boolean; rotate: number; dolly: number; zoom: number };
  voice: 'off' | 'dictation' | 'navigation' | 'search';
  hint: string;
  selPosture: string;
  modePosture: string;
  /** v5: gemalter Buchstabe (letzter erkannter) + Wisch-Richtung. */
  letter: string;
  swipeDir: -1 | 0 | 1;
}

export const useHand = create<HandState>(() => ({
  active: false, connected: false, phoneUp: false, x: 0, y: 0,
  circleProgress: 0, commitSeq: 0, commitX: 0, commitY: 0, fisting: false,
  fly: { active: false, rotate: 0, dolly: 0, zoom: 0 },
  voice: 'off', hint: '', selPosture: '', modePosture: '',
  letter: '', swipeDir: 0,
}));

export interface HandCallbacks {
  /** v6: Sprache vom Phone-Mic (transkribiert) — Commands oder Diktat. */
  onVoice?: (text: string) => void;
  /** v5: Wischen mit Zeigefinger → Nachbar-Sprung (dir -1 links / +1 rechts). */
  onSwipe?: (dir: -1 | 1) => void;
  /** v4: OK-Zeichen — oberstes Modal schließen (App entscheidet Reihenfolge). */
  onCloseModal?: () => void;
  /** v4: Faust halten → Menü (Palette) offen/zu. */
  onMenuHold?: (open: boolean) => void;
  /** Sprach-Session begonnen (Librarian via gefaltete Hände). */
  onNavStart?: () => void;
  /** Interim-Transkript während OK-Halten (Navigation). */
  onNavInterim?: (text: string) => void;
  /** OK losgelassen → markierten Treffer übernehmen, Menü schließen. */
  onNavEnd?: (finalText: string) => void;
  /** Offene Hand erkannt → Voice-Suche starten. */
  onVoiceSearch?: (transcript: string) => void;
}

// System-Kommandos (Omarchy-Steuerung via Relay-Allowlist).
// Gesprochenes wird gegen diese Muster gematcht — bewusst breit (der
// Relay prüft alles nochmal gegen seine Allowlist).
export const SYSTEM_COMMANDS: { match: RegExp; cmd: string; label: string }[] = [
  { match: /öffne|starte|open/i, cmd: "next", label: "launch" },   // Detail: app-Extraktion unten
  { match: /nächstes? fenster|next window/i, cmd: "nextwin", label: "Fenster →" },
  { match: /vorheriges? fenster|previous window/i, cmd: "prevwin", label: "Fenster ←" },
  { match: /fenster hoch|window up/i, cmd: "upwin", label: "Fenster ↑" },
  { match: /fenster runter|window down/i, cmd: "downwin", label: "Fenster ↓" },
  { match: /workspace links|nach links/i, cmd: "left", label: "Workspace ←" },
  { match: /workspace rechts|nach rechts/i, cmd: "right", label: "Workspace →" },
];
const LAUNCH_WORDS: Record<string, string> = {
  terminal: "terminal", konsole: "terminal", browser: "browser", brave: "browser",
  dateien: "files", files: "files", galaxy: "galaxy", vault: "vault", obsidian: "obsidian",
  discord: "discord",
};

/** Prüft Transkript auf System-Kommandos; gibt Relay-Payload oder null. */
export function parseSystemCommand(t: string): { oma: string; label: string } | null {
  const s = t.toLowerCase().trim();
  if (!s) return null;
  // Launch: „öffne terminal" / „starte browser"
  if (/^(öffne|starte|open)\b/.test(s)) {
    for (const [w, app] of Object.entries(LAUNCH_WORDS)) {
      if (s.includes(w)) return { oma: `launch:${app}`, label: `🚀 ${app}` };
    }
  }
  for (const c of SYSTEM_COMMANDS) {
    if (c.match.test(s) && c.cmd !== "next") return { oma: c.cmd, label: c.label };
  }
  return null;
}

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

/** Relay-Adresse: lokal direkt — über Tailscale serve (Phone/galaxy unter
 *  /handcam) same-origin wss. Dynamisch, damit beide Zugangswege gehen. */
function relayUrl(): string {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'ws://127.0.0.1:8787/?type=viewer';
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/handcam/?type=viewer`;
}
// S9: lokal vorgehaltene Assets (public/vendor/mediapipe, Pin 0.10.14) — der
// Hands-Modus läuft damit komplett offline; CDN ist nur noch Fallback.
const VISION_LOCAL = '/vendor/mediapipe';
const MODEL_LOCAL = `${VISION_LOCAL}/hand_landmarker.task`;
const MODEL_CDN = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** Lokale Assets vorhanden? Sonst CDN (offline → lokal, online → egal). */
async function visionBase(): Promise<{ url: string; model: string }> {
  try {
    const r = await fetch(`${VISION_LOCAL}/wasm/vision_wasm_internal.wasm`, { method: 'HEAD' });
    if (r.ok) return { url: VISION_LOCAL, model: MODEL_LOCAL };
  } catch { /* offline/headless — CDN versuchen */ }
  return { url: VISION_CDN, model: MODEL_CDN };
}
// Eingangsquelle (ADR-004 Klärung 2): ?hands=webcam = lokale Kamera direkt,
// ?hands=1 = Phone-Relay. Eine Engine, beide Quellen; der oma-Kanal (voxtype,
// Fenster, Launch) läuft in BEIDEN Modi über den Relay (Viewer-Rolle).
export type HandSource = 'relay' | 'webcam';

/** Aktive Instanz (Start/Stopp für den UI-Toggle, S13/B1). */
let activeStop: (() => void) | null = null;

/** Stoppt die laufende Gesten-Engine (safe wenn nicht aktiv). */
export function stopHandControl() {
  activeStop?.();
  activeStop = null;
}

// ---- v6: IMMER AKTIVER Voice-Listener (unabhängig von Gesten) -----------
// Verbindet sich zum Relay und hört auf {voice:...} — auch wenn die Gesten-
// Engine aus ist. So kommen Phone-Sprachbefehle immer an.
let voiceWs: WebSocket | null = null;
let voiceBackoff = 400;

export function startVoiceListener(onVoice: (text: string) => void) {
  const connect = () => {
    voiceWs = new WebSocket(relayUrl());
    voiceWs.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const m = JSON.parse(ev.data);
        if (typeof m.phone === 'boolean') useHand.setState({ phoneUp: m.phone });
        if (typeof m.voice === 'string' && m.voice.trim()) onVoice(m.voice.trim());
      } catch { /* anderer Text */ }
    };
    voiceWs.onopen = () => { voiceBackoff = 400; };
    voiceWs.onclose = () => { setTimeout(connect, voiceBackoff); voiceBackoff = Math.min(voiceBackoff * 2, 5000); };
    voiceWs.onerror = () => voiceWs?.close();
  };
  connect();
}

export function stopVoiceListener() {
  try { voiceWs?.close(); } catch { /* */ }
  voiceWs = null;
}

// ---- v5: Gesten-Stil ('letters' default, 'postures' = v4) -------------
export type GestureStyle = 'postures';
/** v6: Buchstaben-Modus entfernt — Haltungen only. */
export function gestureStyle(): GestureStyle { return 'postures'; }

// ---- K: Kalibrierbare Schwellen (Taste C → Canyon-Methode) --------------
// Methode aus barehands' „Tuning Clinic": korrekte Pose + Impostor samplen,
// trennende Metrik („Canyon") suchen, Schwelle in die CANCUT-MITTE legen.
// Werte liegen in normalisierten Landmark-Räumen → weitgehend kamera-
// unabhängig; nach Kamerawechsel/Lichtwechsel bei Bedarf C drücken.
export interface HandCalib { extK: number; pinchK: number; fistK: number; prayerDist: number;
  flyNorm: number; flyThresh: number; zoomK: number; savedAt?: string }
const CAL_KEY = 'weave-hand-calib';
function loadCal(): HandCalib {
  try {
    const c = JSON.parse(localStorage.getItem(CAL_KEY) || 'null');
    if (c && typeof c.extK === 'number') return c;
  } catch { /* */ }
  return { extK: 1.12, pinchK: 0.5, fistK: 0.8, prayerDist: 0.13, flyNorm: 1100, flyThresh: 480, zoomK: 0.9 };
}
export const CAL: HandCalib = loadCal();
export function saveCal(c: HandCalib) {
  Object.assign(CAL, c, { savedAt: new Date().toISOString() });
  try { localStorage.setItem(CAL_KEY, JSON.stringify(CAL)); } catch { /* */ }
}
export function resetCal() {
  saveCal({ extK: 1.12, pinchK: 0.5, fistK: 0.8, prayerDist: 0.13, flyNorm: 1100, flyThresh: 480, zoomK: 0.9 });
}

/** Frame-Metriken fürs Kalibrier-Overlay (Canyon-Sampling).
 *  A = Selektor-(Rechts-)Rolle, B = Modi-(Links-)Rolle — getrennt, damit
 *  Einhand-Gesten je Hand kalibriert werden können. */
export interface HandMetrics { extR: number[]; pinch: number; p: string }
export interface CalibFrame {
  hands: number;
  A: HandMetrics | null;     // rechte (Selektor-)Hand
  B: HandMetrics | null;     // linke (Modi-)Hand
  nDist: number | null;
  jitter: number;
  latE: number | null;
  /** Paar-Abstand Änderung je Frame in px (Zoom-Kalibrierung, oder null) */
  dPair: number | null;
}
let calibSink: ((f: CalibFrame) => void) | null = null;
export function setCalibSink(fn: ((f: CalibFrame) => void) | null) { calibSink = fn; }

/** Kalibrier-Modus: NUR das genannte Feature feuert ('ok'|'fist'|'prayer'|
 *  'zoom'|'fly'|null = alle normal). Verhindert, dass die Kalibrier-Schritte
 *  sich gegenseitig abschießen (OK schloss das Modal, Faust riss die Palette). */
let calibAllow: string | null = null;
export function setCalibAllow(feature: string | null) { calibAllow = feature; }
/** Letzter Zeitstempel, zu dem ein Feature wirklich gefeuert hat (Wizard-
 *  Feedback: „Aktion läuft!"). */
let lastActionTs = 0;
export function calibActionAge(): number { return performance.now() - lastActionTs; }
const allow = (f: string) => calibAllow === null || calibAllow === f;

const PINCH_OUT = 0.80;   // Release-Schwelle (Klick-Hysterese)
const PALM_HOLD_MS = 600;
const FIST_CONFIRM_MS = 250;   // Faust muss 250ms bleiben (Anti-Midas)

export async function startHandControl(cb: HandCallbacks, source: HandSource = 'relay') {
  if (activeStop) return activeStop; // läuft schon
  const WEBCAM = source === 'webcam';
  const VISION = await visionBase();
  const { HandLandmarker, FilesetResolver } = await import(
    /* @vite-ignore */ `${VISION.url}/vision_bundle.mjs`);

  // S9/B5 — LATEYZ-UHR: ?latency=1 zeigt eine große laufende Millisekunden-
  // Uhr. Test: Uhr mit der Kamera filmen — im Kamerabild läuft sie der
  // echten Uhr um die Pipeline-Latenz hinterher (Video abfilmen und Δ lesen).
  if (new URLSearchParams(location.search).get('latency') === '1') {
    const lc = document.createElement('div');
    lc.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);'
      + 'z-index:999;font:700 72px/1.1 ui-monospace,monospace;color:#7dffb8;'
      + 'background:rgba(0,0,0,.55);padding:8px 28px;border-radius:16px;pointer-events:none;';
    document.body.appendChild(lc);
    const tick = () => {
      const d = new Date();
      lc.textContent = `${String(d.getMinutes()).padStart(2, '0')}:`
        + `${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.style.display = 'none';
  document.body.appendChild(video);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  let ws: WebSocket | null = null;
  let frameSeq = 0;   // PITFALL (2026-09-09): video.currentTime bleibt bei
                      // captureStream-Frames dauerhaft 0 stehen (readyState 4,
                      // Frames da, Uhr steht) — Gating auf currentTime lässt
                      // detectForVideo NIE laufen. Frame-Zähler statt Uhr.
  if (WEBCAM) {
    // Lokale Webcam: echter Media-Stream → currentTime läuft, Uhr-Gating ok.
    // 640x480 (wie phone.html): MediaPipe-Kosten skaliert mit der Eingabe —
    // 1280x720 drückte detectForVideo auf ~250 ms (3-4 fps).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      useHand.setState({ connected: true, hint: '🎥 Webcam läuft' });
    } catch (e) {
      useHand.setState({
        active: true, connected: false,
        hint: `🎥 Kamera: ${(e as Error)?.name ?? 'Fehler'}`,
      });
      throw e;
    }
  }
  // System-Kommandos ans Relay (Launch/Fenster/Workspace) — Allowlist dort
  (window as any).__omaSend = (oma: string) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ oma }));
  };

  img.onload = () => {
    if (canvas.width !== img.naturalWidth) {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      video.srcObject = canvas.captureStream(30);
      video.play().catch(() => {});
    }
    ctx.drawImage(img, 0, 0);
    frameSeq++;
  };

  let backoff = 400;
  const connect = () => {
    ws = new WebSocket(relayUrl());
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      // Text = Relay-Status ({phone}) oder Sprache ({voice}); Binary = Frame.
      if (typeof ev.data === 'string') {
        try {
          const m = JSON.parse(ev.data);
          if (typeof m.phone === 'boolean') useHand.setState({ phoneUp: m.phone });
          if (typeof m.voice === 'string' && m.voice.trim()) cb.onVoice?.(m.voice.trim());
        } catch { /* anderer Text */ }
        return;
      }
      // Frames nur im Phone-Modus auswerten; Webcam-Modus nutzt den WS nur
      // für oma-Befehle (Allowlist-Ausführung bleibt server-seitig).
      if (!WEBCAM) img.src = URL.createObjectURL(new Blob([ev.data], { type: 'image/jpeg' }));
    };
    ws.onopen = () => { backoff = 400; useHand.setState({ connected: true }); };
    ws.onclose = () => { useHand.setState({ connected: false }); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 5000); };
    ws.onerror = () => ws?.close();
  };
  connect();

  const vision = await FilesetResolver.forVisionTasks(`${VISION.url}/wasm`);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: VISION.model,
      delegate: 'GPU',
    },
    numHands: 2, runningMode: 'VIDEO',
    minHandDetectionConfidence: 0.65,
    minHandPresenceConfidence: 0.5,
  });

  // ---- Browser-Voice (für Navigation & Suche; Dictation macht voxtype) ----
  let recog: any = null;
  let recogMode: 'nav' | 'search' | 'off' = 'off';
  let lastFinal = '';
  try {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      recog = new SR();
      recog.lang = 'de-DE';
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (e: any) => {
        let interim = '', fin = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
        }
        if (fin) lastFinal = (lastFinal + ' ' + fin).trim();
        if (recogMode === 'nav' && (interim || lastFinal)) cb.onNavInterim?.((lastFinal + ' ' + interim).trim());
      };
      recog.onend = () => {
        // continuous recognition ends on silence — restart while mode active
        if (recogMode !== 'off') { try { recog.start(); } catch { /* overlap */ } }
      };
      recog.onerror = () => {};
    }
  } catch { /* no voice */ }

  function startRecog(mode: 'nav' | 'search') {
    lastFinal = '';
    recogMode = mode;
    if (recog) { try { recog.start(); } catch { /* */ } }
  }
  function stopRecog(): string {
    const out = lastFinal;
    recogMode = 'off';
    if (recog) { try { recog.stop(); } catch { /* */ } }
    return out;
  }

  // ---- Gesten v4: Spec + Forschung (ADR-004 rev. 6) ----------------
  // Architektur nach Literatur: statische Haltungsklassifikation je Frame
  // (MediaPipe) + geometrische Trajektorie-Tests (Kreis) + FSM-Top-Layer
  // mit Frame-Debouncing — das fixt „zu empfindlich" und „wird nicht
  // erkannt": Übergangs-Rauschen wird erst nach STABLE_FRAMES stabilen
  // Frames zur Haltung.
  //
  //   RECHTS: ☝️ zeigen = Cursor/Navigieren · ↻ mit Finger kreisen =
  //           AUSWÄHLEN (Commit — Knoten UND Buttons pulsieren auf)
  //           🤏 OK = aktuelles Modal schließen (Abbruch/Cancel)
  //   LINKS:  ✊ Faust halten = Menü offen (Palette) — loslassen = zu
  //           ✋ Hand heben = Diktat + Paste ins fokussierte Element +
  //           Zwischenablage
  //   BEIDE:  🙏 gefaltete Hände = mit dem Librarian reden
  //           🖐🖐 auseinander = rauszoomen · zusammen = reinzoomen
  //           🖐🖐 schlangenartiges Schlängeln = durchs Universum fliegen
  let lastTs = -1;      // Phone-Modus: Frame-Zähler
  let lastClock = -1;   // Webcam-Modus: Media-Uhr
  let sx = 0, sy = 0;
  const SWAP = new URLSearchParams(location.search).get('handswap') === '1';

  // --- Tuning-Konstanten (alles gefühlt kalibrierbar) ---
  const STABLE_FRAMES = 3;      // Haltung muss N Frames stabil sein
  const CIRCLE_CLOSE_R = 62;    // px: Schluss-Erkennung Kreis
  const CIRCLE_MIN_TURN = 300;  // °: minimale Gesamtdrehung
  const CIRCLE_MIN_R = 22;      // px: Mindest-Radius (kein Zittern)
  const CIRCLE_COOLDOWN = 700;  // ms nach Commit
  const FIST_MENU_MS = 300;     // Faust → Menü
  const RAISE_Y = 0.34;         // Handmitte oberhalb 34 % Bildhöhe = "gehoben"
  const RAISE_MS = 350;
  const PRAYER_MS = 600;
  const SNAKE_WINDOW = 0.8;     // s: Rückblick für Schlangel-Energie
  const SNAKE_MIN_E = 900;      // px/s Summe |vx| — Schwelle Schlangeln
  const SNAKE_MIN_FLIPS = 3;    // Richtungswechsel im Fenster
  const ZOOM_K = 0.9;           // Handabstand→Dolly-Empfindlichkeit

  function toScreen(lm: { x: number; y: number }) {
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    const scale = Math.max(innerWidth / vw, innerHeight / vh);
    const dw = vw * scale, dh = vh * scale;
    const ox = (innerWidth - dw) / 2, oy = (innerHeight - dh) / 2;
    return { x: ox + (1 - lm.x) * dw, y: oy + lm.y * dh };
  }

  type LM = Array<{ x: number; y: number; z?: number }>;
  type Posture = 'fist' | 'palm' | 'point' | 'pinch' | 'other';

  function classify(l: LM): { p: Posture; ratio: number } {
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const span = d(l[0], l[9]);
    const ratio = span > 0 ? d(l[4], l[8]) / span : 1;
    // Fingerspitze weiter vom Handgelenk als das Mittelgelenk = gestreckt
    const ext = [8, 12, 16, 20].map((t) => {
      const pip = t === 8 ? 6 : t === 12 ? 10 : t === 16 ? 14 : 18;
      return d(l[t], l[0]) > d(l[pip], l[0]) * CAL.extK;
    });
    const n = ext.filter(Boolean).length;
    if (n === 0 && ratio < CAL.fistK) return { p: 'fist', ratio };
    if (n >= 4) return { p: 'palm', ratio };
    if (ext[0] && !ext[1] && !ext[2] && !ext[3]) return { p: 'point', ratio };
    if (ratio < CAL.pinchK && ext[1] && ext[2]) return { p: 'pinch', ratio };   // kleiner Finger egal
    return { p: 'other', ratio };
  }

  // --- FSM-Zustände ---
  let selPost: Posture = 'other', selCand: Posture = 'other', selStable = 0;
  let modePost: Posture = 'other', modeCand: Posture = 'other', modeStable = 0;
  let circleTrail: Array<{ x: number; y: number; t: number }> = [];
  let circleCool = 0;
  let commitSeq = 0, commitX = 0, commitY = 0, circleProg = 0;
  let okSince = 0, okDone = 0;
  let fistSince = 0, menuByFist = false;
  let raiseSince = 0, dictating = false, dictText = '';
  let prayerSince = 0, librarian = false;
  let lastPairDist = 0;
  let vxWin: Array<{ t: number; v: number }> = [];
  let lastMidX = -1;
  let fly = { active: false, rotate: 0, dolly: 0, zoom: 0 };
  let lastCalCx = -1, lastCalCy = -1;
  let lastZoomD = 0;   // Paar-Abstand-Delta je Frame (Zoom-Kalibrierung)
  let latEnergy = 0;   // geglätte laterale Schwingungs-Energie (Flug/Calib)

  // setInterval statt rAF: läuft auch in verdeckten Tabs weiter
  const loop = (now: number) => {
    const fresh = WEBCAM ? video.currentTime !== lastClock : frameSeq !== lastTs;
    if (!fresh || video.readyState < 2) return;
    if (WEBCAM) lastClock = video.currentTime; else lastTs = frameSeq;
    const w = window as any;
    w.__detectCount = (w.__detectCount || 0) + 1;
    const detT0 = performance.now();
    const res = landmarker.detectForVideo(video, now);
    w.__detectMs = Math.round(performance.now() - detT0);
    if (!w.__fpsT) w.__fpsT = now;
    if (now - w.__fpsT >= 1000) {
      w.__detectFps = w.__detectCount - (w.__fpsLast || 0);
      w.__fpsLast = w.__detectCount;
      w.__fpsT = now;
    }
    w.__handCount = res.landmarks?.length ?? 0;

    // Hände + Rollen (RAW-Video → MediaPipe-Labels vertauscht, s. Doku)
    let sel: { l: LM; p: Posture; ratio: number } | null = null;
    let mode: { l: LM; p: Posture; ratio: number } | null = null;
    (res.landmarks ?? []).forEach((l: LM, i: number) => {
      const c = classify(l);
      const label = (res as any).handedness?.[i]?.[0]?.categoryName;
      const isRight = SWAP ? label === 'Left' : label === 'Right';   // Default geflippt
      if (isRight && !sel) sel = { l, ...c };
      else if (!isRight && !mode) mode = { l, ...c };
    });
    type H = { l: LM; p: Posture; ratio: number } | null;
    const selH = sel as H;
    const modeH = mode as H;

    // K: Ruhe-Messung fürs Kalibrier-Sampling (Cursor-Bewegung je Frame)
    const handForJitter = (selH ?? modeH) as NonNullable<H> | null;
    let jitterNow = 0;
    if (handForJitter) {
      const c = toScreen({ x: (handForJitter.l[0].x + handForJitter.l[9].x) / 2,
                          y: (handForJitter.l[0].y + handForJitter.l[9].y) / 2 });
      jitterNow = lastCalCx < 0 ? 0 : Math.hypot(c.x - lastCalCx, c.y - lastCalCy);
      lastCalCx = c.x; lastCalCy = c.y;
    } else { lastCalCx = -1; lastCalCy = -1; }
    if (!selH && modeH) { /* nur eine Hand: linkshändiges Zeigen erlauben */ }

    // --- Haltungs-Debouncing (Empfindlichkeits-Fix) ---
    if (selH) {
      if (selH.p === selPost) { selCand = selH.p; selStable = STABLE_FRAMES; }
      else if (selH.p === selCand) { if (++selStable >= STABLE_FRAMES) selPost = selH.p; }
      else { selCand = selH.p; selStable = 1; }
    }
    if (modeH) {
      if (modeH.p === modePost) { modeCand = modeH.p; modeStable = STABLE_FRAMES; }
      else if (modeH.p === modeCand) { if (++modeStable >= STABLE_FRAMES) modePost = modeH.p; }
      else { modeCand = modeH.p; modeStable = 1; }
    }

    let hint = '';

    // ================= RECHTS: zeigen + kreisen + OK =================
    if (selH && selPost === 'point') {
      const pt = toScreen(selH.l[8]);
      const dist = Math.hypot(pt.x - sx, pt.y - sy);
      const a = Math.min(0.7, Math.max(0.25, dist / 55));
      sx += (pt.x - sx) * a; sy += (pt.y - sy) * a;

      // ↻ KREIS = Auswählen (geometrisch: Schluss + Winkelsumme ≥ 300°)
      circleTrail.push({ x: sx, y: sy, t: now });
      while (circleTrail.length && now - circleTrail[0].t > 1500) circleTrail.shift();
      circleProg = 0;
      if (now > circleCool && circleTrail.length > 8) {
        for (let i = 0; i < circleTrail.length - 6; i++) {
          const p0 = circleTrail[i];
          if (Math.hypot(sx - p0.x, sy - p0.y) > CIRCLE_CLOSE_R) continue;
          const seg = circleTrail.slice(i);
          let turn = 0, prevA = Math.atan2(seg[0].y - sy, seg[0].x - sx);
          let cx = 0, cy = 0;
          for (const q of seg) { cx += q.x; cy += q.y; }
          cx /= seg.length; cy /= seg.length;
          let rMax = 0;
          for (let k = 1; k < seg.length; k++) {
            const a2 = Math.atan2(seg[k].y - sy, seg[k].x - sx);
            let da = a2 - prevA;
            while (da > Math.PI) da -= 2 * Math.PI;
            while (da < -Math.PI) da += 2 * Math.PI;
            turn += Math.abs(da) * 180 / Math.PI;
            prevA = a2;
            rMax = Math.max(rMax, Math.hypot(seg[k].x - cx, seg[k].y - cy));
          }
          circleProg = Math.min(1, turn / CIRCLE_MIN_TURN);
          if (turn >= CIRCLE_MIN_TURN && rMax >= CIRCLE_MIN_R && rMax <= 420 && allow('circle')) {
            commitSeq++; commitX = cx; commitY = cy;
            circleCool = now + CIRCLE_COOLDOWN;
            circleTrail = []; circleProg = 0;
            w.__circleCount = (w.__circleCount || 0) + 1;
            break;
          }
        }
      }
    } else {
      circleTrail = [];
      circleProg = 0;
    }

    // 🤏 OK (stabil 200 ms) = aktuelles Modal schließen
    if (selH && selPost === 'pinch') {
      if (!okSince) okSince = now;
      if (now - okSince > 200 && now > okDone && calibAllow === null) {
        okDone = now + 600;
        cb.onCloseModal?.();
        hint = '🤏 schließe …';
        w.__okCount = (w.__okCount || 0) + 1;
      }
    } else okSince = 0;

    // ================= LINKS: Faust-Menü + Heben-Diktat =================
    if (modeH) {
      // ✊ FAUST = Menü öffnen und OFFEN HALTEN
      if (modePost === 'fist') {
        if (!fistSince) fistSince = now;
        const fistAnyHand = modePost === 'fist'
          || (calibAllow === 'fist' && selPost === 'fist');
        if (!menuByFist && now - fistSince > FIST_MENU_MS && allow('fist') && fistAnyHand) {
          menuByFist = true; lastActionTs = now;
          cb.onMenuHold?.(true);
          hint = '✊ Menü offen — Faust halten';
        }
      } else {
        fistSince = 0;
        if (menuByFist) { menuByFist = false; cb.onMenuHold?.(false); }
      }

      // ✋ HAND HEBEN = Diktat + Paste + Zwischenablage
      const cy = (modeH.l[0].y + modeH.l[9].y) / 2;
      const raised = cy < RAISE_Y && (modePost === 'palm' || modePost === 'point' || modePost === 'other');
      if (raised && !dictating) {
        if (!raiseSince) raiseSince = now;
        if (now - raiseSince > RAISE_MS) {
          dictating = true; dictText = '';
          ws?.send('{"oma":"voxstart"}');        // lokal: tippt ins fokussierte Fenster
          startRecog('search');                   // Transkript für Clipboard/Element
          const ae = document.activeElement as HTMLElement | null;
          const inField = !!ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT');
          hint = inField ? '🔴 Diktiere … → Eingabefeld + Zwischenablage'
                         : '🔴 Diktiere … → fokussiertes Fenster + Zwischenablage';
          useHand.setState({ voice: 'dictation', fisting: false });
        }
      } else if (!raised && dictating) {
        dictating = false;
        ws?.send('{"oma":"voxstop"}');
        dictText = stopRecog();
        if (dictText) {
          navigator.clipboard?.writeText(dictText).catch(() => {});
          const ae = document.activeElement as HTMLElement | null;
          if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) {
            (ae as HTMLInputElement).setRangeText(
              dictText, (ae as any).selectionStart ?? (ae as any).value?.length ?? 0,
              (ae as any).selectionEnd ?? (ae as any).value?.length ?? 0, 'end');
            ae.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        hint = '⏳ Transkript → Element/Fenster + Clipboard';
        useHand.setState({ voice: 'off' });
      } else if (!raised) raiseSince = 0;
      if (dictating && recogMode === 'search') {
        // laufendes Interim als Hint zeigen
      }
    }

    // ================= BEIDE HÄNDE: Gebet / Zoom / Schlangen-Flug ========
    if (selH && modeH) {
      const sc = { x: (selH.l[0].x + selH.l[9].x) / 2, y: (selH.l[0].y + selH.l[9].y) / 2 };
      const mc = { x: (modeH.l[0].x + modeH.l[9].x) / 2, y: (modeH.l[0].y + modeH.l[9].y) / 2 };
      const nDist = Math.hypot(sc.x - mc.x, sc.y - mc.y);

      // 🙏 GEFALTETE HÄNDE = Librarian reden (600 ms armen)
      if (nDist < CAL.prayerDist) {
        if (!prayerSince) prayerSince = now;
        if (!librarian && now - prayerSince > PRAYER_MS && allow('prayer')) {
          librarian = true; lastActionTs = now;
          startRecog('nav');
          cb.onNavStart?.();
          useHand.setState({ voice: 'navigation' });
        }
        if (librarian) hint = '🙏 Librarian zuhören … loslassen sendet';
      } else if (librarian) {
        librarian = false; prayerSince = 0;
        const text = stopRecog();
        cb.onNavEnd?.(text);           // App: Systembefehl ODER Librarian-Frage
        useHand.setState({ voice: 'off' });
      } else prayerSince = 0;

      // 🖐🖐 ZOOM + 🐍 SCHLANGEN-FLUG (getrennt nach radial vs. lateral)
      if (!librarian) {
        const s1 = toScreen(selH.l[0]), m1 = toScreen(modeH.l[0]);
        const dist = Math.hypot(s1.x - m1.x, s1.y - m1.y);
        const midX = (s1.x + m1.x) / 2;
        const dDist = lastPairDist ? dist - lastPairDist : 0;
        lastZoomD = dDist;
        const dLat = lastMidX >= 0 ? midX - lastMidX : 0;
        // laterale Schwingungs-Energie (geglättet) + Richtungswechsel
        if (lastMidX >= 0) vxWin.push({ t: now, v: dLat });
        vxWin = vxWin.filter((q) => now - q.t < SNAKE_WINDOW * 1000);
        const energy = vxWin.reduce((a, q) => a + Math.abs(q.v), 0);
        latEnergy += (energy - latEnergy) * 0.25;
        let flips = 0;
        for (let k = 1; k < vxWin.length; k++)
          if (vxWin[k].v * vxWin[k - 1].v < 0 && Math.abs(vxWin[k].v) > 1.2) flips++;
        const radialDominant = Math.abs(dDist) > Math.abs(dLat) * 1.3;
        const bothOpen = (selPost === 'palm' || selPost === 'other')
                      && (modePost === 'palm' || modePost === 'other');
        if (bothOpen && radialDominant && Math.abs(dDist) > 0.8 && allow('zoom')) {
          const dz = -dDist * CAL.zoomK;   // zusammen (dDist<0) = rein
          fly = { active: true, rotate: 0, dolly: 0, zoom: dz }; lastActionTs = now;
          hint = dz > 0 ? '🖐🖐 zusammen → reinzoomen' : '🖐🖐 auseinander → rauszoomen';
        } else if (bothOpen && latEnergy > CAL.flyThresh && flips >= 2 && allow('fly')) {
          // Lenkung: Handpaar links/rechts der Bildmitte, Schub aus Energie
          const steer = (midX - innerWidth / 2) * 0.02;
          const thrust = Math.min(7, (latEnergy - CAL.flyThresh) / CAL.flyNorm * 5 + 0.6);
          fly = { active: true, rotate: steer, dolly: -thrust, zoom: 0 }; lastActionTs = now;
          hint = '🐍 fliegen — Handpaar neigt zum Lenken';
        }
        lastPairDist = dist; lastMidX = midX;
      } else {
        lastPairDist = 0; lastMidX = -1; vxWin = []; latEnergy = 0;
        if (!fly.zoom) fly = { active: false, rotate: 0, dolly: 0, zoom: 0 };
      }
    } else {
      lastPairDist = 0; lastMidX = -1; vxWin = [];
      fly = { active: false, rotate: 0, dolly: 0, zoom: 0 };
      if (menuByFist && !modeH) { menuByFist = false; cb.onMenuHold?.(false); }
      if (dictating && !modeH) {
        dictating = false; ws?.send('{"oma":"voxstop"}'); stopRecog();
        useHand.setState({ voice: 'off' });
      }
      if (librarian) {
        librarian = false; prayerSince = 0;
        cb.onNavEnd?.(stopRecog());
        useHand.setState({ voice: 'off' });
      }
    }
    // Zoom-Einmal-Impuls konsumieren (CameraRig liegt ihn pro Frame ab)
    const flyOut = { ...fly };
    if (flyOut.zoom) fly = { active: false, rotate: 0, dolly: 0, zoom: 0 };

    // K: Kalibrier-Sampling (rohe Metriken je Hand, am Frame-Ende)
    if (calibSink) {
      const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
      const metrics = (hh: { l: LM; p: Posture } | null): { extR: number[]; pinch: number; p: string } | null => {
        if (!hh) return null;
        const extR = [8, 12, 16, 20].map((t) => {
          const pip = t === 8 ? 6 : t === 12 ? 10 : t === 16 ? 14 : 18;
          const w = d2(hh.l[pip], hh.l[0]) || 1e-6;
          return d2(hh.l[t], hh.l[0]) / w;
        });
        return { extR, pinch: d2(hh.l[4], hh.l[8]) / (d2(hh.l[0], hh.l[9]) || 1e-6), p: hh.p };
      };
      calibSink({
        hands: res.landmarks?.length ?? 0,
        A: metrics(selH as { l: LM; p: Posture } | null),
        B: metrics(modeH as { l: LM; p: Posture } | null),
        nDist: selH && modeH
          ? Math.hypot(
              (selH.l[0].x + selH.l[9].x) / 2 - (modeH.l[0].x + modeH.l[9].x) / 2,
              (selH.l[0].y + modeH.l[9].y) / 2 - (modeH.l[0].y + modeH.l[9].y) / 2)
          : null,
        jitter: jitterNow,
        latE: (selH && modeH) ? latEnergy : null,
        dPair: lastPairDist ? lastZoomD : null,
      });
    }

    if (!hint) {
      hint = '☝️ zeigen · ↻ kreisen = auswählen · 🤏 schließen · ✊ Menü · ✋ heben = diktat · 🙏 Librarian · 🖐🖐 zoom/fliegen · C = kalibrieren';
    }
    useHand.setState({
      active: true, x: sx, y: sy, hint,
      selPosture: selPost, modePosture: modePost,
      circleProgress: circleProg, commitSeq, commitX, commitY,
      fly: flyOut,
    });
  };
  const loopTimer = setInterval(() => loop(performance.now()), 33);   // ~30 Hz

  // ---- Stopp (S13/B1: UI-Toggle) — alles sauber abbauen ----
  const stop = () => {
    clearInterval(loopTimer);
    try { ws?.close(); } catch { /* schon zu */ }
    // Webcam-Track direkt stoppen (Phone-Modus nutzt captureStream am Canvas)
    if (WEBCAM && video.srcObject instanceof MediaStream) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    video.remove();
    try { stopRecog(); } catch { /* */ }
    delete (window as any).__omaSend;
    useHand.setState({
      active: false, connected: false, phoneUp: false, x: 0, y: 0,
      circleProgress: 0, commitSeq: 0, commitX: 0, commitY: 0, fisting: false,
      fly: { active: false, rotate: 0, dolly: 0, zoom: 0 },
      voice: 'off', hint: '', selPosture: '', modePosture: '',
    });
  };
  activeStop = stop;

  // Suche: nach 6s ODER erster finaler Phrase übergeben wir an die App.
  // Implementierung: onNavInterim wird im 'search'-Modus ebenfalls gerufen;
  // die App schließt die Suche per Timeout. (Einfach & robust.)
  return stop;
}
