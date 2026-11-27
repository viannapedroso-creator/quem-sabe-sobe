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
  let asResp = [], asItens = [], asSai = 0, asOrdem = -1;
  let respostaUI = null, pw = { poder: null, alvo: null, enviado: false };
  let prazoLocal = 0, totalRel = 1, relEl = null, relCor = '#FFD23F', relR = 52, chaveTela = '', meuVoto = {}, minhaResp = {}, vibrou = '';

  function olhe() {
    if (respostaUI) { respostaUI.destruir(); respostaUI = null; }
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
    if ($('poderSel') && !$('poderSel').classList.contains('oculto') && prazoLocal) $('pwSeg').textContent = Math.ceil(Math.max(0, prazoLocal - Date.now()) / 1000) + ' s';
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
        // Desempate: só os finalistas respondem
        if (d.participantes && !d.participantes.includes(pid)) { olhe(); break; }
        // Enquanto a Coruja lê a pergunta, o celular fica em "Olhe para a TV". As opções aparecem com o relógio.
        if (!d.aberta && !enviada) { olhe(); break; }
        if (minha !== null && d.aberta && !naTv && rede) rede.enviar('responder', { pid, qid: q.id, op: minha });
        $('qCat').textContent = q.cat || ''; $('qCat').style.background = c.sombra;
        $('qTexto').textContent = q.texto || '';
        const meus = (d.efeitos || {})[pid] || [];
        if (chaveTela !== 'q' + q.id) {
          chaveTela = 'q' + q.id;
          if (respostaUI) respostaUI.destruir();
          $('qDica').innerHTML = window.QSS_EFEITOS.dica(meus);
          $('qDica').classList.toggle('oculto', !meus.length);
          mostrar('pergunta');
          respostaUI = window.QSS_EFEITOS.criar({
            dir: $('qDir'), ops: q.ops || [], efeitos: enviada ? [] : meus,
            sacudir: (px) => { $('pergunta').style.transform = px ? `translate(${px}px,0)` : ''; },
            aoEscolher: (k) => {
              if (minhaResp[q.id] !== undefined || !rede) return;
              minhaResp[q.id] = k; Q.sfx('sfx_toque'); vibrar(30);
              rede.enviar('responder', { pid, qid: q.id, op: k });
            }
          });
          if (minha !== null) respostaUI.escolhido(minha);
        }
        relogio($('qRel'), 34, '#FFD23F', Q.TEMPO_RESPOSTA, d.aberta ? d : null);
        if (d.aberta) chamar('q' + q.id);
        mostrar('pergunta');
        break;
      }
      case 'assoc': {
        // 15 · Associação: um item no meio, toque ou arraste para o lado certo
        const total = (d.itens || []).length;
        if (chaveTela !== 'a' + d.rodada) {
          chaveTela = 'a' + d.rodada; asResp = []; asSai = 0;
          const btn = (el, x) => { el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="${x.tx}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${x.icone}</svg>${Q.esc(x.nome)}`; el.style.background = x.cor; el.style.boxShadow = '0 7px 0 ' + x.sombra; el.style.color = x.tx; };
          btn($('aEsq'), d.esq); btn($('aDir'), d.dir);
        }
        const naTv = (d.prog || {})[pid] || 0;
        if (asResp.length > naTv && d.aberta && rede) rede.enviar('assoc', { pid, resp: asResp }); // reenvia se perdeu
        const terminou = asResp.length >= total && total > 0, o = (d.terminou || []).indexOf(pid);
        if (!d.aberta && !terminou) { olhe(); break; }
        asItens = d.itens || [];
        desenharAssoc(o);
        relogio($('aRel'), 40, '#2EC4B6', 20000, d.aberta ? d : null);
        if (d.aberta) chamar('a' + d.rodada);
        mostrar('assocCel');
        break;
      }
      case 'podEscolha': {
        // 09 · Escolher poder e alvo
        if (!d.aberta) { olhe(); break; }
        const chave = 'p' + d.rodada;
        if (chaveTela !== chave) { chaveTela = chave; pw = { poder: null, alvo: null, enviado: false }; }
        const ja = (d.escolhas || {})[pid];
        if (ja) { pw.poder = ja.poder; pw.alvo = ja.alvo; pw.enviado = true; }
        else if (pw.enviado && rede) rede.enviar('poder', { pid, poder: pw.poder, alvo: pw.alvo }); // reenvia se perdeu
        desenharPoder(m, eu);
        relogio(null, 0, '', Q.TEMPO_VOTO, d);
        if (pw.poder === null) chamar(chave);
        mostrar('poderSel');
        break;
      }
      case 'fim':
        // 21 · Fim de jogo: prêmio do vencedor ou colocação, e jogar de novo segurando o botão
        meuVoto = {}; minhaResp = {}; chaveTela = '';
        desenharFim(m, eu);
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



  function desenharPoder(m, eu) {
    const usos = eu.usos || {};
    $('pwGrade').innerHTML = Q.PODERES.map((p) => {
      const n = usos[p.id] || 0, esg = n <= 0, s = pw.poder === p.id;
      return `<button type="button" class="pwc${s ? ' sel' : ''}${pw.enviado ? ' travado' : ''}" data-p="${p.id}" ${esg || pw.enviado ? 'disabled' : ''} aria-pressed="${s}" aria-label="${p.nome}${esg ? ', esgotado' : ', resta ' + n}">
        <span class="ci" style="background:${p.cor}"><img src="${Q.imgPoder(p.id)}" alt=""></span>
        <span class="nm">${p.nome}</span><span class="us">${esg ? 'Esgotado' : 'Resta ' + n + 'x'}</span></button>`;
    }).join('');
    const espelho = pw.poder === 'espelho';
    $('pwEspelho').classList.toggle('oculto', !espelho);
    $('pwAlvos').classList.toggle('oculto', espelho);
    $('pwEuImg').src = Q.img(eu.char);
    $('pwAlvos').innerHTML = (m.jogadores || []).filter((j) => j.pid !== pid).map((j) => {
      const s = pw.alvo === j.pid;
      return `<button type="button" class="alv${s ? ' sel' : ''}" data-a="${j.pid}" ${pw.enviado ? 'disabled' : ''} aria-pressed="${s}"><span class="av"><img src="${Q.img(j.char)}" alt=""></span><span>${Q.esc(j.nome)}</span></button>`;
    }).join('');
    const alvoNome = ((m.jogadores || []).find((j) => j.pid === pw.alvo) || {}).nome;
    const pronto = pw.poder && (espelho || pw.alvo);
    const b = $('pwOk');
    b.classList.toggle('pronto', !!pronto && !pw.enviado);
    b.disabled = !pronto || pw.enviado;
    b.textContent = pw.enviado ? 'Poder escolhido!' : !pw.poder ? 'Escolha um poder' : espelho ? 'Usar Espelho' : !pw.alvo ? 'Escolha o alvo' : 'Jogar em ' + alvoNome;
  }
  const redesenharPoder = () => { if (ultimo) desenharPoder(ultimo, (ultimo.jogadores || []).find((j) => j.pid === pid) || {}); };
  $('pwGrade').addEventListener('click', (e) => {
    const b = e.target.closest('.pwc'); if (!b || b.disabled || pw.enviado) return;
    pw.poder = b.dataset.p; Q.sfx('sfx_toque'); vibrar(15); redesenharPoder();
  });
  $('pwAlvos').addEventListener('click', (e) => {
    const b = e.target.closest('.alv'); if (!b || b.disabled || pw.enviado) return;
    pw.alvo = b.dataset.a; Q.sfx('sfx_toque'); vibrar(15); redesenharPoder();
  });
  $('pwOk').addEventListener('click', () => {
    if (pw.enviado || !pw.poder || !rede) return;
    if (pw.poder !== 'espelho' && !pw.alvo) return;
    pw.enviado = true; Q.sfx('sfx_pronto'); vibrar([30, 40, 60]);
    rede.enviar('poder', { pid, poder: pw.poder, alvo: pw.poder === 'espelho' ? null : pw.alvo });
    redesenharPoder();
  });


  // ---------- Associação ----------
  function desenharAssoc(o) {
    if (o !== undefined) asOrdem = o;
    const total = asItens.length, i = asResp.length, fim = i >= total;
    $('aProg').innerHTML = asItens.map((_, k) => `<span style="background:${k < i ? '#2EC4B6' : k === i && !fim ? '#FFD23F' : '#FFFFFF'};box-shadow:0 3px 0 ${k < i ? '#1A8A80' : '#D3E2F7'}"></span>`).join('');
    $('aCarta').classList.toggle('oculto', fim); $('aDica').classList.toggle('oculto', fim);
    $('aFim').classList.toggle('oculto', !fim);
    $('aEsq').disabled = fim; $('aDir').disabled = fim;
    if (fim) { $('aFimTx').textContent = asOrdem >= 0 ? `Você foi o ${asOrdem + 1}º a terminar. Olhe para a TV.` : 'Olhe para a TV.'; return; }
    $('aNum').textContent = `ITEM ${i + 1} DE ${total}`;
    $('aItem').textContent = asItens[i];
  }
  function ligar(l) {
    if (asSai || asResp.length >= asItens.length || !rede || !ultimo || !(ultimo.d || {}).aberta) return;
    asSai = l === 'E' ? -1 : 1;
    const b = $(l === 'E' ? 'aEsq' : 'aDir'); b.style.transform = 'scale(1.06)';
    const c = $('aCarta'); c.style.transition = 'transform .25s ease, opacity .25s ease'; c.style.transform = `translateX(${asSai * 520}px) rotate(${asSai * 24}deg)`; c.style.opacity = 0;
    Q.sfx('sfx_toque'); vibrar(15);
    setTimeout(() => {
      asResp.push(l); asSai = 0; b.style.transform = '';
      c.style.transition = 'none'; c.style.transform = ''; c.style.opacity = 1;
      rede.enviar('assoc', { pid, resp: asResp });
      if (asResp.length >= asItens.length) { Q.sfx('sfx_pronto'); vibrar([30, 40, 60]); }
      desenharAssoc();
    }, 260);
  }
  $('aEsq').addEventListener('click', () => ligar('E'));
  $('aDir').addEventListener('click', () => ligar('D'));
  // Arrastar o item para um dos lados
  let arrX = null, arrDx = 0;
  $('aMeio').addEventListener('pointerdown', (e) => { if (asSai) return; arrX = e.clientX; arrDx = 0; $('aCarta').style.transition = 'none'; });
  $('aMeio').addEventListener('pointermove', (e) => {
    if (arrX === null) return; arrDx = e.clientX - arrX;
    $('aCarta').style.transform = `translateX(${arrDx}px) rotate(${(arrDx / 22).toFixed(1)}deg)`;
    $('aEsq').style.transform = arrDx < -60 ? 'scale(1.06)' : ''; $('aDir').style.transform = arrDx > 60 ? 'scale(1.06)' : '';
  });
  const soltarArr = () => {
    if (arrX === null) return; arrX = null;
    if (arrDx < -90) ligar('E'); else if (arrDx > 90) ligar('D');
    else { const c = $('aCarta'); c.style.transition = 'transform .25s ease'; c.style.transform = ''; $('aEsq').style.transform = ''; $('aDir').style.transform = ''; }
  };
  $('aMeio').addEventListener('pointerup', soltarArr); $('aMeio').addEventListener('pointercancel', soltarArr);


  // ---------- 21 · Celular do vencedor e dos outros ----------
  const TROFEU = '<svg width="130" height="156" viewBox="0 0 200 240" aria-hidden="true"><path d="M52 40 C10 40 10 104 62 108" fill="none" stroke="#E0A800" stroke-width="16" stroke-linecap="round"/><path d="M148 40 C190 40 190 104 138 108" fill="none" stroke="#E0A800" stroke-width="16" stroke-linecap="round"/><path d="M44 22 H156 V70 C156 112 132 136 100 136 C68 136 44 112 44 70Z" fill="#FFD23F" stroke="#C49A0C" stroke-width="6"/><path d="M60 34 H80 V72 C80 96 88 110 98 118 C74 114 60 96 60 72Z" fill="#FFFFFF" opacity=".45"/><rect x="86" y="134" width="28" height="34" fill="#E0A800"/><rect x="58" y="166" width="84" height="24" rx="8" fill="#FFC531" stroke="#C49A0C" stroke-width="5"/><rect x="44" y="188" width="112" height="40" rx="10" fill="#4F8DF7" stroke="#2F5FB8" stroke-width="5"/><path d="M100 52 l8 16 18 3 -13 12 3 18 -16 -9 -16 9 3 -18 -13 -12 18 -3z" fill="#FFFFFF" opacity=".9"/></svg>';
  const PRESENTE = '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="12" y="40" width="76" height="52" rx="8" fill="#FFD23F"/><rect x="6" y="28" width="88" height="18" rx="6" fill="#FFC531"/><rect x="44" y="28" width="12" height="64" fill="#F2545B"/><path d="M50 28 C36 8 18 16 30 28 Z M50 28 C64 8 82 16 70 28 Z" fill="#F2545B"/></svg>';
  let fimChave = '', presenteAberto = false;
  function desenharFim(m, eu) {
    const d = m.d || {}, fi = $('fimInfo');
    const tem = !!d.vencedor;
    $('pronto').classList.toggle('modoFim', tem); fi.classList.toggle('oculto', !tem);
    if (!tem) return;
    const venc = (m.jogadores || []).find((j) => j.pid === d.vencedor) || {};
    const chave = d.vencedor + '|' + (d.ordem || []).join(',');
    if (chave !== fimChave) { fimChave = chave; presenteAberto = false; }
    if (d.vencedor === pid) {
      fi.innerHTML = `<div class="lado">${TROFEU}<b>Você venceu,<br>${Q.esc(eu.nome)}!</b></div>
        <div class="txt"><span class="chip">SEU PRÊMIO</span>${presenteAberto
          ? `<div id="inutil"><small>CONHECIMENTO INÚTIL</small><p>${Q.esc(d.inutil || '')}</p><span style="font-size:16px;font-weight:800;color:var(--tinta2)">Leia em voz alta para a sala!</span></div>`
          : `<button type="button" id="presente">${PRESENTE}<span><b>Um conhecimento inútil</b><small>Toque para abrir</small></span></button>`}</div>`;
      const b = $('presente'); if (b) b.addEventListener('click', () => { presenteAberto = true; Q.sfx('sfx_certo'); vibrar([30, 40, 80]); desenharFim(ultimo, eu); });
    } else {
      const pos = (d.ordem || []).indexOf(pid) + 1, deg = (d.degraus || {})[pid];
      const cor = pos === 1 ? '#FFC531' : pos === 2 ? '#4F8DF7' : pos === 3 ? '#F2545B' : '#9AA6BF';
      fi.innerHTML = `<div class="degrau-fim"><span style="background:${cor}">${pos}º</span><img src="${Q.img(eu.char)}" alt="${Q.esc(eu.nome)}"></div>
        <div class="txt"><span class="chip">FIM DE JOGO</span><h1>${Q.esc(venc.nome || '')} venceu!</h1>
        <p>Você ficou em <span style="color:var(--tinta)">${pos}º lugar</span>${deg !== undefined ? `, no degrau ${deg}` : ''}. ${Q.esc(venc.nome || 'O vencedor')} vai ler o prêmio, um conhecimento inútil. Preste atenção!</p></div>`;
    }
  }

  // Volta sozinho para a sala depois de recarregar a página
  if (daUrl && ler('nome') && ler('sala') === daUrl && Q.configurado()) entrar(daUrl, ler('nome'));
})();
