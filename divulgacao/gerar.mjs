// Gera as falas da Coruja para os vídeos de divulgação (divulgacao/falas.json → divulgacao/audio/<id>.mp3)
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Falta ELEVENLABS_API_KEY'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'falas.json'), 'utf8'));
const so = (process.argv[2] || '').split(',').filter(Boolean);
fs.mkdirSync(path.join(DIR, 'audio'), { recursive: true });
for (const [id, texto] of Object.entries(cfg.falas)) {
  if (so.length && !so.includes(id)) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.voz}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: texto, model_id: cfg.modelo })
  });
  if (!r.ok) { console.error(id, r.status, await r.text()); process.exitCode = 1; continue; }
  fs.writeFileSync(path.join(DIR, 'audio', id + '.mp3'), Buffer.from(await r.arrayBuffer()));
  console.log('✓', id, texto.length);
}
