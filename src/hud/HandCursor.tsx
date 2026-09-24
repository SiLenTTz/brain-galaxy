// HandCursor.tsx — Cursor + Kreis-Auswahl + Hover-Puls (v4).
// Zeigen bewegt den Cursor; alles Interaktive unter dem Cursor pulsiert
// (hand-hi); der Kreis-Commit feuert einen echten Klick an der Kreis-Mitte
// (Canvas-Knoten UND DOM-Buttons) und markiert das Ziel nachleuchtend.
import { useEffect, useRef } from 'react';
import { useHand, startHandControl, stopHandControl, type HandCallbacks } from '../lib/handControl';
import { useUi } from '../state/stores';

const INTERACTIVE = 'button, a, input, textarea, [data-node-id], .leg, .crumb button, .presults button';

export function HandCursor() {
  const h = useHand();
  const lastCommit = useRef(0);
  const hiEl = useRef<Element | null>(null);

  // Kreis-Commit → echter Klick an der Kreis-Mitte + Nachglühen des Ziels
  useEffect(() => {
    if (h.commitSeq === lastCommit.current) return;
    lastCommit.current = h.commitSeq;
    const opts = { bubbles: true, cancelable: true, clientX: h.commitX, clientY: h.commitY,
                   pointerId: 999, pointerType: 'touch', isPrimary: true };
    const target = document.elementFromPoint(h.commitX, h.commitY);
    const el = target?.closest(INTERACTIVE) ?? (target as HTMLElement | null);
    const host = (el && el.tagName === 'CANVAS') || !el
      ? document.querySelector('canvas')
      : (el as HTMLElement);
    if (host instanceof HTMLElement) {
      host.dispatchEvent(new PointerEvent('pointerdown', opts));
      host.dispatchEvent(new PointerEvent('pointerup', opts));
      host.dispatchEvent(new MouseEvent('click', opts));
    }
    if (el instanceof HTMLElement) {
      el.classList.remove('hand-sel');
      void (el as any).offsetWidth;   // Reflow → Animation neu starten
      el.classList.add('hand-sel');
      setTimeout(() => el.classList.remove('hand-sel'), 1600);
    }
  }, [h.commitSeq]);

  // Hover-Puls: Interaktives unter dem Cursor pulsiert (Spezifikation v4)
  useEffect(() => {
    if (!h.active) { hiEl.current?.classList.remove('hand-hi'); hiEl.current = null; return; }
    const under = document.elementFromPoint(h.x, h.y);
    const el = under?.closest(INTERACTIVE) ?? null;
    if (el !== hiEl.current) {
      hiEl.current?.classList.remove('hand-hi');
      el?.classList.add('hand-hi');
      hiEl.current = el;
    }
  }, [h.active, h.x, h.y]);

  if (!h.active) return null;
  return (
    <>
      <div className={`hcursor${h.circleProgress > 0 ? ' circling' : ''}`} style={{ left: h.x, top: h.y }}>
        {(h.circleProgress > 0 || h.fly.active) && (
          <svg className="armring" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3"
              strokeDasharray={`${(h.circleProgress || 0) * 107} 107`}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          </svg>
        )}
      </div>
      {(h.voice !== 'off' || h.hint || h.fly.active || h.circleProgress > 0) && (
        <div className={`handhint glass corners${h.voice === 'dictation' ? ' rec' : ''}`}>
          {h.hint}
        </div>
      )}
    </>
  );
}

/** Aktiviert die Gestensteuerung — Laufzeit-Toggle im UI (B1) oder
 *  per URL (?hands=1 Phone-Relay, ?hands=webcam lokale Kamera, ADR-004). */
export function useHandControl(opts: HandCallbacks) {
  const hands = useUi((s) => s.hands);
  useEffect(() => {
    if (hands === 'off') return;
    startHandControl(opts, hands === 'webcam' ? 'webcam' : 'relay')
      .catch((e) => console.warn('[hands] Start fehlgeschlagen:', e));
    return () => stopHandControl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hands]);
}
