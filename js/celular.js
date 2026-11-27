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
  let modoDeNovo = false;
  function desenharPronto(m, eu, deNovo) {
    modoDeNovo = !!deNovo;
    const p = Q.pers(eu.char);
    $('euImg').src = Q.img(eu.char); $('euNome').textContent = eu.nome; $('euPers').textContent = p ? p.nome : '';
    confirmado = !!eu.pronto;
    const js = m.jogadores || [], pr = js.filter((j) => j.pronto).length;
    pintarBotao(confirmado ? 1 : (t0 ? Math.min(1, (Date.now() - t0) / 3000) : 0));
    $('msgPronto').textContent = confirmado
      ? `Pronto! Esperando os outros: ${pr} de ${js.length}.` + (js.length < 2 ? ' Precisa de pelo menos 2 jogadores.' : '')
      : modoDeNovo ? 'Para jogar de novo, todos seguram o botão por 3 segundos.' : 'Quando todos estiverem na sala, segurem o botão por 3 segundos.';
    $('bTrocar').textContent = confirmado ? 'Cancelar' : 'Trocar personagem';
    $('bTrocar').classList.toggle('oculto', modoDeNovo && !confirmado);
  }
  function pintarBotao(v) {
    $('anel').setAttribute('stroke-dashoffset', (578 * (1 - v)).toFixed(1));
    $('bSegurar').classList.toggle('ok', v >= 1);
    $('r1').textContent = v >= 1 ? 'Pronto!' : 'Segure';
    $('r2').textContent = v >= 1 ? 'esperando' : modoDeNovo ? 'jogar de novo' : 'para iniciar';
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


  // ---------- Partida (telas 06, 07 e 11 do quadro) ----------
  let prazoLocal = 0, totalRel = 1, relEl = null, relCor = '#FFD23F', relR = 52, chaveTela = '', meuVoto = {}, minhaResp = {}, vibrou = '';

  function olhe() {
    $('olheChip').textContent = 'A CORUJA ESTÁ FALANDO'; $('olheTit').textContent = 'Olhe para a TV!';
    $('olheTxt').textContent = 'Agora é hora de ouvir. Quando for a sua vez, o celular vibra e mostra o que fazer.';
    mostrar('olhe');
  }
  // Relógio: a TV manda quanto falta; o celular conta a partir de quando recebeu
  function relogio(el, r, cor, total, d) {
    relEl = el; relR = r; relCor = cor; totalRel = total;
    prazoLocal = d && d.restante ? Date.now() + d.restante : 0;
  }
  let ultimoSeg = -1;
  (function anima() {
    if (relEl && relEl.offsetParent) {
      const rest = prazoLocal ? Math.max(0, prazoLocal - Date.now()) : totalRel;
      const seg = Math.ceil(rest / 1000) + (prazoLocal ? 0 : 1000);
      if (seg !== ultimoSeg) { ultimoSeg = seg; relEl.innerHTML = Q.relogio(relR, Math.ceil(rest / 1000), rest / totalRel, relCor); }
    }
    requestAnimationFrame(anima);
  })();
  function chamar(chave) { if (vibrou !== chave) { vibrou = chave; vibrar([40, 60, 40]); } }

  function desenharPartida(m, eu) {
    const d = m.d || {};
    switch (m.fase) {
      case 'votacao': {
        const meu = meuVoto[d.rodada] !== undefined ? meuVoto[d.rodada] : (d.votos || {})[pid];
        // reenvia o voto se a mensagem se perdeu
        if (meuVoto[d.rodada] !== undefined && d.aberta && (d.votos || {})[pid] !== meuVoto[d.rodada] && rede) rede.enviar('votar', { pid, i: meuVoto[d.rodada] });
        const chave = 'v' + d.rodada + '|' + meu + '|' + d.aberta;
        if (chave !== chaveTela) {
          chaveTela = chave;
          $('portasCel').innerHTML = (d.portas || []).map((cat, k) => {
            const c = Q.categoria(cat), sel = meu === k;
            return `<button type="button" class="pc2${sel ? ' sel' : meu !== undefined && meu !== null ? ' outra' : ''}" data-i="${k}" aria-pressed="${sel}" aria-label="${Q.esc(cat)}" ${d.aberta ? '' : 'disabled'}>
              <span class="aro" style="background:${c.sombra}"></span><span class="folha" style="background:${c.cor}"></span><span class="mac"></span>
              <span class="placa" style="box-shadow:0 4px 0 ${c.sombra}">${Q.iconeCat(cat, 34)}<span>${Q.esc(cat)}</span></span>
              ${sel ? '<span class="seu">SEU VOTO</span>' : ''}</button>`;
          }).join('');
        }
        relogio($('vRel'), 52, '#6CC24A', Q.TEMPO_VOTO, d.aberta ? d : null);
        if (d.aberta) chamar('v' + d.rodada);
        mostrar('votacao');
        break;
      }
      case 'pergunta': {
        const q = d.q || {}, c = Q.categoria(q.cat);
        const minha = minhaResp[q.id] !== undefined ? minhaResp[q.id] : null;
        const naTv = (d.respondeu || []).includes(pid), enviada = minha !== null || naTv;
        if (minha !== null && d.aberta && !naTv && rede) rede.enviar('responder', { pid, qid: q.id, op: minha });
        $('qCat').textContent = q.cat || ''; $('qCat').style.background = c.sombra;
        $('qTexto').textContent = q.texto || '';
        const chave = q.id + '|' + d.aberta + '|' + minha + '|' + enviada;
        if (chave !== chaveTela) {
          chaveTela = chave;
          $('opsCel').className = d.aberta ? '' : 'esperando';
          $('opsCel').innerHTML = (q.ops || []).map((o, k) => {
            const a = Q.ALTS[k], sel = minha === k;
            return `<button type="button" class="oc2${sel ? ' sel' : minha !== null ? ' outra' : ''}" data-op="${k}" aria-pressed="${sel}" style="background:${a.cor};box-shadow:0 6px 0 ${a.sh};color:${a.tx}" ${!d.aberta || enviada ? 'disabled' : ''}>
              <span class="fm">${Q.forma(k, 22)}</span><span class="tx">${Q.esc(o)}</span></button>`;
          }).join('');
          requestAnimationFrame(() => $('opsCel').querySelectorAll('.tx').forEach((t) => Q.caber(t, 44, 15)));
        }
        $('enviado').classList.toggle('oculto', !enviada);
        relogio($('qRel'), 34, '#FFD23F', Q.TEMPO_RESPOSTA, d.aberta ? d : null);
        if (d.aberta) chamar('q' + q.id);
        mostrar('pergunta');
        break;
      }
      case 'fim':
        // Jogar de novo: todos seguram o botão, na mesma sala
        meuVoto = {}; minhaResp = {}; chaveTela = '';
        desenharPronto(m, eu, true); mostrar('pronto');
        break;
      default:
        olhe();
    }
  }

  $('portasCel').addEventListener('click', (e) => {
    const b = e.target.closest('.pc2'); if (!b || b.disabled || !rede || !ultimo) return;
    const i = +b.dataset.i, r = (ultimo.d || {}).rodada;
    meuVoto[r] = i; Q.sfx('sfx_toque'); vibrar(20);
    rede.enviar('votar', { pid, i });
    desenharPartida(ultimo, (ultimo.jogadores || []).find((j) => j.pid === pid));
  });
  $('opsCel').addEventListener('click', (e) => {
    const b = e.target.closest('.oc2'); if (!b || b.disabled || !rede || !ultimo) return;
    const q = (ultimo.d || {}).q || {};
    if (minhaResp[q.id] !== undefined) return;
    minhaResp[q.id] = +b.dataset.op; Q.sfx('sfx_toque'); vibrar(30);
    rede.enviar('responder', { pid, qid: q.id, op: +b.dataset.op });
    desenharPartida(ultimo, (ultimo.jogadores || []).find((j) => j.pid === pid));
  });

  // Volta sozinho para a sala depois de recarregar a página
  if (daUrl && ler('nome') && ler('sala') === daUrl && Q.configurado()) entrar(daUrl, ler('nome'));
})();
