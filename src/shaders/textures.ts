// Canvas-generierte Texturen (Prompt §12: keine externen Assets)
import * as THREE from 'three';

/** Weicher Radial-Gradient (Halo-Sprite) */
export function haloTexture(color = '#ffffff'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 1, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.15, color + 'dd');
  g.addColorStop(0.4, color + '44');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Konischer Lichtfacher (Hub-Strahlen) */
export function raysTexture(color = '#ffffff'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = 70 + (i % 3) * 34;
    const g = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, color + 'cc');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.strokeStyle = g;
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

/** Hexagon-Grid fuer die Kugelhuele */
export function hexGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(56,232,255,0.8)';
  x.lineWidth = 1.1;
  const s = 22, h = s * Math.sqrt(3) / 2;
  for (let row = -1; row * h < 512 + h; row++) {
    for (let col = -1; col * s * 3 < 512 + s * 3; col++) {
      const cx = col * s * 3 + ((row % 2) * s * 1.5), cy = row * h;
      x.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 30);
        const px = cx + s * Math.cos(a), py = cy + s * Math.sin(a);
        if (k === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  return new THREE.CanvasTexture(c);
}

/** S15: realistischere Sterne — scharfer Kern + Beugungs-Spitzen (4-Punkt),
 *  wie auf Astrofotos. Für Points/Sprites mit AdditiveBlending. */
export function starTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,250,235,0.95)');
  g.addColorStop(0.3, 'rgba(255,240,210,0.28)');
  g.addColorStop(0.6, 'rgba(255,235,200,0.06)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // Beugungs-Spitzen: zwei feine Kreuz-Gradienten
  for (const [dx, dy, len, w] of [[1, 0, S / 2 - 2, 2.2], [0, 1, S / 2 - 2, 2.2], [1, 1, S / 4, 1.2], [-1, 1, S / 4, 1.2]] as const) {
    const grad = x.createLinearGradient(S / 2, S / 2, S / 2 + dx * len, S / 2 + dy * len);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.strokeStyle = grad;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(S / 2 - dx * len, S / 2 - dy * len);
    x.lineTo(S / 2 + dx * len, S / 2 + dy * len);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

/** S15: wolkiger Nebel — geschichtetes Value-Noise auf dem Canvas, weiche
 *  Ausläufer statt simpler Radial-Blobs. Als Sprite-Map mit Tint. */
export function nebulaTexture(seed = 5): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  // Basis: dunkles Radial-Falloff (Kern dichter)
  x.fillStyle = 'rgba(0,0,0,0)';
  x.fillRect(0, 0, S, S);
  let h = seed * 2654435761;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
  // Viele weiche Blobs in Cluster-Form: dicht zur Mitte, Ausläufer nach außen
  const blobs = 90;
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < blobs; i++) {
    const t = i / blobs;
    const ang = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 1.6) * S * 0.42;
    const bx = S / 2 + Math.cos(ang) * rad;
    const by = S / 2 + Math.sin(ang) * rad * 0.75;
    const r = 14 + rnd() * 46 * (1 - t * 0.4);
    const a = 0.05 + rnd() * 0.09;
    const g = x.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(bx, by, r, 0, Math.PI * 2);
    x.fill();
  }
  // Sanfter Rand-Falloff, damit die Textur weich ausläuft
  x.globalCompositeOperation = 'destination-in';
  const edge = x.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S / 2);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.75, 'rgba(0,0,0,0.55)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = edge;
  x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}
