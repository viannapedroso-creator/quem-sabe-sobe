// Quem sabe sobe! · Gerador dos efeitos sonoros e músicas (ElevenLabs)
//
// Lê narracao/sons.json, gera no ElevenLabs só o que ainda não existe (ou mudou de descrição),
// equaliza o volume com ffmpeg e atualiza audio/sons.json, que o jogo usa para tocar.
//   ELEVENLABS_API_KEY=... node narracao/sons.mjs [--refazer sfx_porta,musica_sala]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i < 0 ? p : process.argv[i + 1] || ''; };
const REFAZER = String(arg('refazer', '')).split(',').map((s) => s.trim()).filter(Boolean);
const SONS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'narracao/sons.json'), 'utf8'));
const ARQ_ESTADO = path.join(RAIZ, 'narracao/sons-estado.json');
const estado = fs.existsSync(ARQ_ESTADO) ? JSON.parse(fs.readFileSync(ARQ_ESTADO, 'utf8')) : {};
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Falta a chave ELEVENLABS_API_KEY.'); process.exit(1); }
const DIR = path.join(RAIZ, 'audio/sons');
fs.mkdirSync(DIR, { recursive: true });

const assinatura = (s) => JSON.stringify([s.prompt, s.duracao, s.tipo]);
const precisa = (s) => REFAZER.includes(s.id) || !estado[s.id] || estado[s.id].assinatura !== assinatura(s) || !fs.existsSync(path.join(DIR, s.id + '.mp3'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, corpo) {
  for (let t = 1; t <= 4; t++) {
    const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(corpo) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = await r.text();
    if ((r.status === 429 || r.status >= 500) && t < 4) { await espera(5000 * t); continue; }
    throw new Error(`ElevenLabs ${r.status}: ${msg.slice(0, 300)}`);
  }
}

// Volume parecido entre todos os arquivos: efeitos mais presentes, músicas mais baixas (ficam por baixo da voz)
function equalizar(bruto, final, tipo) {
  const alvo = tipo === 'musica' ? 'I=-22:TP=-2:LRA=11' : 'I=-16:TP=-1.5:LRA=11';
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-af', 'loudnorm=' + alvo, '-ar', '44100', '-b:a', tipo === 'musica' ? '128k' : '96k', final]);
    fs.unlinkSync(bruto);
  } catch (e) { fs.renameSync(bruto, final); }
}

let feitos = 0, erro = null;
for (const s of SONS) {
  if (!precisa(s)) continue;
  try {
    const audio = s.tipo === 'musica'
      ? await pedir('https://api.elevenlabs.io/v1/music', { prompt: s.prompt, music_length_ms: Math.round(s.duracao * 1000), model_id: 'music_v2_5', force_instrumental: true })
      : await pedir('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { text: s.prompt, duration_seconds: s.duracao, prompt_influence: 0.5, model_id: 'eleven_text_to_sound_v3' });
    const bruto = path.join(DIR, s.id + '.bruto.mp3');
    fs.writeFileSync(bruto, audio);
    equalizar(bruto, path.join(DIR, s.id + '.mp3'), s.tipo);
    estado[s.id] = { assinatura: assinatura(s), em: new Date().toISOString() };
    feitos++;
    console.log(`✓ ${s.id}  ${s.descricao}`);
  } catch (e) { erro = e; console.error(`✗ ${s.id}: ${e.message}`); break; }
}
fs.writeFileSync(ARQ_ESTADO, JSON.stringify(estado, null, 1) + '\n');
const prontos = SONS.filter((s) => estado[s.id] && fs.existsSync(path.join(DIR, s.id + '.mp3'))).map((s) => s.id);
fs.writeFileSync(path.join(RAIZ, 'audio/sons.json'), JSON.stringify(prontos) + '\n');
console.log(`Gerados agora: ${feitos}. Prontos no jogo: ${prontos.length} de ${SONS.length}.`);
if (erro) process.exit(1);
