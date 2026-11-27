// Quem sabe sobe! · Gerador dos áudios da Coruja (ElevenLabs)
//
// Lê todas as falas do catálogo do jogo (js/falas.js + js/perguntas.js), gera no ElevenLabs só as que
// ainda não têm áudio (ou cujo texto mudou) e atualiza audio/manifest.json, que o jogo usa para tocar.
//
// Uso (no GitHub, pela aba Actions → "Gerar áudios da Coruja"; ou localmente):
//   ELEVENLABS_API_KEY=... node narracao/gerar.mjs --grupos fixas,reacoes --limite 5000
//   node narracao/gerar.mjs --listar            (só mostra o que falta, sem gastar créditos)
// Opções:
//   --grupos   fixas, personagens, numeros, categorias, reacoes, perguntas ou todos (padrão: todos)
//   --limite   máximo de caracteres enviados nesta execução (padrão: 5000)
//   --refazer  códigos para gravar de novo, separados por vírgula (aceita começo do código: manda_vaca)
//   --listar   não gera nada; escreve narracao/falas.csv com o estado de cada fala
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i < 0 ? padrao : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const GRUPOS = String(arg('grupos', 'todos')).split(',').map((s) => s.trim()).filter(Boolean);
const LIMITE = parseInt(arg('limite', '5000'), 10) || 5000;
const REFAZER = String(arg('refazer', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const LISTAR = !!arg('listar', false);

// 1. Carrega o catálogo do jogo como o navegador carregaria
const ctx = { window: {}, document: { currentScript: null }, console, fetch: () => Promise.reject(new Error('sem rede')), setTimeout, Promise };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['js/comum.js', 'js/perguntas.js', 'js/falas.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
const falas = ctx.window.QSS_FALAS.lista();

// 2. Estado: o que já foi gerado (código → texto e arquivo)
const CONFIG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'narracao/config.json'), 'utf8'));
const ARQ_ESTADO = path.join(RAIZ, 'narracao/estado.json');
const estado = fs.existsSync(ARQ_ESTADO) ? JSON.parse(fs.readFileSync(ARQ_ESTADO, 'utf8')) : {};
const chave = (t) => String(t).normalize('NFC').replace(/\s+/g, ' ').trim();
const prefixo = (mapa, id) => { let m = ''; for (const k of Object.keys(mapa || {})) if ((id === k || id.startsWith(k + '_')) && k.length > m.length) m = k;
  if (!m) return undefined; return m ? mapa[m] : undefined; };
const tom = (f) => { if (f.grupo === 'perguntas' && f.id.endsWith('_resposta') && CONFIG.tom_resposta) return CONFIG.tom_resposta;
  const t = prefixo(CONFIG.tom_por_fala, f.id); return t !== undefined ? t : (CONFIG.tom_por_grupo || {})[f.grupo] || ''; };
const textoEnviado = (f) => {
  const proprio = (CONFIG.texto_falado || {})[f.id];
  const base = proprio || f.texto;
  const t = /v3|v4/.test(CONFIG.modelo) && !proprio ? tom(f) : '';
  return (t ? t + ' ' : '') + base;
};
const refazer = (id) => REFAZER.some((r) => id === r || id.startsWith(r + '_') || id.startsWith(r));
const precisa = (f) => !estado[f.id] || estado[f.id].texto !== f.texto || estado[f.id].enviado !== textoEnviado(f) || !fs.existsSync(path.join(RAIZ, 'audio', estado[f.id].arquivo)) || refazer(f.id);

// 3. Escolhe o que gerar nesta execução, até o limite de caracteres
const fila = falas.filter((f) => (GRUPOS.includes('todos') || GRUPOS.includes(f.grupo)) && precisa(f));
const escolhidas = []; let total = 0;
for (const f of fila) { const n = textoEnviado(f).length; if (total + n > LIMITE) break; escolhidas.push(f); total += n; }

