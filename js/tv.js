// TV: anfitriã da sala. Ela decide tudo e manda o estado completo para os celulares.
(function () {
  const Q = window.QSS;
  const $ = (id) => document.getElementById(id);

  // Escala o palco de 1920×1080 para caber na janela
  function ajustar() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    $('palco').style.transformOrigin = '50% 50%';
    $('palco').style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener('resize', ajustar); ajustar();

  function mostrar(id) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('oculto', t.id !== id));
  }
  function aviso(txt) { const a = $('aviso'); a.textContent = txt || ''; a.classList.toggle('oculto', !txt); }

  const estado = { fase: 'sala', jogadores: [] }; // jogadores: {pid, nome, char, pronto, visto}
  let rede = null, codigo = '';

  function enviarEstado() {
    if (!rede) return;
    rede.enviar('estado', {
      fase: estado.fase,
      jogadores: estado.jogadores.map((j) => ({ pid: j.pid, nome: j.nome, char: j.char, pronto: j.pronto, online: Date.now() - j.visto < 12000 }))
    });
  }

  function aoReceber(m) {
    const agora = Date.now();
    const j = estado.jogadores.find((x) => x.pid === m.pid);
    if (j) j.visto = agora;
    switch (m.t) {
      case 'ola':
        break;
      case 'entrar': {
        const nome = Q.limparNome(m.nome);
        if (!m.pid || !nome) break;
        if (j) { j.nome = nome; break; }
        if (estado.fase !== 'sala') { rede.enviar('recusado', { pid: m.pid, motivo: 'A partida já começou.' }); return; }
        if (estado.jogadores.length >= Q.MAX_JOGADORES) { rede.enviar('recusado', { pid: m.pid, motivo: 'A sala está cheia (8 jogadores).' }); return; }
        estado.jogadores.push({ pid: m.pid, nome, char: null, pronto: false, visto: agora, novo: true });
        Q.sfx('sfx_entrar');
        break;
      }
      case 'escolher': {
        if (!j || estado.fase !== 'sala') break;
        if (m.char === null) { j.char = null; j.pronto = false; break; } // voltou para a escolha
        if (!Q.pers(m.char)) break;
        const dono = estado.jogadores.find((x) => x.char === m.char);
        if (dono && dono !== j) break; // personagem já é de outro jogador
        j.char = m.char; j.pronto = false; j.novo = true;
        Q.sfx('sfx_entrar');
        break;
      }
      case 'pronto':
        if (!j || !j.char || estado.fase !== 'sala') break;
        j.pronto = !!m.on;
        if (j.pronto) Q.sfx('sfx_pronto');
        verificarInicio();
        break;
      case 'sair':
        if (j && estado.fase === 'sala') { estado.jogadores = estado.jogadores.filter((x) => x !== j); Q.sfx('sfx_sair'); }
        break;
    }
    desenhar(); enviarEstado();
  }

  function verificarInicio() {
    const js = estado.jogadores;
    if (js.length >= 2 && js.every((x) => x.char && x.pronto)) {
      estado.fase = 'comecando';
      Q.sfx('sfx_comecar');
      mostrar('comecando');
      $('fila').innerHTML = js.map((x) => `<img src="${Q.img(x.char)}" alt="${Q.esc(x.nome)}">`).join('');
      Q.falar('Todo mundo pronto! Então vamos começar!');
    }
  }

  function desenhar() {
    const vagas = [];
    for (let i = 0; i < Q.MAX_JOGADORES; i++) {
      const j = estado.jogadores[i];
      if (!j) { vagas.push('<div class="vaga"><span class="vazio">?</span></div>'); continue; }
      const on = Date.now() - j.visto < 12000;
      const p = j.char ? Q.pers(j.char) : null;
      vagas.push(`<div class="vaga cheia${j.novo ? ' entrou' : ''}">
        ${j.pronto ? '<span class="selo">Pronto!</span>' : on ? '' : '<span class="selo off">Sem sinal</span>'}
        ${p ? `<img src="${Q.img(p.id)}" alt="">` : '<span class="escolhendo">escolhendo<br>personagem…</span>'}
        <span class="nome">${Q.esc(j.nome)}</span>
        <span class="pers">${p ? Q.esc(p.nome) : '&nbsp;'}</span></div>`);
      j.novo = false;
    }
    $('vagas').innerHTML = vagas.join('');
    const n = estado.jogadores.length, prontos = estado.jogadores.filter((x) => x.pronto).length;
    $('contagem').textContent = n < 2 ? `${n} na sala · mínimo 2` : `${prontos} de ${n} prontos`;
  }

  function criarSala() {
    if (!Q.configurado()) { aviso('Falta configurar o Supabase em js/config.js'); return; }
    codigo = Q.novoCodigo();
    $('senha').textContent = codigo;
    const urlCel = new URL('c/?sala=' + codigo, location.href).href;
    $('endereco').textContent = location.host + location.pathname.replace(/[^/]*$/, '') + 'c';
    const qr = window.qrcode(0, 'M'); qr.addData(urlCel); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    rede = Q.conectar(codigo, aoReceber, (st) => {
      if (st === 'SUBSCRIBED') { aviso(''); enviarEstado(); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') aviso('Reconectando à sala…');
    });
    mostrar('sala'); desenhar();
    Q.falar('Entrem na sala! Apontem a câmera do celular para o QR code, ou digitem a senha.');
    // Reenvia o estado e tira da sala quem sumiu há mais de 40 segundos
    setInterval(() => {
      if (estado.fase === 'sala') {
        const antes = estado.jogadores.length;
        estado.jogadores = estado.jogadores.filter((x) => Date.now() - x.visto < 40000);
        if (estado.jogadores.length !== antes) Q.sfx('sfx_sair');
      }
      desenhar(); enviarEstado();
    }, 3000);
  }

  $('criar').addEventListener('click', () => { Q.sfx('sfx_toque'); criarSala(); });
  if (!Q.configurado()) aviso('Falta configurar o Supabase em js/config.js');
})();
