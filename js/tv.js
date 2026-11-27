// TV: anfitriã da sala. Decide tudo e manda o estado completo para os celulares.
// As telas e as linhas do tempo seguem o quadro "Quem sabe sobe! · Telas do jogo" (telas 06 a 13).
(function () {
  const Q = window.QSS;
  const $ = (id) => document.getElementById(id);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const cl = (v) => Math.max(0, Math.min(1, v));
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const params = new URLSearchParams(location.search);
  // Para testar mais rápido: ?rodadas=2 joga só as duas primeiras rodadas
  const ULTIMA = Math.max(1, Math.min(Q.RODADAS, parseInt(params.get('rodadas'), 10) || Q.RODADAS));
  // Para testar uma rodada específica: ?inicio=6 começa direto na rodada 6
  const PRIMEIRA = Math.max(1, Math.min(Q.RODADAS, parseInt(params.get('inicio'), 10) || 1));
  const CHECK = '<svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="#1D2A4D" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Palco 1920×1080 ----------
  function escala() { return $('palco').getBoundingClientRect().width / 1920; }
  function ajustar() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    $('palco').style.transformOrigin = '50% 50%';
    $('palco').style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener('resize', ajustar); ajustar();

  // Varal de luzes em cada cena (e duas vezes no mundo que corre para o ranking)
  function luzes(dest, antes, dx) {
    const c = $('luzes').cloneNode(true); c.removeAttribute('id');
    if (dx) c.style.left = dx + 'px';
    dest.insertBefore(c, antes || dest.firstChild);
  }
  document.querySelectorAll('.cena').forEach((sec) => luzes(sec, sec.querySelector('.piso').nextSibling));
  luzes($('mundo'), $('mundo').querySelector('.piso')); luzes($('mundo'), $('mundo').querySelector('.piso'), 1920);

  function mostrar(id) { document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('oculto', t.id !== id)); }
  function aviso(txt) { const a = $('aviso'); a.textContent = txt || ''; a.classList.toggle('oculto', !txt); }

  // ---------- Estado ----------
  // jogadores: {pid, nome, char, pronto, visto, pontos}
  const estado = { fase: 'sala', jogadores: [], d: null };
  let rede = null, codigo = '', partida = 0, jaExplicou = false, avisouSala = false, explicouPoderes = false;
  const online = (j) => Date.now() - j.visto < 12000;
  const fala = (j) => (Q.pers(j.char) || {}).fala || j.nome;

  function enviarEstado() {
    if (!rede) return;
    let d = estado.d;
    if (d && d.prazo) d = Object.assign({}, d, { restante: Math.max(0, d.prazo - Date.now()), prazo: undefined });
    rede.enviar('estado', {
      fase: estado.fase, d,
      jogadores: estado.jogadores.map((j) => ({ pid: j.pid, nome: j.nome, char: j.char, pronto: j.pronto, online: online(j), pontos: j.pontos || 0, usos: j.usos || null }))
    });
  }
  function mudar(fase, d) { estado.fase = fase; estado.d = d || null; enviarEstado(); }

  // Voz da Coruja: espera a fala terminar, mas nunca menos que o tempo de leitura (navegador sem voz)
  function diz(texto) { return Promise.all([Q.falar(texto), espera(Math.min(6000, 700 + texto.length * 45))]); }
  // Reações curtas: sorteia uma das 3 variações sem repetir a anterior
  const REACOES = {
    ok: ['Isso aí!', 'Mandaram bem!', 'Acertaram em cheio!'],
    erro: ['Ih, essa foi difícil!', 'Quase!', 'Ninguém esperava essa!'],
    todos: ['Todo mundo acertou? Essa estava fácil!', 'Turma afiada!', 'Cem por cento de acerto!'],
    nenhum: ['Ninguém acertou! Era pegadinha.', 'Ixi, zero acertos!', 'Essa pegou todo mundo!'],
    tempo: ['Cinco segundos!', 'Corre, corre!', 'O tempo está acabando!'],
    virada: ['Temos um novo líder!', 'Virou o jogo!', 'Mudou tudo no ranking!']
  };
  const ultimaReacao = {};
  function reacao(tipo) {
    const op = REACOES[tipo].filter((x) => x !== ultimaReacao[tipo]);
    return (ultimaReacao[tipo] = sorteia(op));
  }

  // Espera até o tempo acabar ou a condição ficar verdadeira (checada a cada mensagem)
  let acordar = null;
  function aguardar(ms, pronto) {
    return new Promise((ok) => {
      const fim = () => { clearTimeout(t); acordar = null; ok(); };
      const t = setTimeout(fim, ms);
      acordar = () => { if (pronto()) fim(); };
      acordar();
    });
  }
  // Animação por quadros: chama fn(t em segundos) até durar `seg`
  function animar(seg, fn) {
    return new Promise((ok) => {
      const t0 = performance.now();
      const passo = (agora) => {
        const t = (agora - t0) / 1000;
        fn(Math.min(t, seg));
        if (t < seg) requestAnimationFrame(passo); else ok();
      };
      requestAnimationFrame(passo);
    });
  }

  // ---------- Mensagens dos celulares ----------
  function aoReceber(m) {
    const agora = Date.now();
    const j = estado.jogadores.find((x) => x.pid === m.pid);
    if (j) j.visto = agora;
    const d = estado.d;
    switch (m.t) {
      case 'ola': break;
      case 'entrar': {
        const nome = Q.limparNome(m.nome);
        if (!m.pid || !nome) break;
        if (j) { j.nome = nome; break; }
        if (estado.fase !== 'sala') { rede.enviar('recusado', { pid: m.pid, motivo: 'A partida já começou.' }); return; }
        if (estado.jogadores.length >= Q.MAX_JOGADORES) { rede.enviar('recusado', { pid: m.pid, motivo: 'A sala está cheia (8 jogadores).' }); return; }
        estado.jogadores.push({ pid: m.pid, nome, char: null, pronto: false, visto: agora, novo: true, pontos: 0 });
        Q.sfx('sfx_entrar');
        break;
      }
      case 'escolher': {
        if (!j || estado.fase !== 'sala') break;
        if (m.char === null) { j.char = null; j.pronto = false; break; }
        if (!Q.pers(m.char)) break;
        const dono = estado.jogadores.find((x) => x.char === m.char);
        if (dono && dono !== j) break;
        const trocou = j.char !== m.char;
        j.char = m.char; j.pronto = false; j.novo = true;
        Q.sfx('sfx_entrar');
        if (trocou) Q.falar('Chegou… ' + Q.pers(m.char).fala + '!'); // sala_02
        break;
      }
      case 'pronto':
        if (!j || !j.char || (estado.fase !== 'sala' && estado.fase !== 'fim')) break;
        j.pronto = !!m.on;
        if (j.pronto) Q.sfx('sfx_pronto');
        verificarInicio();
        break;
      case 'sair':
        if (j && estado.fase === 'sala') { estado.jogadores = estado.jogadores.filter((x) => x !== j); Q.sfx('sfx_sair'); }
        break;
      case 'votar':
        if (!j || estado.fase !== 'votacao' || !d || !d.aberta) break;
        if (!(m.i >= 0 && m.i < d.portas.length)) break;
        if (d.votos[j.pid] !== m.i) { d.votos[j.pid] = m.i; Q.sfx('sfx_toque'); desenharFila(); }
        break;
      case 'poder': {
        if (!j || estado.fase !== 'podEscolha' || !d || !d.aberta || d.escolhas[j.pid]) break;
        const pw = Q.poder(m.poder); if (!pw || !j.usos || !(j.usos[pw.id] > 0)) break;
        let alvo = null;
        if (pw.id !== 'espelho') {
          const a = estado.jogadores.find((x) => x.pid === m.alvo);
          if (!a || a === j) break;
          alvo = a.pid;
        }
        d.escolhas[j.pid] = { poder: pw.id, alvo, ordem: Object.keys(d.escolhas).length };
        Q.sfx('sfx_toque'); desenharFilaPoder();
        break;
      }
      case 'assoc': {
        if (!j || estado.fase !== 'assoc' || !d || !d.aberta || !Array.isArray(m.resp)) break;
        const atual = assocResp[j.pid] || [];
        if (m.resp.length <= atual.length) break;
        const novas = m.resp.slice(atual.length, 10).filter((x) => x === 'E' || x === 'D');
        assocResp[j.pid] = atual.concat(novas).slice(0, 10);
        d.prog[j.pid] = assocResp[j.pid].length;
        if (assocResp[j.pid].length === 10 && !d.terminou.includes(j.pid)) { d.terminou.push(j.pid); Q.sfx('sfx_pronto'); }
        else Q.sfx('sfx_toque');
        desenharColsAssoc();
        break;
      }
      case 'responder':
        if (!j || estado.fase !== 'pergunta' || !d || !d.aberta || m.qid !== d.q.id) break;
        if (respostas[j.pid] || !(m.op >= 0 && m.op <= 3)) break;
        respostas[j.pid] = { op: m.op, ms: agora - inicioPergunta };
        d.respondeu.push(j.pid); Q.sfx('sfx_toque');
        marcarRespondeu();
        break;
    }
    if (estado.fase === 'sala') { desenharSala(); avisoSala(); }
    enviarEstado();
    if (acordar) acordar();
  }

  function verificarInicio() {
    const js = estado.jogadores;
    if (js.length >= 2 && js.every((x) => x.char && x.pronto)) iniciarPartida();
  }
  // sala_03: quando todos já escolheram o personagem
  function avisoSala() {
    const js = estado.jogadores, todos = js.length >= 2 && js.every((x) => x.char);
    if (todos && !avisouSala && !js.some((x) => x.pronto)) { avisouSala = true; setTimeout(() => Q.falar('Todo mundo pronto? Segurem o botão Iniciar por três segundos.'), 1800); }
    if (!todos) avisouSala = false;
  }

  // ---------- Sala de espera ----------
  function desenharSala() {
    const vagas = [];
    for (let i = 0; i < Q.MAX_JOGADORES; i++) {
      const j = estado.jogadores[i];
      if (!j) { vagas.push('<div class="vaga"><span class="vazio">?</span></div>'); continue; }
      const p = j.char ? Q.pers(j.char) : null;
      vagas.push(`<div class="vaga cheia${j.novo ? ' entrou' : ''}">
        ${j.pronto ? '<span class="selo">Pronto!</span>' : online(j) ? '' : '<span class="selo off">Sem sinal</span>'}
        ${p ? `<img src="${Q.img(p.id)}" alt="">` : '<span class="escolhendo">escolhendo<br>personagem…</span>'}
        <span class="nome">${Q.esc(j.nome)}</span>
        <span class="pers">${p ? Q.esc(p.nome) : '&nbsp;'}</span></div>`);
      j.novo = false;
    }
    $('vagas').innerHTML = vagas.join('');
    const n = estado.jogadores.length, prontos = estado.jogadores.filter((x) => x.pronto).length;
    $('contagem').textContent = n < 2 ? `${n} na sala · mínimo 2` : `${prontos} de ${n} prontos`;
  }

  // ---------- Partida (Fase 1) ----------
  let respostas = {}, inicioPergunta = 0;

  async function iniciarPartida() {
    const id = ++partida, vivo = () => id === partida;
    estado.jogadores.forEach((j) => { j.pontos = 0; j.pronto = false; j.usos = {}; Q.PODERES.forEach((pw) => { j.usos[pw.id] = Q.USOS_PODER; }); });
    Q.sfx('sfx_comecar');

    // 06 · A Coruja explica (só na primeira partida da sala: "eu só explico uma vez")
    if (!jaExplicou) {
      mudar('explica'); mostrar('explica');
      for (const f of [
        'É assim que se joga! Prestem atenção, que eu só explico uma vez.',
        'Eu leio a pergunta, e vocês têm quinze segundos para responder no celular.',
        'Acertou, ganhou pontos. Quem acerta mais rápido leva um bônus.',
        'E dá para atrapalhar os outros com poderes.',
        'Na final, os pontos viram degraus. Quem chegar ao topo vence! Quem sabe… SOBE!'
      ]) { await diz(f); if (!vivo()) return; }
      jaExplicou = true;
    }

    const banco = window.QSS_PERGUNTAS.filter((p) => p.fase === 'fase1').slice();
    let lider = null;
    for (let r = PRIMEIRA; r <= ULTIMA && banco.length; r++) {
      if (r === Q.RODADA_ASSOCIACAO) { lider = await associacao(r, lider, vivo); if (!vivo()) return; continue; } // rodada 6
      const cat = await votacao(r, banco, vivo); if (!vivo()) return;
      const doCat = banco.filter((p) => p.cat === cat), q = sorteia(doCat);
      banco.splice(banco.indexOf(q), 1);
      let efeitos = {};
      if (!Q.RODADAS_SEM_PODER.includes(r)) {
        // Rodada 2 em diante: (só na primeira vez) a Coruja explica os poderes, escolha e lançamento
        if (!explicouPoderes) { await explicaPoderes(vivo); if (!vivo()) return; explicouPoderes = true; }
        const escolhas = await escolhaPoderes(r, cat, vivo); if (!vivo()) return;
        efeitos = await lancamento(escolhas, vivo); if (!vivo()) return;
      }
      await pergunta(r, q, vivo, efeitos); if (!vivo()) return;
      const res = await revelacao(q, vivo); if (!vivo()) return;
      lider = await pontuacao(r, q, res, lider, vivo); if (!vivo()) return;
    }
    // Fim da Fase 1: o ranking fica na tela. A pirâmide (telas 17 a 21) é a próxima etapa.
    $('rSub').textContent = 'final da primeira fase';
    await diz('A primeira fase acabou!'); if (!vivo()) return;
    estado.jogadores.forEach((j) => { j.pronto = false; });
    mudar('fim');
    await diz('Querem jogar de novo? Segurem o botão no celular.');
  }

  // ---------- 07 · Votação de categoria ----------
  function htmlPorta(cat, k) {
    const c = Q.categoria(cat);
    return `<div class="pw" data-k="${k}"><span class="tag"></span>
      <div class="porta"><div class="aro" style="background:${c.sombra}"></div>
        <div class="folha" style="background:${c.cor}"><div class="painel" style="top:201px"></div><div class="painel" style="top:326px"></div><div class="brilho"></div><div class="clarao"></div></div>
        <span class="macaneta"></span>
        <div class="placa" style="box-shadow:0 6px 0 ${c.sombra}">${Q.iconeCat(cat, 54)}<span class="${cat.length > 12 ? 'longo' : ''}">${Q.esc(cat)}</span></div>
      </div><div class="grupo"></div></div>`;
  }
  function desenharFila() {
    const d = estado.d || {};
    $('vFila').innerHTML = estado.jogadores.map((j) => {
      const votou = d.votos && d.votos[j.pid] !== undefined;
      return `<div class="fj" data-pid="${j.pid}"><img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}">
        ${votou ? `<span class="ok-bolha">${CHECK}</span>` : '<span class="esp-bolha">...</span>'}
        <span class="nometag">${Q.esc(j.nome)}</span></div>`;
    }).join('');
  }
  function relogioVoto(restante) {
    $('vRelogio').innerHTML = Q.relogio(100, Math.ceil(restante / 1000), restante / Q.TEMPO_VOTO, '#6CC24A');
  }

  async function votacao(r, banco, vivo) {
    const cats = [...new Set(banco.map((p) => p.cat))].sort(() => Math.random() - 0.5).slice(0, 4);
    const d = { rodada: r, portas: cats, votos: {}, aberta: true, prazo: 0 };
    mudar('votacao', d); mostrar('votacao');
    $('vTit').textContent = 'Qual vai ser a categoria?';
    $('vSub').textContent = 'Votem no celular. A porta mais votada abre.';
    $('vPortas').innerHTML = cats.map(htmlPorta).join('');
    desenharFila(); $('vFila').style.opacity = 1;
    relogioVoto(Q.TEMPO_VOTO);
    await diz(`Rodada ${Q.NUMEROS[r]}! Qual vai ser a categoria? Votem no celular!`); if (!vivo()) return cats[0];

    d.prazo = Date.now() + Q.TEMPO_VOTO; enviarEstado();
    let seg = 99;
    const relo = setInterval(() => {
      const rest = Math.max(0, d.prazo - Date.now()); relogioVoto(rest);
      const s = Math.ceil(rest / 1000); if (s !== seg && s > 0) { seg = s; Q.sfx('sfx_tictac'); }
    }, 100);
    await aguardar(Q.TEMPO_VOTO, () => { const on = estado.jogadores.filter(online); return on.length > 0 && on.every((j) => d.votos[j.pid] !== undefined); });
    clearInterval(relo);
    d.aberta = false; d.prazo = 0; enviarEstado();
    if (!vivo()) return cats[0];

    // Contagem
    const cont = cats.map((_, k) => Object.values(d.votos).filter((v) => v === k).length);
    const max = Math.max(...cont), empatadas = cont.map((c, k) => (c === max ? k : -1)).filter((k) => k >= 0);
    // 07b · Cada um corre para a porta que escolheu
    $('vRelogio').innerHTML = '';
    document.querySelectorAll('#vPortas .pw').forEach((pw, k) => {
      pw.classList.add('contado');
      pw.querySelector('.tag').textContent = cont[k] + (cont[k] === 1 ? ' voto' : ' votos');
    });
    await correrParaPortas(d);
    if (!vivo()) return cats[0];

    let venc = empatadas[0];
    const portas = [...document.querySelectorAll('#vPortas .pw')];
    if (empatadas.length > 1) {
      // 07c · Empate: sorteio piscando entre as portas empatadas, cada vez mais devagar
      portas.forEach((pw, k) => pw.classList.toggle('apagada', !empatadas.includes(k)));
      $('vTit').textContent = 'Empate! Sorteando...';
      const nomes = empatadas.map((k) => cats[k]);
      $('vSub').textContent = max === 0 ? 'Ninguém votou. Vou sortear entre as portas.' : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} tiveram ${max} ${max === 1 ? 'voto' : 'votos'} cada.`;
      const fala = diz('Deu empate! Vou sortear entre as portas.');
      venc = sorteia(empatadas);
      const passos = []; let ms = 70; while (ms < 620) { passos.push(ms); ms *= 1.16; }
      // termina exatamente na vencedora
      const ordem = []; for (let n = passos.length; n >= 0; n--) ordem.unshift(empatadas[((empatadas.indexOf(venc) - n) % empatadas.length + empatadas.length) % empatadas.length]);
      for (let n = 0; n < ordem.length; n++) {
        portas.forEach((pw, k) => pw.classList.toggle('acesa', k === ordem[n]));
        Q.sfx('sfx_sorteio');
        if (n < passos.length) await espera(passos[n]);
      }
      portas.forEach((pw) => pw.classList.remove('acesa'));
      await fala; if (!vivo()) return cats[0];
      $('vSub').textContent = 'O sorteio escolheu entre as portas empatadas.';
    } else {
      $('vSub').textContent = 'Cada um correu para a porta que escolheu.';
    }
    portas.forEach((pw, k) => { pw.classList.toggle('venceu', k === venc); pw.classList.toggle('apagada', k !== venc); });
    const c = Q.categoria(cats[venc]);
    $('vTit').innerHTML = `Deu <span style="color:${c.sombra}">${Q.esc(cats[venc])}</span>!`;
    Q.sfx('sfx_porta');
    await diz(`A porta escolhida foi… ${cats[venc]}!`);
    await espera(500);
    return cats[venc];
  }

  // Cada personagem que votou sai da fileira e corre até a sua porta
  async function correrParaPortas(d) {
    const s = escala(), base = $('palco').getBoundingClientRect();
    const voos = [];
    const grupos = [...document.querySelectorAll('#vPortas .pw .grupo')];
    estado.jogadores.forEach((j) => {
      const k = d.votos[j.pid]; if (k === undefined) return;
      const alvo = document.createElement('img'); alvo.src = Q.img(j.char); alvo.alt = j.nome; alvo.style.opacity = 0;
      grupos[k].appendChild(alvo);
      voos.push({ j, alvo });
    });
    if (!voos.length) return;
    Q.sfx('sfx_correr');
    const camada = $('votacao');
    voos.forEach((v) => {
      const orig = camada.querySelector(`.fj[data-pid="${v.j.pid}"] img`);
      const a = orig.getBoundingClientRect(), b = v.alvo.getBoundingClientRect();
      v.de = { x: (a.left - base.left) / s, y: (a.top - base.top) / s, h: a.height / s };
      v.para = { x: (b.left - base.left) / s, y: (b.top - base.top) / s, h: b.height / s };
      v.dir = v.para.x > v.de.x ? 1 : -1;
      v.voa = document.createElement('img'); v.voa.src = orig.src;
      v.voa.style.cssText = `position:absolute;left:0;top:0;height:${v.de.h}px;z-index:5;transform-origin:50% 100%`;
      camada.appendChild(v.voa);
      orig.parentElement.style.visibility = 'hidden';
    });
    await animar(1.1, (t) => {
      const u = ease(cl(t / 1.1));
      voos.forEach((v, i) => {
        const x = lerp(v.de.x, v.para.x, u), y = lerp(v.de.y + v.de.h, v.para.y + v.para.h, u), h = lerp(v.de.h, v.para.h, u);
        const pulo = u < 1 ? Math.abs(Math.sin(t * 16 + i)) * 16 : 0;
        v.voa.style.height = h + 'px';
        v.voa.style.transform = `translate(${x}px,${y - h - pulo}px) rotate(${u < 1 ? v.dir * 6 : 0}deg) scaleX(${u < 1 && v.dir < 0 ? -1 : 1})`;
      });
    });
    voos.forEach((v) => { v.alvo.style.opacity = 1; v.voa.remove(); });
  }


  // ---------- 08 · A Coruja explica os poderes (só na rodada 2) ----------
  async function explicaPoderes(vivo) {
    mudar('podExplica'); mostrar('podExplica');
    for (const f of [
      'Agora vale atrapalhar! A cada rodada, escolham um poder e um alvo. Cada poder pode ser usado duas vezes.',
      'Poderes diferentes no mesmo alvo se somam. E o mesmo poder, vindo de vários jogadores, fica mais forte.'
    ]) { await diz(f); if (!vivo()) return; }
  }

  // ---------- 09 · Escolha dos poderes (15 s) ----------
  function desenharFilaPoder() {
    const d = estado.d || {};
    $('ppFila').innerHTML = estado.jogadores.map((j) => {
      const ok = d.escolhas && d.escolhas[j.pid];
      return `<div class="fj"><img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}">
        ${ok ? `<span class="ok-bolha">${CHECK}</span>` : '<span class="esp-bolha">...</span>'}
        <span class="nometag">${Q.esc(j.nome)}</span></div>`;
    }).join('');
  }
  async function escolhaPoderes(r, cat, vivo) {
    const d = { rodada: r, cat, escolhas: {}, aberta: false, prazo: 0 };
    mudar('podEscolha', d); mostrar('podEscolha');
    const c = Q.categoria(cat);
    $('ppChip').textContent = `Rodada ${r} · ${cat}`; $('ppChip').style.background = c.cor;
    $('ppIcones').innerHTML = Q.PODERES.map((pw) => `<div class="pico" style="background:${pw.cor};box-shadow:0 6px 0 ${pw.sombra}"><img src="${Q.imgPoder(pw.id)}" alt="${pw.nome}"></div>`).join('');
    desenharFilaPoder();
    const relogio = (rest) => { $('ppRelogio').innerHTML = Q.relogio(100, Math.ceil(rest / 1000), rest / Q.TEMPO_VOTO, '#6CC24A'); };
    relogio(Q.TEMPO_VOTO);
    await diz('Hora de atrapalhar! Escolham um poder e um alvo.'); if (!vivo()) return {};
    d.aberta = true; d.prazo = Date.now() + Q.TEMPO_VOTO; enviarEstado();
    let seg = 99;
    const relo = setInterval(() => {
      const rest = Math.max(0, d.prazo - Date.now()); relogio(rest);
      const sg = Math.ceil(rest / 1000); if (sg !== seg && sg > 0) { seg = sg; Q.sfx('sfx_tictac'); }
    }, 100);
    const semUso = (j) => !j.usos || Object.values(j.usos).every((n) => n <= 0);
    await aguardar(Q.TEMPO_VOTO, () => { const on = estado.jogadores.filter(online); return on.length > 0 && on.every((j) => d.escolhas[j.pid] || semUso(j)); });
    clearInterval(relo);
    d.aberta = false; d.prazo = 0;
    // gasta um uso de cada poder escolhido
    Object.entries(d.escolhas).forEach(([pid, e]) => { const j = estado.jogadores.find((x) => x.pid === pid); if (j && j.usos) j.usos[e.poder] = Math.max(0, j.usos[e.poder] - 1); });
    enviarEstado();
    await espera(400);
    return d.escolhas;
  }

  // ---------- 10 · Lançamento, um de cada vez ----------
  async function lancamento(escolhas, vivo) {
    const js = estado.jogadores, porPid = (pid) => js.find((x) => x.pid === pid);
    const espelhos = new Set(Object.keys(escolhas).filter((pid) => escolhas[pid].poder === 'espelho'));
    const lances = Object.entries(escolhas).filter(([, e]) => e.poder !== 'espelho' && e.alvo)
      .sort((a, b) => a[1].ordem - b[1].ordem)
      .map(([pid, e]) => ({ de: pid, para: e.alvo, poder: e.poder, volta: espelhos.has(e.alvo) }));
    const efeitos = {};
    const acerta = (pid, l) => { (efeitos[pid] = efeitos[pid] || []).push({ poder: l.poder, de: porPid(l.de).nome }); };
    if (!lances.length) return {};

    mudar('podLanca'); mostrar('podLanca');
    $('plSub').textContent = 'Um lançamento de cada vez, para todo mundo ver.';
    const hits = {}; js.forEach((j) => { hits[j.pid] = espelhos.has(j.pid) ? ['espelho'] : []; });
    const desenhar = (de, para) => {
      $('plFila').innerHTML = js.map((j) => {
        const op = !de || j.pid === de || j.pid === para ? 1 : 0.35;
        const bg = j.pid === de ? '#2F5FB8' : j.pid === para ? '#F2545B' : '#FFFFFF', tx = j.pid === de || j.pid === para ? '#FFFFFF' : '#1D2A4D';
        return `<div class="fj" data-pid="${j.pid}" style="opacity:${op}"><div class="hits">${hits[j.pid].map((h) => { const pw = Q.poder(h); return `<span style="background:${pw.cor}"><img src="${Q.imgPoder(h)}" alt="${pw.nome}"></span>`; }).join('')}</div>
          <img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}"><span class="nometag" style="background:${bg};color:${tx}">${Q.esc(j.nome)}</span></div>`;
      }).join('');
    };
    const centroX = (pid) => { const el = $('plFila').querySelector(`[data-pid="${pid}"]`), r = el.getBoundingClientRect(), b = $('palco').getBoundingClientRect(), s = escala(); return (r.left + r.width / 2 - b.left) / s; };
    const pula = (pid, dy) => { const el = $('plFila').querySelector(`[data-pid="${pid}"]`); if (el) el.style.transform = `translateY(${dy}px)`; };
    const voo = async (x1, x2, pw, esc) => {
      const y0 = 700, mx = (x1 + x2) / 2, h = 300 + Math.abs(x2 - x1) * 0.15, bola = $('plBola'), arco = $('plArco').querySelector('path');
      arco.setAttribute('d', `M${x1} ${y0} Q${mx} ${y0 - h * 2} ${x2} ${y0}`); arco.setAttribute('stroke', pw.sombra);
      bola.querySelector('img').src = Q.imgPoder(pw.id); bola.style.borderColor = pw.sombra; bola.style.display = 'flex';
      Q.sfx('sfx_lancar');
      await animar(1.1 * esc, (t) => {
        const f = cl(t / (1.1 * esc));
        const qx = (1 - f) * (1 - f) * x1 + 2 * (1 - f) * f * mx + f * f * x2, qy = (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * (y0 - h * 2) + f * f * y0;
        bola.style.left = (qx - 65) + 'px'; bola.style.top = (qy - 65) + 'px'; bola.style.transform = `rotate(${f * 360}deg)`;
      });
      bola.style.display = 'none'; arco.setAttribute('d', '');
    };

    for (let k = 0; k < lances.length; k++) {
      const l = lances[k], pw = Q.poder(l.poder), de = porPid(l.de), para = porPid(l.para);
      const esc = Math.abs(js.indexOf(de) - js.indexOf(para)) > 4 ? 1.5 : 1;
      $('plCont').textContent = `Lançamento ${k + 1} de ${lances.length}`;
      $('plTit').textContent = `${de.nome} jogou ${pw.nome} em ${para.nome}!`;
      desenhar(l.de, l.para);
      const falaLance = diz(`${fala(de)} manda ${pw.fala} para ${fala(para)}!`);
      pula(l.de, -24); await espera(400 * esc); pula(l.de, 0);
      await voo(centroX(l.de), centroX(l.para), pw, esc);
      if (!vivo()) return {};
      if (l.volta) {
        // Espelho: o poder volta para quem jogou
        Q.sfx('sfx_espelho'); pula(l.para, -16);
        $('plTit').textContent = `Espelho! Voltou para ${de.nome}!`;
        await falaLance; await espera(200);
        const falaVolta = diz(`Espelho! Voltou tudo para ${fala(de)}!`);
        pula(l.para, 0);
        await voo(centroX(l.para), centroX(l.de), pw, esc);
        hits[l.de].push(l.poder); acerta(l.de, l); desenhar(l.para, l.de); pula(l.de, 10);
        Q.sfx('sfx_acerta_poder');
        await Promise.all([falaVolta, espera(1100 * esc)]);
      } else {
        hits[l.para].push(l.poder); acerta(l.para, l); desenhar(l.de, l.para); pula(l.para, 10);
        Q.sfx('sfx_acerta_poder');
        await Promise.all([falaLance, espera(1100 * esc)]);
      }
      if (!vivo()) return {};
    }
    desenhar(null, null);
    $('plCont').textContent = 'Fim';
    $('plTit').textContent = 'Todos os poderes lançados!';
    $('plSub').textContent = 'Os efeitos aparecem no celular de quem foi atingido.';
    await espera(1800);
    // Junta por alvo: o mesmo poder vindo de 2 ou mais jogadores fica forte
    const final = {};
    Object.entries(efeitos).forEach(([pid, lista]) => {
      const por = {};
      lista.forEach((e) => { (por[e.poder] = por[e.poder] || []).push(e.de); });
      final[pid] = Object.entries(por).map(([poder, de]) => ({ poder, de, forte: de.length >= 2 }));
    });
    return final;
  }


  // ---------- Rodada 6 · Associação (telas 14, 15 e 16) ----------
  const TEMPO_ASSOC = 20000;
  const COR_BLOCO = ['#F2545B', '#F2A33A', '#FFD23F', '#6CC24A', '#2EC4B6', '#4F8DF7', '#A77BF3', '#F6B6B8', '#F2545B', '#F2A33A'];
  let assocResp = {};
  function desenharColsAssoc() {
    const d = estado.d || {};
    $('asCols').innerHTML = estado.jogadores.map((j) => {
      const n = (d.prog || {})[j.pid] || 0, o = (d.terminou || []).indexOf(j.pid);
      let bl = '';
      for (let k = 9; k >= 0; k--) bl += k < n ? `<span class="bl" style="background:${COR_BLOCO[k]};box-shadow:0 4px 0 rgba(29,42,77,.25)"></span>` : '<span class="bl vazio"></span>';
      return `<div class="cj"><div class="pilha">${o >= 0 ? `<span class="medalha">${o + 1}º</span>` : `<span class="cont">${n}/10</span>`}<div class="blocos">${bl}</div></div>
        <img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}"><span class="nometag">${Q.esc(j.nome)}</span></div>`;
    }).join('');
  }

  async function associacao(r, liderAntes, vivo) {
    const js = estado.jogadores, n = js.length;
    const set = sorteia(window.QSS_ASSOC), itens = set.itens.slice().sort(() => Math.random() - 0.5);
    // 14 · Explicação
    mudar('asExplica'); mostrar('asExplica');
    $('aeBonus').textContent = '+' + n;
    $('aeBonusTx').textContent = `para quem terminar primeiro (o 2º leva ${n - 1}, e assim por diante)`;
    for (const f of ['Rodada especial! Sem categoria e sem poderes.', 'Vocês têm vinte segundos para ligar dez itens. Certo vale dois pontos, errado tira um.', 'E quem terminar primeiro ganha bônus!']) {
      await diz(f); if (!vivo()) return liderAntes;
    }
    // 15 · Em andamento
    assocResp = {};
    const lado = (x) => ({ nome: x.nome, cor: x.cor, sombra: x.sombra, tx: x.tx, icone: x.icone });
    const d = { rodada: r, titulo: set.titulo, esq: lado(set.esq), dir: lado(set.dir), itens: itens.map((x) => x.t), aberta: false, prazo: 0, prog: {}, terminou: [] };
    mudar('assoc', d); mostrar('assoc');
    $('asTit').textContent = set.titulo;
    desenharColsAssoc();
    const relogio = (rest) => { $('asRelogio').innerHTML = Q.relogio(100, Math.ceil(rest / 1000), rest / TEMPO_ASSOC, '#2EC4B6'); };
    relogio(TEMPO_ASSOC);
    await diz('Valendo!'); if (!vivo()) return liderAntes;
    d.aberta = true; d.prazo = Date.now() + TEMPO_ASSOC; enviarEstado();
    let seg = 99;
    const relo = setInterval(() => {
      const rest = Math.max(0, d.prazo - Date.now()); relogio(rest);
      const sg = Math.ceil(rest / 1000); if (sg !== seg && sg > 0) { seg = sg; Q.sfx('sfx_tictac'); }
    }, 100);
    await aguardar(TEMPO_ASSOC, () => { const on = js.filter(online); return on.length > 0 && on.every((j) => d.terminou.includes(j.pid)); });
    clearInterval(relo);
    d.aberta = false; d.prazo = 0; enviarEstado();
    if (!vivo()) return liderAntes;
    const todos = js.every((j) => d.terminou.includes(j.pid));
    await diz(todos ? 'Todo mundo respondeu! Vamos contar os pontos.' : 'Tempo esgotado! Vamos contar os pontos.');

    // 16 · Conferindo item por item, de baixo para cima, e depois o bônus de quem terminou
    const dados = js.map((j) => {
      const rs = assocResp[j.pid] || [], ordem = d.terminou.indexOf(j.pid) + 1;
      return { j, rs, ordem, certo: (k) => rs[k] === itens[k].lado, bonus: ordem ? n - (ordem - 1) : 0 };
    });
    const NT = d.terminou.length, tB = (k) => 0.8 + k * 0.55, tBonus = (o) => 6.8 + (o - 1) * 0.5, fimT = 6.8 + NT * 0.5 + 0.6;
    mudar('asPontos'); mostrar('asPontos');
    $('apTit').textContent = 'Hora de conferir!';
    let somK = -1;
    await animar(fimT + 1.6, (t) => {
      const k0 = Math.floor((t - 0.8) / 0.55); if (k0 !== somK && k0 >= 0 && k0 < 10) { somK = k0; Q.sfx('sfx_toque'); }
      const fim = t >= fimT;
      if (fim) $('apTit').textContent = 'Pontos da associação';
      $('apCols').innerHTML = dados.map((x, i) => {
        let soma = 0, bl = '';
        for (let k = 9; k >= 0; k--) {
          const resp = k < x.rs.length, ok = resp && x.certo(k), e = t - tB(k), visto = resp && e >= 0;
          if (visto) soma += ok ? 2 : -1;
          const cai = visto && !ok ? cl(e / 0.4) : 0;
          const bg = !resp ? '' : !visto ? COR_BLOCO[k] : ok ? '#6CC24A' : '#F2545B';
          const sh = !visto ? 'rgba(29,42,77,.25)' : ok ? '#43892A' : '#B83239';
          const pop = visto && e < 0.9 ? `<span class="pop" style="top:${(-e * 30).toFixed(0)}px;color:${ok ? '#43892A' : '#B83239'};opacity:${cl(1 - e / 0.9).toFixed(2)}">${ok ? '+2' : '−1'}</span>` : '';
          bl += resp ? `<span class="bl" style="background:${bg};box-shadow:0 4px 0 ${sh};transform:translate(${(cai * 10).toFixed(1)}px,0) rotate(${(cai * 8).toFixed(1)}deg);opacity:${!visto || ok ? 1 : (1 - 0.45 * cai).toFixed(2)}">${visto ? (ok ? '✓' : '✕') : ''}${pop}</span>` : '<span class="bl vazio"></span>';
        }
        const eb = x.ordem ? t - tBonus(x.ordem) : -1;
        if (x.ordem && eb > 0.6) soma += x.bonus;
        const bonus = x.ordem && eb < 0.9 ? `<span class="bonus" style="top:${eb > 0.3 ? (40 - cl((eb - 0.3) / 0.3) * 60).toFixed(0) : 40}px;transform:rotate(-8deg) scale(${eb > 0 && eb < 0.25 ? 1.25 : 1});opacity:${eb > 0.3 ? cl(1 - (eb - 0.3) / 0.6).toFixed(2) : 1}"><b>${eb > 0 ? '+' + x.bonus : x.ordem + 'º'}</b><small>${eb > 0 ? x.ordem + 'º a terminar' : 'lugar'}</small></span>` : '';
        x.total = soma;
        const pulo = fim ? (-Math.abs(Math.sin(t * 5 + i)) * 14).toFixed(0) : 0;
        return `<div class="cj"><div class="pilha"><span class="total${fim ? ' final' : ''}" style="transform:scale(${fim ? (1 + 0.04 * Math.sin(t * 6)).toFixed(3) : 1})">${soma}</span>${bonus}<div class="blocos">${bl}</div></div>
          <img src="${Q.img(x.j.char)}" alt="${Q.esc(x.j.nome)}" style="transform:translateY(${pulo}px)"><span class="nometag">${Q.esc(x.j.nome)}</span></div>`;
      }).join('');
    });
    if (!vivo()) return liderAntes;

    // Ranking, como nas outras rodadas
    const antes = {}, ganho = {}; dados.forEach((x) => { antes[x.j.pid] = x.j.pontos || 0; ganho[x.j.pid] = x.total; });
    $('pCard').style.opacity = 0; $('pRelogio').style.opacity = 0; $('blocos').innerHTML = ''; $('jogLayer').innerHTML = '';
    $('camera').style.transform = ''; $('mundo').style.transform = 'translateX(-1920px)';
    mudar('pontos'); mostrar('pergunta');
    const ordemTermino = (j) => { const o = d.terminou.indexOf(j.pid); return o < 0 ? 99 : o; };
    return ranking(`depois da rodada ${r} de ${Q.RODADAS}`, antes, ganho, ordemTermino, liderAntes, vivo);
  }

  // ---------- 11 · Pergunta ----------
  const N = () => estado.jogadores.length;
  const ESPACO = (1700 - 170) / 7; // distância entre personagens com a sala cheia (8)
  const cx0 = (i) => 960 + (i - (N() - 1) / 2) * ESPACO; // com menos jogadores, ficam centralizados
  const bc = (k) => 960 + (k - 1.5) * 420;
  let figs = []; // elementos .jc na mesma ordem de estado.jogadores

  function desenharBlocos() {
    $('blocos').innerHTML = Q.ALTS.map((a, k) => `<div class="bloco" data-k="${k}" style="background:${a.cor};box-shadow:0 10px 0 ${a.sh}">
      <div class="ameias" aria-hidden="true"><span style="background:${a.cor}"></span><span style="background:${a.cor}"></span><span style="background:${a.cor}"></span></div>
      <span class="forma">${Q.forma(k, 44)}</span><span class="txt oculta">?</span></div>`).join('');
  }
  function desenharFigs() {
    $('jogLayer').innerHTML = estado.jogadores.map((j) => `<div class="jc"><img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}"><span class="bolha"></span><span class="nometag">${Q.esc(j.nome)}</span></div>`).join('');
    figs = [...$('jogLayer').children];
    figs.forEach((f, i) => { f.style.left = cx0(i) + 'px'; f.style.bottom = '20px'; f.style.transform = ''; f.style.opacity = 1; });
  }
  function marcarRespondeu() {
    estado.jogadores.forEach((j, i) => {
      const b = figs[i] && figs[i].querySelector('.bolha'); if (!b) return;
      b.outerHTML = respostas[j.pid] ? `<span class="bolha ok-bolha">${CHECK}</span>` : '<span class="bolha esp-bolha">?</span>';
    });
  }
  function relogioPergunta(restante) {
    $('pRelogio').innerHTML = Q.relogio(110, Math.ceil(restante / 1000), restante / Q.TEMPO_RESPOSTA, '#FFD23F');
  }

  async function pergunta(r, q, vivo, efeitos) {
    respostas = {};
    const d = { rodada: r, q: { id: q.id, cat: q.cat, texto: q.texto }, aberta: false, respondeu: [], prazo: 0, efeitos: efeitos || {} };
    mudar('pergunta', d);
    // Cena limpa
    $('camera').style.transform = ''; $('mundo').style.transform = '';
    $('ranking').style.visibility = 'hidden';
    $('pCard').style.opacity = 1; $('pRelogio').style.opacity = 1;
    $('blocos').style.opacity = 1;
    const c = Q.categoria(q.cat);
    $('pCat').textContent = q.cat; $('pCat').style.background = c.sombra;
    $('pNum').textContent = `Pergunta ${r} de ${Q.RODADAS}`;
    $('pTexto').textContent = q.texto;
    desenharBlocos(); relogioPergunta(Q.TEMPO_RESPOSTA);
    mostrar('pergunta');
    desenharFigs(); marcarRespondeu();
    Q.sfx('sfx_pergunta');
    await diz(`Pergunta ${Q.NUMEROS[r]} de dez!`); if (!vivo()) return;
    await diz(q.texto); if (!vivo()) return;

    inicioPergunta = Date.now(); d.aberta = true; d.prazo = inicioPergunta + Q.TEMPO_RESPOSTA;
    d.q.ops = q.ops; // as opções só chegam ao celular quando o relógio começa
    enviarEstado();
    let seg = 99, avisou = false;
    const relo = setInterval(() => {
      const rest = Math.max(0, d.prazo - Date.now()); relogioPergunta(rest);
      const s = Math.ceil(rest / 1000);
      if (s !== seg && s > 0) { seg = s; Q.sfx('sfx_tictac'); }
      if (!avisou && rest <= 5000 && rest > 0) { avisou = true; Q.falar(reacao('tempo')); }
    }, 100);
    await aguardar(Q.TEMPO_RESPOSTA, () => { const on = estado.jogadores.filter(online); return on.length > 0 && on.every((j) => respostas[j.pid]); });
    clearInterval(relo);
    d.aberta = false; d.prazo = 0; enviarEstado();
    if (!vivo()) return;
    const todos = estado.jogadores.every((j) => respostas[j.pid]);
    Q.sfx(todos ? 'sfx_pronto' : 'sfx_tempo');
    await diz(todos ? 'Todo mundo respondeu!' : 'Tempo esgotado!');
  }

  // ---------- 12 · Revelação: respostas aparecem, corrida, a certa acende ----------
  async function revelacao(q, vivo) {
    mudar('revela');
    $('pRelogio').style.opacity = 0;
    const blocos = [...$('blocos').children];
    blocos.forEach((b, k) => {
      const t = b.querySelector('.txt'); t.classList.remove('oculta'); t.textContent = q.ops[k]; t.style.opacity = 0;
      Q.caber(t, 96, 34);
    });
    const js = estado.jogadores;
    const grupos = {}; js.forEach((j) => { const r = respostas[j.pid]; if (r) (grupos[r.op] = grupos[r.op] || []).push(j.pid); });
    const alvoX = (j, i) => { const r = respostas[j.pid]; if (!r) return cx0(i); const g = grupos[r.op], k = g.indexOf(j.pid); return bc(r.op) + (k - (g.length - 1) / 2) * 92; };
    figs.forEach((f) => { const b = f.querySelector('.bolha'); if (b) b.style.display = 'none'; });

    // 0–0,8 s respostas aparecem · 1–2,8 s corrida · espera · a certa acende
    setTimeout(() => { if (vivo()) Q.sfx('sfx_correr'); }, 1000);
    const vamos = espera(1000).then(() => vivo() && diz('Vamos ver quem acertou…'));
    await animar(2.9, (t) => {
      const tx = cl(t / 0.8), run = cl((t - 1) / 1.8), e = ease(run), correndo = run > 0 && run < 1;
      blocos.forEach((b) => { b.querySelector('.txt').style.opacity = tx; });
      js.forEach((j, i) => {
        const f = figs[i], de = cx0(i), para = alvoX(j, i), x = de + (para - de) * e;
        const y = 20 + (correndo && respostas[j.pid] ? Math.abs(Math.sin(t * 16)) * 16 : 0);
        const rot = correndo && respostas[j.pid] ? (para > de ? 1 : -1) * 6 : 0;
        f.style.left = x + 'px'; f.style.bottom = y + 'px';
        f.style.transform = `rotate(${rot}deg)`;
        f.querySelector('img').style.transform = correndo && para < de ? 'scaleX(-1)' : '';
      });
    });
    await vamos; if (!vivo()) return {};
    await espera(800);

    // A resposta certa acende; quem acertou pula, quem errou fica apagado
    const certa = q.certa;
    blocos.forEach((b, k) => {
      const a = Q.ALTS[k];
      b.style.boxShadow = k === certa ? `0 10px 0 ${a.sh},0 0 0 12px #FFFFFF,0 0 0 20px #FFD23F,0 0 80px 24px rgba(255,210,63,.8)` : `0 10px 0 ${a.sh}`;
      b.style.opacity = k === certa ? 1 : 0.45;
    });
    const acertou = (j) => respostas[j.pid] && respostas[j.pid].op === certa;
    js.forEach((j, i) => { figs[i].querySelector('.nometag').style.background = acertou(j) ? '#6CC24A' : '#FFFFFF'; });
    Q.sfx(js.some(acertou) ? 'sfx_certo' : 'sfx_errado');
    let parar = false;
    const t0 = performance.now();
    (function festa() {
      const t = (performance.now() - t0) / 1000;
      blocos[certa].style.transform = `scale(${(1.04 + 0.02 * Math.sin(t * 8)).toFixed(3)})`;
      js.forEach((j, i) => {
        const f = figs[i]; let y = 20, sx = 1, sy = 1, rot = 0, op = 1;
        if (acertou(j)) { const p = Math.abs(Math.sin(t * 5 + i)); y += p * 70; if (p < 0.15) { sy = 0.92; sx = 1.06; } }
        else { op = 0.6; sy = 0.96; rot = Math.sin(t * 6) * 2; }
        f.style.bottom = y + 'px'; f.style.opacity = op; f.style.transform = `scale(${sx},${sy}) rotate(${rot}deg)`;
      });
      if (!parar) requestAnimationFrame(festa);
    })();
    await diz('A resposta certa é… ' + q.falada + '!');
    const n = js.filter(acertou).length;
    await diz(reacao(n === js.length ? 'todos' : n === 0 ? 'nenhum' : n >= js.length / 2 ? 'ok' : 'erro'));
    parar = true;
    blocos[certa].style.transform = '';
    js.forEach((j, i) => { figs[i].style.bottom = '20px'; figs[i].style.transform = ''; });
    // ordem de rapidez entre quem acertou
    const certos = js.filter(acertou).sort((a, b) => respostas[a.pid].ms - respostas[b.pid].ms);
    const ganho = {}; certos.forEach((j, k) => { ganho[j.pid] = Q.pontos(k, js.length); });
    return { certa, certos, ganho, grupos };
  }

  // ---------- 13 · Pontuação, corrida e ranking ----------
  async function pontuacao(r, q, res, liderAntes, vivo) {
    mudar('pontos');
    const js = estado.jogadores, n = js.length, certa = res.certa;
    const certos = res.certos || [], nC = certos.length;
    const antes = {}; js.forEach((j) => { antes[j.pid] = j.pontos || 0; });
    $('pCard').style.opacity = 0;
    if (nC) Q.falar('Quem acertou ganha pontos, e quem respondeu mais rápido ganha bônus!');

    // Posições de partida: cada um embaixo do bloco que escolheu
    const x0 = (j, i) => { const rr = respostas[j.pid]; if (!rr) return cx0(i); const g = res.grupos[rr.op], k = g.indexOf(j.pid); return bc(rr.op) + (k - (g.length - 1) / 2) * 92; };
    // Selos de pontos
    figs.forEach((f, i) => {
      const j = js[i], g = res.ganho[j.pid];
      f.querySelectorAll('.selo-pts').forEach((e) => e.remove());
      if (g) f.insertAdjacentHTML('afterbegin', `<div class="selo-pts" style="transform:scale(0)"><b>+${g}</b><small>10 + ${g - 10} de rapidez</small></div>`);
    });
    const tPonto = (k) => 2.2 + k * 0.9;
    const tOut = nC ? tPonto(nC - 1) + 1.1 : 0.6;     // câmera volta
    const tRun = tOut + 0.6, tFim = tRun + 2.2;       // todos correm e o cenário anda
    let somou = false;
    Q.sfx('sfx_certo');
    await animar(tFim, (t) => {
      const zIn = nC ? ease(cl((t - 0.6) / 1.4)) : 0, zOut = ease(cl((t - tOut) / 0.6)), zz = zIn * (1 - zOut);
      const z = 1 + 0.45 * zz, ccx = lerp(960, bc(certa), zz), ccy = lerp(540, 800, zz);
      $('camera').style.transform = `translate(960px,540px) scale(${z.toFixed(4)}) translate(${(-ccx).toFixed(1)}px,${(-ccy).toFixed(1)}px)`;
      const run = cl((t - tRun) / 2.2);
      $('mundo').style.transform = `translateX(${(-1920 * ease(run)).toFixed(1)}px)`;
      js.forEach((j, i) => {
        const f = figs[i], kc = certos.indexOf(j), certo = kc >= 0;
        const spread = certo ? bc(certa) + (kc - (nC - 1) / 2) * 175 : x0(j, i);
        let x = lerp(x0(j, i), spread, zIn), y = 20, rot = 0;
        if (run > 0) { x += run * run * 2600 + run * 300; y += Math.abs(Math.sin(t * 16 + i)) * 18; rot = 7; }
        else if (certo && t > tPonto(kc) && t < tPonto(kc) + 0.45) y += Math.max(0, Math.sin((t - tPonto(kc)) * 7)) * 50;
        f.style.left = x + 'px'; f.style.bottom = y + 'px'; f.style.transform = `rotate(${rot}deg)`; f.style.zIndex = certo ? 3 : 1;
        f.style.opacity = certo ? 1 : (0.6 + 0.4 * cl(run * 3)).toFixed(2);
        const selo = f.querySelector('.selo-pts');
        if (selo) {
          const bt = t - tPonto(kc), vis = bt > 0 && run < 0.35;
          selo.style.display = vis ? 'flex' : 'none';
          selo.style.transform = `scale(${bt < 0.25 ? (bt / 0.25 * 1.15).toFixed(2) : bt < 0.4 ? 1.1 : 1})`;
          if (bt > 0 && !selo.dataset.som) { selo.dataset.som = 1; Q.sfx('sfx_ponto'); }
        }
      });
      if (run > 0 && !somou) { somou = true; Q.sfx('sfx_correr'); }
    });
    if (!vivo()) return liderAntes;
    figs.forEach((f) => { f.style.opacity = 0; });

    const vel = (j) => (certos.indexOf(j) >= 0 ? certos.indexOf(j) : 99);
    return ranking(`depois da pergunta ${r} de ${Q.RODADAS}`, antes, res.ganho, vel, liderAntes, vivo);
  }

  // Ranking (fim da tela 13): entra na ordem antiga, soma os pontos e reordena com setas
  async function ranking(rotulo, antes, ganho, desempate, liderAntes, vivo) {
    const js = estado.jogadores;
    js.forEach((j) => { j.pontos = antes[j.pid] + (ganho[j.pid] || 0); });
    const velha = js.slice().sort((a, b) => antes[b.pid] - antes[a.pid] || js.indexOf(a) - js.indexOf(b));
    const nova = js.slice().sort((a, b) => b.pontos - a.pontos || desempate(a) - desempate(b) || velha.indexOf(a) - velha.indexOf(b));
    $('rSub').textContent = rotulo;
    const chip = (g) => !g ? '' : g > 0 ? `<span class="gn">+${g}</span>` : `<span class="gn" style="background:#F2545B;box-shadow:0 4px 0 #B83239;color:#fff">−${-g}</span>`;
    $('rLinhas').innerHTML = velha.map((j, i) => `<div class="rl" data-pid="${j.pid}" style="top:${i * 94}px;opacity:0;transform:translateX(-500px)">
      <span class="pos">${i + 1}</span><span class="av"><img src="${Q.img(j.char)}" alt=""></span>
      <span class="nm">${Q.esc(j.nome)}</span>${chip(ganho[j.pid])}<span class="seta"></span>
      <span class="pt">${antes[j.pid]}</span></div>`).join('');
    $('ranking').style.visibility = 'visible';
    const linhas = velha.map((j) => $('rLinhas').querySelector(`[data-pid="${j.pid}"]`));
    Q.sfx('sfx_ranking');
    await animar(1.6, (t) => {
      linhas.forEach((l, i) => { const e = cl((t - i * 0.12) / 0.5); l.style.opacity = e.toFixed(2); l.style.transform = `translateX(${((1 - ease(e)) * -500).toFixed(0)}px)`; });
    });
    await animar(1.3, (t) => {
      const u = cl(t / 1.3);
      velha.forEach((j, i) => { linhas[i].querySelector('.pt').textContent = Math.round(antes[j.pid] + (ganho[j.pid] || 0) * u); });
    });
    await espera(500);
    linhas.forEach((l) => { const g = l.querySelector('.gn'); if (g) g.style.opacity = 0.35; });
    velha.forEach((j, i) => {
      const l = linhas[i], k = nova.indexOf(j), mov = i - k;
      l.style.top = k * 94 + 'px';
      l.querySelector('.pos').textContent = k + 1;
      l.classList.toggle('lider', k === 0);
      const s = l.querySelector('.seta');
      if (mov) { s.textContent = (mov > 0 ? '▲' : '▼') + Math.abs(mov); s.style.color = mov > 0 ? '#43892A' : '#B83239'; }
    });
    if (nova.some((j, k) => velha[k] !== j)) Q.sfx('sfx_ranking_sobe');
    await espera(1000); if (!vivo()) return liderAntes;
    const lider = nova[0];
    if (liderAntes && liderAntes !== lider.pid && lider.pontos > 0) { await diz(reacao('virada')); if (!vivo()) return lider.pid; }
    await diz('Olha o ranking! Na frente está… ' + fala(lider) + '!');
    await espera(1200);
    return lider.pid;
  }

  // ---------- Criar sala ----------
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
    mostrar('sala'); desenharSala();
    Q.falar('Entrem na sala! Apontem a câmera do celular para o QR code, ou digitem a senha.');
    setInterval(() => {
      if (estado.fase === 'sala') {
        const antes = estado.jogadores.length;
        estado.jogadores = estado.jogadores.filter((x) => Date.now() - x.visto < 40000);
        if (estado.jogadores.length !== antes) Q.sfx('sfx_sair');
        desenharSala();
      }
      enviarEstado();
    }, 3000);
  }

  $('criar').addEventListener('click', () => { Q.sfx('sfx_toque'); criarSala(); });
  if (!Q.configurado()) aviso('Falta configurar o Supabase em js/config.js');
})();
