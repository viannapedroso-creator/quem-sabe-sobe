// Partes compartilhadas entre a TV (anfitriã) e o celular (controle).
(function () {
  const PERSONAGENS = [
    { id: 'bombeiro', nome: 'Bombeiro', fala: 'o Bombeiro' },
    { id: 'astronauta', nome: 'Astronauta', fala: 'o Astronauta' },
    { id: 'marinheiro', nome: 'Marinheiro', fala: 'o Marinheiro' },
    { id: 'cowboy', nome: 'Cowboy', fala: 'o Cowboy' },
    { id: 'vaca', nome: 'Vaca', fala: 'a Vaca' },
    { id: 'hotdog', nome: 'Cachorro-Quente', fala: 'o Cachorro-Quente' },
    { id: 'cientista', nome: 'Cientista', fala: 'a Cientista' },
    { id: 'roqueira', nome: 'Roqueira', fala: 'a Roqueira' },
    { id: 'dinossauro', nome: 'Dinossauro', fala: 'o Dinossauro' },
    { id: 'coxinha', nome: 'Coxinha', fala: 'a Coxinha' },
    { id: 'mergulhador', nome: 'Mergulhador', fala: 'o Mergulhador' },
    { id: 'vovo', nome: 'Vovó', fala: 'a Vovó' }
  ];
  const MAX_JOGADORES = 8;
  const PALAVRAS = ['BOLA', 'PATO', 'GATO', 'SAPO', 'MAPA', 'PIPA', 'TATU', 'FOCA', 'VACA', 'TREM', 'BOLO', 'SUCO', 'DADO', 'NAVE', 'LOJA', 'MOLA', 'RODA', 'SINO', 'TOCA', 'ZEBU'];

  function novoCodigo() {
    const p = PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
    return p + String(Math.floor(10 + Math.random() * 90));
  }
  function limparCodigo(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
  function limparNome(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 12); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function img(id) { return (window.QSS_BASE || '') + 'img/personagens/' + id + '.png'; }
  function pers(id) { return PERSONAGENS.find((p) => p.id === id); }

  function configurado() {
    const c = window.QSS_CONFIG || {};
    return !!(c.supabaseUrl && c.supabaseKey && window.supabase);
  }

  // Um canal de broadcast por sala. Toda mensagem vai no evento "m" com {t: tipo, ...dados}.
  function conectar(codigo, aoReceber, aoStatus) {
    const c = window.QSS_CONFIG;
    const sb = window.supabase.createClient(c.supabaseUrl, c.supabaseKey, { realtime: { params: { eventsPerSecond: 20 } } });
    const canal = sb.channel('qss-sala-' + codigo, { config: { broadcast: { self: false, ack: false } } });
    canal.on('broadcast', { event: 'm' }, ({ payload }) => { try { aoReceber(payload || {}); } catch (e) { console.error(e); } });
    canal.subscribe((status) => { aoStatus && aoStatus(status); });
    return {
      enviar(t, dados) { return canal.send({ type: 'broadcast', event: 'm', payload: Object.assign({ t }, dados || {}) }); },
      sair() { try { sb.removeChannel(canal); } catch (e) {} }
    };
  }

  // Voz provisória da Coruja (voz do navegador). Devolve uma promessa que resolve quando ela termina.
  function falar(texto) {
    return new Promise((ok) => {
      try {
        const ss = window.speechSynthesis; if (!ss) return ok();
        ss.cancel();
        const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1.15;
        const v = ss.getVoices().find((x) => /pt[-_]BR/i.test(x.lang)); if (v) u.voice = v;
        const fim = () => ok(); u.onend = fim; u.onerror = fim;
        ss.speak(u);
        setTimeout(fim, 15000);
      } catch (e) { ok(); }
    });
  }

  // Efeitos sonoros provisórios: bipes com os mesmos nomes do roteiro, trocados depois pelos arquivos finais.
  let ctx = null;
  function sfx(nome) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const tons = {
        sfx_entrar: [660, 990], sfx_toque: [520], sfx_comecar: [523, 659, 784, 1046], sfx_pronto: [784, 1046], sfx_sair: [440, 330],
        sfx_voto: [700, 760], sfx_porta: [392, 523, 659], sfx_sorteio: [880], sfx_correr: [600, 640, 600, 640], sfx_ponto: [988, 1318], sfx_ranking_sobe: [523, 659, 784], sfx_tictac: [1400], sfx_pergunta: [659, 880], sfx_resposta: [880], sfx_tique: [1200],
        sfx_tempo: [330, 262], sfx_certo: [659, 880, 1175], sfx_errado: [220, 196], sfx_ranking: [523, 784], sfx_fim: [523, 659, 784, 1046, 1318]
      };
      (tons[nome] || [600]).forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (e) {}
  }

  // ---------- Regras combinadas no quadro de telas ----------
  const TEMPO_RESPOSTA = 15000, TEMPO_VOTO = 15000, RODADAS = 10, RODADA_ASSOCIACAO = 6;
  // Pontuação (tela 13): acertou = 10 + bônus de rapidez. O mais rápido entre os que acertaram
  // ganha N de bônus (N = número de jogadores), o segundo N-1, e assim por diante. Errou = 0.
  function pontos(ordem, n) { return 10 + Math.max(0, n - ordem); }
  const NUMEROS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];

  // Portas das categorias: cor, sombra e ícone (Geografia, Ciência e Esportes como no quadro)
  const ICONES = {
    globo: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>',
    frasco: '<path d="M9 3h6M10 3v6l-5 8.5A2 2 0 0 0 6.7 20.5h10.6A2 2 0 0 0 19 17.5L14 9V3"/><path d="M7.5 15h9"/>',
    bola: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4z"/><path d="M12 3v4.5M15.4 10l4.4-1.6M14.1 14l2.7 3.8M9.9 14l-2.7 3.8M8.6 10L4.2 8.4"/>',
    claquete: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 9l1.6-4.6 15.2 0L21 9"/><path d="M9 4.4L7.4 9M14.4 4.4L12.8 9M19.8 4.4L18.2 9"/>',
    talheres: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3"/><path d="M17.5 21V3c-2.2 1.2-3.5 4-3.5 7.5h3.5"/>',
    nota: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'
  };
  const CATEGORIAS = {
    'Geografia': { cor: '#F2A33A', sombra: '#B86E14', icone: 'globo' },
    'Ciência': { cor: '#6CC24A', sombra: '#43892A', icone: 'frasco' },
    'Esportes': { cor: '#4F8DF7', sombra: '#2F5FB8', icone: 'bola' },
    'Cinema e TV': { cor: '#A77BF3', sombra: '#7650C2', icone: 'claquete' },
    'Comidas e bebidas': { cor: '#F2545B', sombra: '#B83239', icone: 'talheres' },
    'Música': { cor: '#2EC4B6', sombra: '#1E8F85', icone: 'nota' }
  };
  function categoria(nome) { return CATEGORIAS[nome] || { cor: '#4F8DF7', sombra: '#2F5FB8', icone: 'globo' }; }
  function iconeCat(nome, tam, cor) {
    const c = categoria(nome);
    return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${cor || c.sombra}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[c.icone]}</svg>`;
  }

  // Blocos de resposta: cor e forma de cada letra (telas 11 e 12)
  const ALTS = [
    { l: 'A', cor: '#4F8DF7', sh: '#2F5FB8', tx: '#FFFFFF', forma: '<circle cx="10" cy="10" r="8" fill="#1D2A4D"/>' },
    { l: 'B', cor: '#FFD23F', sh: '#C49A0C', tx: '#1D2A4D', forma: '<path d="M10 2 L19 18 H1Z" fill="#1D2A4D"/>' },
    { l: 'C', cor: '#6CC24A', sh: '#43892A', tx: '#1D2A4D', forma: '<rect x="2" y="2" width="16" height="16" rx="3" fill="#1D2A4D"/>' },
    { l: 'D', cor: '#F6B6B8', sh: '#D78A8D', tx: '#1D2A4D', forma: '<path d="M10 1l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 14.5 4.6 17.5l1.2-6L1.3 7.3l6.1-.7z" fill="#1D2A4D"/>' }
  ];
  function forma(i, tam) { return `<svg width="${tam}" height="${tam}" viewBox="0 0 20 20" aria-hidden="true">${ALTS[i].forma}</svg>`; }

  // Relógio de despertador (mesmo desenho do quadro). frac = parte que ainda falta.
  function relogio(r, num, frac, cor) {
    const R = r * 0.79, cx = r + 30, cy = r + 30, W = 2 * r + 60, f = Math.max(0, Math.min(0.9999, frac));
    const a1 = -Math.PI / 2 + f * 2 * Math.PI, large = f > 0.5 ? 1 : 0, n = (v) => v.toFixed(1);
    const cunha = f <= 0 ? '' : `<path d="M${cx} ${cy}L${cx} ${n(cy - R)}A${n(R)} ${n(R)} 0 ${large} 1 ${n(cx + Math.cos(a1) * R)} ${n(cy + Math.sin(a1) * R)}Z" fill="${cor}"/>`;
    let marcas = '';
    for (let k = 0; k < 12; k++) {
      const s = Math.sin(k / 12 * 6.283), c = Math.cos(k / 12 * 6.283);
      marcas += `<line x1="${n(cx + s * R * 0.82)}" y1="${n(cy - c * R * 0.82)}" x2="${n(cx + s * R * 0.92)}" y2="${n(cy - c * R * 0.92)}" stroke="#1D2A4D" stroke-width="${k % 3 ? 3 : 5}" stroke-linecap="round"/>`;
    }
    return `<svg width="${W}" height="${W + 10}" viewBox="0 0 ${W} ${W + 10}" role="img" aria-label="${num} segundos">
      <path d="M${n(cx - r * 0.6)} ${n(cy - r * 1.12)} a${n(r * 0.42)} ${n(r * 0.42)} 0 0 0 -${n(r * 0.66)} ${n(r * 0.52)} z" fill="#FFD23F" stroke="#C49A0C" stroke-width="4"/><path d="M${n(cx + r * 0.6)} ${n(cy - r * 1.12)} a${n(r * 0.42)} ${n(r * 0.42)} 0 0 1 ${n(r * 0.66)} ${n(r * 0.52)} z" fill="#FFD23F" stroke="#C49A0C" stroke-width="4"/>
      <path d="M${n(cx - r * 0.64)} ${n(cy + r * 0.8)} l-${n(r * 0.2)} ${n(r * 0.34)}" stroke="#B83239" stroke-width="${n(r * 0.12)}" stroke-linecap="round"/><path d="M${n(cx + r * 0.64)} ${n(cy + r * 0.8)} l${n(r * 0.2)} ${n(r * 0.34)}" stroke="#B83239" stroke-width="${n(r * 0.12)}" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#F2545B" stroke="#B83239" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy}" r="${n(R)}" fill="#FFFDF5"/>${cunha}${marcas}
      <circle cx="${cx}" cy="${cy}" r="${n(R * 0.5)}" fill="#FFFFFF"/><text x="${cx}" y="${n(cy + R * 0.22)}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${Math.round(R * 0.62)}" fill="#1D2A4D">${num}</text>
    </svg>`;
  }

  // Diminui a fonte até o texto caber na caixa (respostas longas nos blocos e botões)
  function caber(el, max, min) {
    let fs = max; el.style.fontSize = fs + 'px';
    while (fs > min && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
  function fmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }

  window.QSS = { PERSONAGENS, MAX_JOGADORES, TEMPO_RESPOSTA, TEMPO_VOTO, RODADAS, RODADA_ASSOCIACAO, NUMEROS, CATEGORIAS, ALTS, novoCodigo, limparCodigo, limparNome, uid, esc, img, pers, configurado, conectar, falar, sfx, pontos, categoria, iconeCat, forma, relogio, caber, fmt };
})();
