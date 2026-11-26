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
    if (m.fase !== 'sala') { mostrar('olhe'); return; }
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

  // Volta sozinho para a sala depois de recarregar a página
  if (daUrl && ler('nome') && ler('sala') === daUrl && Q.configurado()) entrar(daUrl, ler('nome'));
})();
