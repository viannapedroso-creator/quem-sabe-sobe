// Celular: controle do jogador. Só manda intenções; quem decide é a TV.
(function () {
  const Q = window.QSS;
  const $ = (id) => document.getElementById(id);
  const guardar = (k, v) => { try { localStorage.setItem('qss_' + k, v); } catch (e) {} };
  const ler = (k) => { try { return localStorage.getItem('qss_' + k) || ''; } catch (e) { return ''; } };

  let pid = ler('pid'); if (!pid) { pid = Q.uid(); guardar('pid', pid); }
  let rede = null, codigo = '', ultimo = null, pulso = null, esperaTimer = null;

  function mostrar(id) { document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('oculto', t.id !== id)); }
  function status(txt) { const s = $('status'); s.textContent = txt || ''; s.classList.toggle('oculto', !txt); }
  function erro(txt) { $('erro').textContent = txt || ''; }
  function vibrar(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  // Tela cheia: esconde a barra do navegador (Android). No iPhone, o jeito é "Adicionar à Tela de Início".
  const docEl = document.documentElement;
  const podeCheia = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const emCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  function telaCheia() {
    if (!podeCheia || emCheia()) return;
    try {
      const p = docEl.requestFullscreen ? docEl.requestFullscreen({ navigationUI: 'hide' }) : docEl.webkitRequestFullscreen();
      Promise.resolve(p).then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
    } catch (e) {}
  }
  function botaoCheia() { $('cheia').classList.toggle('oculto', !podeCheia || emCheia()); }
  document.addEventListener('fullscreenchange', botaoCheia); document.addEventListener('webkitfullscreenchange', botaoCheia);
  $('cheia').addEventListener('click', telaCheia);
  // O primeiro toque em qualquer botão já pede tela cheia
  document.addEventListener('pointerup', (e) => { if (e.target.closest('button')) telaCheia(); }, { once: true });
  botaoCheia();

  // Dica só para iPhone/iPad no Safari, mostrada uma vez
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !emCheia() && !ler('dica_ios')) $('dicaIos').classList.remove('oculto');
  $('bDicaIos').addEventListener('click', () => { $('dicaIos').classList.add('oculto'); guardar('dica_ios', '1'); });

  // Senha vinda do QR code
  const daUrl = Q.limparCodigo(new URLSearchParams(location.search).get('sala'));
  $('fCodigo').value = daUrl || (ler('sala') || '');
  $('fNome').value = ler('nome');

  $('fEntrar').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = Q.limparCodigo($('fCodigo').value), n = Q.limparNome($('fNome').value);
    if (c.length < 4) return erro('Digite a senha que aparece na TV.');
    if (!n) return erro('Digite seu nome.');
    if (!Q.configurado()) return erro('O jogo ainda não foi configurado.');
    guardar('sala', c); guardar('nome', n); erro('');
    entrar(c, n);
  });

  function entrar(c, n) {
    if (rede) rede.sair();
    codigo = c; ultimo = null;
    $('bEntrar').disabled = true; $('bEntrar').textContent = 'Entrando…';
    rede = Q.conectar(codigo, aoReceber, (st) => {
      if (st === 'SUBSCRIBED') { status(''); rede.enviar('entrar', { pid, nome: n }); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') status('Reconectando…');
    });
    clearInterval(pulso); pulso = setInterval(() => rede && rede.enviar('ola', { pid }), 4000);
    clearTimeout(esperaTimer);
    esperaTimer = setTimeout(() => {
      if (!ultimo) { voltarEntrada(); erro('Não achei essa sala. Confira a senha na TV.'); }
    }, 7000);
  }

  function voltarEntrada() {
    if (rede) rede.sair(); rede = null; clearInterval(pulso);
    $('bEntrar').disabled = false; $('bEntrar').textContent = 'Entrar';
    mostrar('entrar');
  }

  function aoReceber(m) {
    if (m.t === 'recusado' && m.pid === pid) { voltarEntrada(); erro(m.motivo || 'Não deu para entrar.'); return; }
    if (m.t !== 'estado') return;
    const eu = (m.jogadores || []).find((j) => j.pid === pid);
    if (!ultimo && !eu) { rede.enviar('entrar', { pid, nome: ler('nome') }); }
    ultimo = m;
    if (!eu) return;
    clearTimeout(esperaTimer);
    $('bEntrar').disabled = false; $('bEntrar').textContent = 'Entrar';
    if (m.fase !== 'sala') { desenharPartida(m, eu); return; }
    if (!eu.char) { desenharGrade(m, eu); mostrar('escolher'); return; }
    desenharPronto(m, eu); mostrar('pronto');
  }

  function desenharGrade(m, eu) {
    $('olaNome').textContent = 'Oi, ' + eu.nome + '!';
    const donos = {}; (m.jogadores || []).forEach((j) => { if (j.char) donos[j.char] = j; });
    $('grade').innerHTML = Q.PERSONAGENS.map((p) => {
      const d = donos[p.id], meu = d && d.pid === pid, tomado = d && !meu;
      return `<button type="button" class="pc${meu ? ' meu' : ''}${tomado ? ' tomado' : ''}" data-id="${p.id}" ${tomado ? 'disabled' : ''} aria-label="${Q.esc(p.nome)}${tomado ? ', já escolhido' : ''}">
        <img src="${Q.img(p.id)}" alt=""><span>${tomado ? Q.esc(d.nome) : Q.esc(p.nome)}</span></button>`;
    }).join('');
  }
  $('grade').addEventListener('click', (e) => {
    const b = e.target.closest('.pc'); if (!b || b.disabled || !rede) return;
    Q.sfx('sfx_toque'); vibrar(20);
    rede.enviar('escolher', { pid, char: b.dataset.id });
  });

  // Segurar por 3 segundos
  let t0 = 0, raf = 0, confirmado = false;
  function desenharPronto(m, eu) {
    const p = Q.pers(eu.char);
    $('euImg').src = Q.img(eu.char); $('euNome').textContent = eu.nome; $('euPers').textContent = p ? p.nome : '';
    confirmado = !!eu.pronto;
    const js = m.jogadores || [], pr = js.filter((j) => j.pronto).length;
    pintarBotao(confirmado ? 1 : (t0 ? Math.min(1, (Date.now() - t0) / 3000) : 0));
    $('msgPronto').textContent = confirmado
      ? `Pronto! Esperando os outros: ${pr} de ${js.length}.` + (js.length < 2 ? ' Precisa de pelo menos 2 jogadores.' : '')
      : 'Quando todos estiverem na sala, segurem o botão por 3 segundos.';
    $('bTrocar').textContent = confirmado ? 'Cancelar' : 'Trocar personagem';
  }
  function pintarBotao(v) {
    $('anel').setAttribute('stroke-dashoffset', (578 * (1 - v)).toFixed(1));
    $('bSegurar').classList.toggle('ok', v >= 1);
    $('r1').textContent = v >= 1 ? 'Pronto!' : 'Segure';
    $('r2').textContent = v >= 1 ? 'esperando' : 'para iniciar';
  }
  function soltar() { if (confirmado) return; cancelAnimationFrame(raf); t0 = 0; pintarBotao(0); }
  $('bSegurar').addEventListener('pointerdown', (e) => {
    if (confirmado || !rede) return;
    e.preventDefault(); t0 = Date.now(); vibrar(15);
    const passo = () => {
      const v = Math.min(1, (Date.now() - t0) / 3000); pintarBotao(v);
      if (v >= 1) { confirmado = true; t0 = 0; vibrar([30, 40, 60]); Q.sfx('sfx_pronto'); rede.enviar('pronto', { pid, on: true }); return; }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => $('bSegurar').addEventListener(ev, soltar));
  $('bSegurar').addEventListener('contextmenu', (e) => e.preventDefault());

  $('bTrocar').addEventListener('click', () => {
    if (!rede) return;
    if (confirmado) { confirmado = false; pintarBotao(0); rede.enviar('pronto', { pid, on: false }); }
    else rede.enviar('escolher', { pid, char: null });
  });


  // ---------- Partida ----------
  let prazoLocal = 0, barra = null, tempoTotal = 1, chaveTela = '', meuVoto = {}, minhaResp = {}, vibrouRes = '';
  const CORES = ['c0', 'c1', 'c2'];

  function posicao(m, eu) {
    const js = (m.jogadores || []).slice().sort((a, b) => b.pontos - a.pontos);
    return 1 + js.filter((j) => j.pontos > eu.pontos).length;
  }
  function olhe(chip, tit, txt) {
    $('olheChip').textContent = chip; $('olheTit').textContent = tit; $('olheTxt').textContent = txt;
    mostrar('olhe');
  }
  // Barra de tempo: a TV manda quanto falta; o celular conta a partir do momento em que recebeu
  function marcarPrazo(d, total, el) {
    tempoTotal = total; barra = el;
    prazoLocal = d && d.restante ? Date.now() + d.restante : 0;
  }
  (function anima() {
    if (barra) {
      const r = prazoLocal ? Math.max(0, prazoLocal - Date.now()) : 0;
      barra.querySelector('i').style.width = (100 * r / tempoTotal).toFixed(1) + '%';
      barra.classList.toggle('urgente', r > 0 && r < 5000);
    }
    requestAnimationFrame(anima);
  })();

  function desenharPartida(m, eu) {
    const d = m.d || {};
    const pos = posicao(m, eu), total = (m.jogadores || []).length;
    switch (m.fase) {
      case 'porta': {
        const chave = 'porta' + d.num + (d.fechada ? 'f' + d.vencedora : '');
        $('portaNum').textContent = `Pergunta ${d.num} de ${d.total}`;
        marcarPrazo(d, Q.TEMPO_PORTA, $('portaTempo'));
        const meu = meuVoto[d.num] !== undefined ? meuVoto[d.num] : (d.votos || {})[pid];
        if (meuVoto[d.num] !== undefined && !d.fechada && (d.votos || {})[pid] !== meuVoto[d.num] && rede) rede.enviar('votar', { pid, i: meuVoto[d.num] });
        if (chave + meu !== chaveTela) {
          chaveTela = chave + meu;
          $('portasCel').innerHTML = (d.portas || []).map((c, k) => {
            const cls = d.fechada ? (k === d.vencedora ? ' meu' : ' apagada') : (meu === k ? ' meu' : '');
            return `<button type="button" class="pt ${CORES[k]}${cls}" data-i="${k}" ${d.fechada ? 'disabled' : ''}><small>${k + 1}</small>${Q.esc(c)}</button>`;
          }).join('');
        }
        mostrar('porta');
        break;
      }
      case 'pergunta': {
        const q = d.q || {};
        const minha = minhaResp[q.id] !== undefined ? minhaResp[q.id] : null;
        const naTv = (d.respondeu || []).includes(pid);
        const enviada = minha !== null || naTv;
        // Se a mensagem se perdeu, reenvia junto com a próxima atualização da TV
        if (minha !== null && d.aberta && !naTv && rede) rede.enviar('responder', { pid, qid: q.id, op: minha });
        $('qCat').textContent = (q.cat || '').toUpperCase(); $('qNum').textContent = `Pergunta ${d.num} de ${d.total}`;
        $('qTexto').textContent = q.texto || '';
        marcarPrazo(d.aberta ? d : null, Q.TEMPO_RESPOSTA, $('qTempo'));
        const chave = q.id + '|' + d.aberta + '|' + minha + '|' + enviada;
        if (chave !== chaveTela) {
          chaveTela = chave;
          $('opsCel').className = !d.aberta ? 'fechado' : enviada ? 'enviado' : '';
          $('opsCel').innerHTML = (q.ops || []).map((o, k) =>
            `<button type="button" class="oc oc${k}${minha === k ? ' meu' : ''}" data-op="${k}" ${!d.aberta || enviada ? 'disabled' : ''}><b>${'ABCD'[k]}</b><span>${Q.esc(o)}</span></button>`).join('');
        }
        $('qMsg').textContent = enviada ? 'Resposta enviada! Agora é torcer.' : d.aberta ? 'Toque na resposta. Rápido vale mais!' : 'Ouça a pergunta…';
        mostrar('responder');
        break;
      }
      case 'revela': {
        const r = (d.resultados || {})[pid];
        const q = d.q || {};
        const b = $('rBola');
        b.className = 'bola ' + (!r ? 'nada' : r.ok ? 'ok' : 'erro');
        b.textContent = !r ? '…' : r.ok ? '✓' : '✗';
        $('rTit').textContent = !r ? 'Não deu tempo!' : r.ok ? 'Acertou!' : 'Errou!';
        $('rPts').textContent = r && r.ok ? '+' + Q.fmt(r.pts) : '+0';
        $('rCerta').textContent = `Resposta certa: ${'ABCD'[d.certa]}) ${(q.ops || [])[d.certa] || ''}`;
        $('rPos').textContent = `Você está em ${pos}º de ${total}, com ${Q.fmt(eu.pontos)} pontos.`;
        if (vibrouRes !== q.id) { vibrouRes = q.id; vibrar(r && r.ok ? [40, 60, 40] : 200); Q.sfx(r && r.ok ? 'sfx_certo' : 'sfx_errado'); }
        chaveTela = '';
        mostrar('resultado');
        break;
      }
      case 'ranking':
        olhe('PLACAR', `Você está em ${pos}º lugar`, `${Q.fmt(eu.pontos)} pontos. A próxima pergunta já vem!`);
        break;
      case 'fim':
        olhe('FIM DA 1ª FASE', pos === 1 ? 'Você ficou em 1º lugar!' : `Você ficou em ${pos}º lugar`, `${Q.fmt(eu.pontos)} pontos. A pirâmide chega na próxima etapa do jogo.`);
        break;
      case 'explica':
        olhe('A CORUJA ESTÁ EXPLICANDO', 'Olhe para a TV!', 'Você responde por aqui. Quanto mais rápido acertar, mais pontos.');
        break;
      default:
        meuVoto = {}; minhaResp = {}; vibrouRes = '';
        olhe('A CORUJA ESTÁ FALANDO', 'Olhe para a TV!', 'Agora é hora de ouvir. Quando for a sua vez, o celular mostra o que fazer.');
    }
  }

  $('portasCel').addEventListener('click', (e) => {
    const b = e.target.closest('.pt'); if (!b || b.disabled || !rede || !ultimo) return;
    const i = +b.dataset.i, num = (ultimo.d || {}).num;
    meuVoto[num] = i; Q.sfx('sfx_voto'); vibrar(20);
    rede.enviar('votar', { pid, i });
    desenharPartida(ultimo, (ultimo.jogadores || []).find((j) => j.pid === pid));
  });
  $('opsCel').addEventListener('click', (e) => {
    const b = e.target.closest('.oc'); if (!b || b.disabled || !rede || !ultimo) return;
    const q = (ultimo.d || {}).q || {};
    if (minhaResp[q.id] !== undefined) return;
    minhaResp[q.id] = +b.dataset.op; Q.sfx('sfx_resposta'); vibrar(30);
    rede.enviar('responder', { pid, qid: q.id, op: +b.dataset.op });
    desenharPartida(ultimo, (ultimo.jogadores || []).find((j) => j.pid === pid));
  });

  // Volta sozinho para a sala depois de recarregar a página
  if (daUrl && ler('nome') && ler('sala') === daUrl && Q.configurado()) entrar(daUrl, ler('nome'));
})();
