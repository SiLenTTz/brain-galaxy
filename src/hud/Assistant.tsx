// Assistent (advanced): eine Chat-Box, Quelle umschaltbar Vault (qmd) / Hivemind.
import { useEffect, useRef, useState } from 'react';
import { useSelection } from '../state/stores';
import { useTheme } from '../state/theme';

type Source = 'vault' | 'hivemind';
interface Msg { who: 'me' | 'bot'; text: string }

export function AssistantPanel() {
  const theme = useTheme((s) => s.theme);
  const guide = theme.kind === 'branded' && theme.wordmark ? theme.wordmark : 'ASSISTENT';
  const [source, setSource] = useState<Source>('vault');
  const [log, setLog] = useState<Msg[]>([
    { who: 'bot', text: 'Frag mich nach einer Notiz — ich fliege dich hin. Umschalter oben: Vault oder Hivemind.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const setSelected = useSelection((s) => s.setSelected);
  const askRef = useRef<() => void>(null as any);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);

  // v5: L gemalt → Librarian öffnen (mit leerem Fokus, tippen/sprechen rein)
  useEffect(() => {
    const onOpen = () => {
      setSource('hivemind');
      const el = document.querySelector('.assistant input') as HTMLInputElement | null;
      el?.focus();
    };
    window.addEventListener('hands-librarian-open', onOpen);
    return () => window.removeEventListener('hands-librarian-open', onOpen);
  }, []);

  // v4: 🙏 gefaltete Hände → Librarian-Frage (von der Gesten-Engine)
  useEffect(() => {
    const onLib = (e: Event) => {
      const q = (e as CustomEvent<string>).detail?.trim();
      if (!q) return;
      setSource('hivemind');
      setInput(q);
      setTimeout(() => askRef.current?.(), 60);   // Input-State zuerst setzen
    };
    window.addEventListener('hands-librarian', onLib);
    return () => window.removeEventListener('hands-librarian', onLib);
  }, []);

  async function ask() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setLog((l) => [...l, { who: 'me', text: q }, { who: 'bot', text: '…' }]);
    setBusy(true);
    const replace = (text: string) =>
      setLog((l) => { const c = [...l]; c[c.length - 1] = { who: 'bot', text }; return c; });
    try {
      if (source === 'vault') {
        const r = await fetch(`/agent?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        replace(j.answer || 'Kein Treffer im Vault.');
        if (j.hit?.id) setSelected(j.hit.id);
      } else {
        const r = await fetch(`/hive?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        const lines = (j.results ?? []).slice(0, 3).map(
          (h: any) => `• ${String(h.content ?? '').slice(0, 160)}… [${h.agentId ?? h.source ?? '?'}]`,
        );
        replace(lines.length ? lines.join('\n') : 'Kein Treffer im Hivemind.');
      }
    } catch (e: any) {
      replace('Nicht erreichbar: ' + e.message);
    }
    setBusy(false);
  }

  askRef.current = () => ask();
  return (
    <div className="assistant glass corners">
      <div className="ahead">
        <b>{guide}</b>
        <div className="src-toggle">
          <button className={source === 'vault' ? 'on' : ''} onClick={() => setSource('vault')}>VAULT</button>
          <button className={source === 'hivemind' ? 'on' : ''} onClick={() => setSource('hivemind')}>HIVEMIND</button>
        </div>
      </div>
      <div className="alog" ref={logRef}>
        {log.map((m, i) => (
          <div key={i} className={`amsg ${m.who === 'me' ? 'me' : ''}`}>
            <span className="who">{m.who === 'me' ? 'DU' : 'AI'}</span>
            <span className="txt">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="ain">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder={source === 'vault' ? 'Vault fragen …' : 'Hivemind fragen …'}
        />
        <button onClick={ask} disabled={busy}>➤</button>
      </div>
    </div>
  );
}
