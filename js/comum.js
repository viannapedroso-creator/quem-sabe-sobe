// Partes compartilhadas entre a TV (anfitriã) e o celular (controle).
(function () {
  const PERSONAGENS = [
    { id: 'bombeiro', nome: 'Bombeiro' },
    { id: 'astronauta', nome: 'Astronauta' },
    { id: 'marinheiro', nome: 'Marinheiro' },
    { id: 'cowboy', nome: 'Cowboy' },
    { id: 'vaca', nome: 'Vaca' },
    { id: 'hotdog', nome: 'Cachorro-Quente' },
    { id: 'cientista', nome: 'Cientista' },
    { id: 'roqueira', nome: 'Roqueira' },
    { id: 'dinossauro', nome: 'Dinossauro' },
    { id: 'coxinha', nome: 'Coxinha' },
    { id: 'mergulhador', nome: 'Mergulhador' },
    { id: 'vovo', nome: 'Vovó' }
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
      const tons = { sfx_entrar: [660, 990], sfx_toque: [520], sfx_comecar: [523, 659, 784, 1046], sfx_pronto: [784, 1046], sfx_sair: [440, 330] };
      (tons[nome] || [600]).forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (e) {}
  }

  window.QSS = { PERSONAGENS, MAX_JOGADORES, novoCodigo, limparCodigo, limparNome, uid, esc, img, pers, configurado, conectar, falar, sfx };
})();
