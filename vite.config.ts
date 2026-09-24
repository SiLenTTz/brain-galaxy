import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// gitignored creds für den Librarian (Hivemind-Brain)
function envFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      fs.readFileSync('hive-brain.env', 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}
const env = envFile();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8789',
      '/healthz': 'http://localhost:8787',
      '/graph.json': 'http://localhost:8789',
      '/note': 'http://localhost:8789',
      '/agent': 'http://localhost:8789',
      '/hive': 'http://localhost:8789',
      // Optionaler Remote-Graph (z. B. Hivemind/Librarian via Tailscale)
      ...(env.HIVE_BRAIN_URL
        ? {
            '/hive-brain': {
              target: env.HIVE_BRAIN_URL,
              changeOrigin: true,
              headers: { Authorization: `Bearer ${env.HIVE_BRAIN_TOKEN}` },
              rewrite: (p: string) => p.replace(/^\/hive-brain/, ''),
            },
          }
        : {}),
    },
  },
  build: { chunkSizeWarningLimit: 1600 },
  preview: {
    port: 4173,
    allowedHosts: true,   // Phone-Zugriff via Tailscale serve (/galaxy → :4173)
    proxy: {
      '/api': 'http://localhost:8789',
      '/healthz': 'http://localhost:8787',
      '/graph.json': 'http://localhost:8789',
      '/note': 'http://localhost:8789',
      '/agent': 'http://localhost:8789',
      '/hive': 'http://localhost:8789',
      ...(env.HIVE_BRAIN_URL
        ? {
            '/hive-brain': {
              target: env.HIVE_BRAIN_URL,
              changeOrigin: true,
              headers: { Authorization: `Bearer ${env.HIVE_BRAIN_TOKEN}` },
              rewrite: (p: string) => p.replace(/^\/hive-brain/, ''),
            },
          }
        : {}),
    },
  },
});