function salvarCsv() {
  const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const linhas = [['codigo', 'grupo', 'texto', 'caracteres', 'gravado', 'arquivo'].join(',')];
  for (const f of falas) {
    const e = estado[f.id]; const ok = !!e && e.texto === f.texto;
    linhas.push([f.id, f.grupo, esc(f.texto), textoEnviado(f).length, ok ? 'sim' : 'nao', ok ? e.arquivo : ''].join(','));
  }
  fs.writeFileSync(path.join(RAIZ, 'narracao/falas.csv'), linhas.join('\n') + '\n');
}
function salvarManifesto() {
  const m = {};
  for (const f of falas) { const e = estado[f.id]; if (e && e.texto === f.texto && fs.existsSync(path.join(RAIZ, 'audio', e.arquivo))) m[chave(f.texto)] = e.arquivo; }
  fs.writeFileSync(path.join(RAIZ, 'audio/manifest.json'), JSON.stringify(m, null, 0) + '\n');
  fs.writeFileSync(ARQ_ESTADO, JSON.stringify(estado, null, 1) + '\n');
  salvarCsv();
}

const faltam = falas.filter(precisa);
console.log(`Falas no catálogo: ${falas.length} · sem áudio: ${faltam.length} (${faltam.reduce((a, f) => a + textoEnviado(f).length, 0)} caracteres)`);
console.log(`Nesta execução: ${escolhidas.length} falas, ${total} caracteres (limite ${LIMITE}; grupos: ${GRUPOS.join(', ')})`);
if (LISTAR) { salvarCsv(); console.log('Lista escrita em narracao/falas.csv'); process.exit(0); }

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Falta a chave ELEVENLABS_API_KEY.'); process.exit(1); }

// 4. Gera, uma fala por vez (com nova tentativa em caso de limite de uso)
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function tts(texto) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.voz}?output_format=${CONFIG.formato || 'mp3_44100_128'}`;
  const corpo = { text: texto, model_id: CONFIG.modelo };
  if (/flash|turbo/.test(CONFIG.modelo)) corpo.language_code = 'pt';
  if (CONFIG.ajustes_voz && Object.keys(CONFIG.ajustes_voz).length) corpo.voice_settings = CONFIG.ajustes_voz;
  for (let tent = 1; tent <= 4; tent++) {
    const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(corpo) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = await r.text();
    if ((r.status === 429 || r.status >= 500) && tent < 4) { console.log(`  … tentando de novo (${r.status})`); await espera(4000 * tent); continue; }
    throw new Error(`ElevenLabs ${r.status}: ${msg.slice(0, 300)}`);
  }
}

let feitas = 0, erro = null;
for (const f of escolhidas) {
  const arquivo = `${f.grupo}/${f.id}.mp3`;
  try {
    // Mesmo texto já gravado em outro código? Reaproveita o arquivo, sem gastar créditos
    const igual = !refazer(f.id) && Object.values(estado).find((e) => e.enviado === textoEnviado(f) && e.modelo === CONFIG.modelo && e.voz === CONFIG.voz && fs.existsSync(path.join(RAIZ, 'audio', e.arquivo)));
    if (igual) { estado[f.id] = { ...igual, texto: f.texto }; console.log(`= ${f.id} (reaproveitado)`); continue; }
    const audio = await tts(textoEnviado(f));
    fs.mkdirSync(path.join(RAIZ, 'audio', f.grupo), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, 'audio', arquivo), audio);
    estado[f.id] = { texto: f.texto, enviado: textoEnviado(f), arquivo, modelo: CONFIG.modelo, voz: CONFIG.voz, em: new Date().toISOString() };
    feitas++;
    console.log(`✓ ${f.id}  ${f.texto}`);
    if (feitas % 20 === 0) salvarManifesto();
  } catch (e) { erro = e; console.error(`✗ ${f.id}: ${e.message}`); break; }
}
salvarManifesto();
console.log(`Gravadas ${feitas} de ${escolhidas.length}.`);
if (erro) process.exit(1);
