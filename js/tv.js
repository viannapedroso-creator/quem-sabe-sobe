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
  const PRIMEIRA = Math.max(1, Math.min(Q.RODADAS + 1, parseInt(params.get('inicio'), 10) || 1)); // 11 = direto para a final
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
  luzes($('fMundo'), $('fMundo').querySelector('.piso')); luzes($('fMundo'), $('fMundo').querySelector('.piso'), 1920);

  // Coruja animada: todas as Corujas das telas mexem a boca enquanto a voz fala
  document.querySelectorAll('.coruja-viva').forEach((el) => window.QSS_CORUJA.montar(el));
  // a boca mexe enquanto a voz fala (e, sem voz no navegador, pelo tempo de leitura)
  function falaVoz(texto) { const p = Q.falar(texto); window.QSS_CORUJA.falar(Promise.all([p, espera(Math.min(6000, 700 + texto.length * 45))])); return p; }

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
  function diz(texto) { return Promise.all([falaVoz(texto), espera(Math.min(6000, 700 + texto.length * 45))]); }
  // Reações curtas: sorteia uma das 3 variações sem repetir a anterior
  const REACOES = {
    ok: ['Isso aí!', 'Mandaram bem!', 'Acertaram em cheio!'],
    erro: ['Ih, essa foi difícil!', 'Quase!', 'Ninguém esperava essa!'],
    todos: ['Todo mundo acertou? Essa estava fácil!', 'Turma afiada!', 'Cem por cento de acerto!'],
    nenhum: ['Ninguém acertou! Era pegadinha.', 'Ixi, zero acertos!', 'Essa pegou todo mundo!'],
    tempo: ['Cinco segundos!', 'Corre, corre!', 'O tempo está acabando!'],
    virada: ['Temos um novo líder!', 'Virou o jogo!', 'Mudou tudo no ranking!'],
    dois: ['Subiu dois de uma vez!', 'Que pulo!', 'Dois degraus, que velocidade!']
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
        if (trocou) falaVoz('Chegou… ' + Q.pers(m.char).fala + '!'); // sala_02
        break;
      }
      case 'pronto':
        if (!j || !j.char || (estado.fase !== 'sala' && estado.fase !== 'fim')) break;
        j.pronto = !!m.on;
        if (j.pronto) Q.sfx('sfx_pronto');
        if (estado.fase === 'fim') desenharDeNovo();
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
        if (d.participantes && !d.participantes.includes(j.pid)) break; // desempate: só os finalistas
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
    if (todos && !avisouSala && !js.some((x) => x.pronto)) { avisouSala = true; setTimeout(() => falaVoz('Todo mundo pronto? Segurem o botão Iniciar por três segundos.'), 1800); }
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
  const ORDEM_FASE1 = (a, b) => (b.pontos || 0) - (a.pontos || 0);

  async function iniciarPartida() {
    const id = ++partida, vivo = () => id === partida;
    confete(false); $('bordao').classList.add('oculto'); $('flash').style.opacity = 0;
    estado.jogadores.forEach((j) => { j.pontos = 0; j.pronto = false; j.deg = 0; j.usos = {}; Q.PODERES.forEach((pw) => { j.usos[pw.id] = Q.USOS_PODER; }); });
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
      window.QSS_CORUJA.reagir('rindo');
      await espera(1200);
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
    // Fase 2: a Pirâmide do Conhecimento (telas 17 a 21)
    await finalPiramide(vivo);
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
      if (!avisou && rest <= 5000 && rest > 0) { avisou = true; falaVoz(reacao('tempo')); }
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
    if (nC) falaVoz('Quem acertou ganha pontos, e quem respondeu mais rápido ganha bônus!');

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


  // =====================================================================
  // Fase 2 · Pirâmide do Conhecimento (telas 17 a 21)
  // =====================================================================
  const TOPO = 16;
  // De 5 a 8 jogadores, os 2 mais rápidos que acertaram sobem 2; com 4 ou menos, só o mais rápido
  const rapidosQueSobemDois = () => (N() >= 5 ? 2 : 1);
  // Poder de cada degrau (nota da tela 18)
  function poderDoDegrau(d) {
    if (d >= 14) return 'gosma'; if (d >= 12) return 'gelo'; if (d >= 10) return 'redemoinho';
    if (d >= 8) return 'bombas'; if (d >= 6) return 'encolhe'; if (d >= 4) return 'cupins'; return null;
  }
  // Pistas: com menos de 8 jogadores, usamos as do meio da pirâmide
  const pista = (i) => Math.floor((8 - N()) / 2) + i;
  function ponto(i, deg, u) {
    const P = window.QSS_PIRAMIDE[pista(i)], a = P[Math.max(0, Math.min(TOPO, deg))], b = P[Math.min(TOPO, deg + 1)];
    u = u || 0;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 34, a[2] + (b[2] - a[2]) * u];
  }
  let pjs = [];
  function montarChars() {
    $('pirChars').innerHTML = estado.jogadores.map((j) => `<div class="pj"><div class="in"><div class="topo"></div><img class="p" src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}"></div></div>`).join('');
    pjs = [...$('pirChars').children].map((el) => ({ el, img: el.querySelector('img'), topo: el.querySelector('.topo'), html: '' }));
  }
  // Coloca cada personagem; extra(i) pode devolver {deg, u, dy, dx, fil, op, topo, lado}
  function posicionar(extra) {
    estado.jogadores.forEach((j, i) => {
      const o = (extra && extra(i, j)) || {}, deg = o.deg !== undefined ? o.deg : j.deg;
      const [x, y, h] = ponto(i, deg, o.u);
      const p = pjs[i]; if (!p) return;
      p.el.style.left = x.toFixed(1) + 'px'; p.el.style.top = (y + (o.dy || 0)).toFixed(1) + 'px'; p.el.style.zIndex = Math.round(y) + (o.z || 0);
      p.el.style.opacity = o.op === undefined ? 1 : o.op;
      p.img.style.height = h.toFixed(1) + 'px'; p.img.style.filter = o.fil || 'none'; p.img.style.transform = o.dx ? `translateX(${o.dx}px)` : '';
      const html = o.topo || '';
      if (html !== p.html) { p.html = html; p.topo.innerHTML = html; }
      p.topo.style.transform = o.tsc && o.tsc !== 1 ? `scale(${o.tsc})` : '';
      if (o.lado) { p.topo.style.bottom = 'auto'; p.topo.style.top = '0'; p.topo.style[o.lado] = 'calc(100% + 12px)'; p.topo.style.alignItems = o.lado === 'right' ? 'flex-end' : 'flex-start'; }
      else { p.topo.style.top = ''; p.topo.style.left = ''; p.topo.style.right = ''; p.topo.style.bottom = ''; p.topo.style.alignItems = ''; }
      p.x = x; p.y = y; p.h = h;
    });
  }
  function lousa(a, b, c) { $('lousa').innerHTML = `<span class="a">${a}</span><span class="b">${b}</span>${c ? `<span class="c">${c}</span>` : ''}`; }
  function relogioPir(frac, seg) {
    const CX = 1664, CY = 295, R = 114, RR = Math.round(R * 0.79);
    let marcas = '';
    for (let k = 0; k < 12; k++) marcas += `<line x1="${(CX + Math.sin(k / 12 * 6.283) * R * 0.82).toFixed(1)}" y1="${(CY - Math.cos(k / 12 * 6.283) * R * 0.82).toFixed(1)}" x2="${(CX + Math.sin(k / 12 * 6.283) * R * 0.93).toFixed(1)}" y2="${(CY - Math.cos(k / 12 * 6.283) * R * 0.93).toFixed(1)}" stroke="#1D2A4D" stroke-width="${k % 3 ? 4 : 7}" stroke-linecap="round"/>`;
    let cunha = '';
    if (frac > 0.001) {
      const a = -Math.PI / 2 + frac * 2 * Math.PI, big = frac > 0.5 ? 1 : 0;
      cunha = frac >= 0.999 ? `M${CX} ${CY - RR}A${RR} ${RR} 0 1 1 ${CX - 0.01} ${CY - RR}Z` : `M${CX} ${CY}L${CX} ${CY - RR}A${RR} ${RR} 0 ${big} 1 ${(CX + Math.cos(a) * RR).toFixed(1)} ${(CY + Math.sin(a) * RR).toFixed(1)}Z`;
    }
    $('pirRelogio').innerHTML = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="#FFFDF5"/><path d="${cunha}" fill="${seg <= 5 ? '#F2545B' : '#7FB3FF'}"/>${marcas}<circle cx="${CX}" cy="${CY}" r="${Math.round(R * 0.5)}" fill="#FFFFFF"/><text x="${CX}" y="${CY + 24}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="72" fill="#1D2A4D">${seg}</text>`;
  }
  // Balão grande ao lado da Coruja
  function cartao(o) {
    const c = $('pirCard');
    if (!o) { c.classList.add('oculto'); return; }
    c.classList.remove('oculto');
    $('pcCab').textContent = o.cab || ''; $('pcCab').style.color = o.cabCor || '#4A5878';
    $('pcLendo').classList.toggle('oculto', !o.lendo);
    $('pcTexto').innerHTML = o.texto || ''; $('pcTexto').style.fontSize = (o.fs || 42) + 'px';
    $('pcAviso').innerHTML = o.aviso || ''; $('pcAviso').classList.toggle('oculto', !o.aviso);
    $('pcAviso').style.cssText = o.aviso ? 'margin:0;font-size:28px;font-weight:800;line-height:1.35;color:#4A5878' : '';
    $('pcRev').classList.toggle('oculto', !o.rev);
    if (o.rev) {
      const a = Q.ALTS[o.rev.k];
      $('pcRev').querySelector('.f').style.cssText = `background:${a.cor};box-shadow:0 5px 0 ${a.sh}`;
      $('pcRev').querySelector('.f').innerHTML = Q.forma(o.rev.k, 26);
      $('pcRev').querySelector('b').textContent = 'Resposta certa: ' + o.rev.texto;
      $('pcRev').lastElementChild.textContent = o.rev.extra || '';
    }
  }
  // Faixa de blocos que cai do alto ("Faltam 3 perguntas!", "Desempate!")
  async function faixa(html, cor, sombra, studs, tx, fs) {
    const f = $('pirFaixa');
    f.querySelector('.studs').innerHTML = Array.from({ length: studs }, () => `<span style="background:${cor}"></span>`).join('');
    const c = f.querySelector('.corpo');
    c.innerHTML = html; c.style.cssText = `background:${cor};color:${tx};font-size:${fs}px;box-shadow:inset 0 -14px 0 rgba(0,0,0,.08),0 16px 0 ${sombra},0 30px 40px rgba(29,42,77,.25)`;
    f.classList.remove('oculto');
    const out = (u) => { const k = 1.70158; return 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2); };
    await animar(1.5, (t) => {
      const u = cl(t / 0.7);
      f.style.top = (-260 + 400 * out(u)).toFixed(1) + 'px';
      f.style.transform = `translateX(-50%) rotate(${(Math.sin(t * 9) * 2 * (1 - cl((t - 0.7) / 0.8))).toFixed(2)}deg)`;
    });
  }
  async function tiraFaixa() {
    const f = $('pirFaixa'), y0 = parseFloat(f.style.top) || 140;
    await animar(0.5, (t) => { f.style.top = (y0 - 300 * cl(t / 0.5)) + 'px'; f.style.opacity = 1 - cl(t / 0.5); });
    f.classList.add('oculto'); f.style.opacity = 1;
  }
  function brilhos(lista) {
    $('pirLuzes').innerHTML = lista.map((l) => `<div class="luz-pir" style="left:${l.x}px;top:${l.y}px;transform:scale(${l.s || 1})${l.c ? `;background:radial-gradient(circle,${l.c} 0,rgba(255,226,120,.3) 55%,rgba(255,226,120,0) 72%)` : ''}"></div>`).join('');
  }
  const COROA = '<svg width="56" height="40" viewBox="0 0 56 40" aria-hidden="true"><path d="M4 36 L8 10 L19 22 L28 4 L37 22 L48 10 L52 36Z" fill="#FFD23F" stroke="#C49A0C" stroke-width="4" stroke-linejoin="round"/></svg>';

  // ---------- 17 · Transição para a final ----------
  async function transicao(vivo) {
    const js = estado.jogadores;
    const lista = js.slice().sort(ORDEM_FASE1);
    const lider = Math.max(0, lista[0].pontos || 0);
    // Pontos viram degraus: o líder começa no 8; os outros, proporcional aos pontos
    js.forEach((j) => { j.inicio = lider <= 0 ? 8 : Math.max(0, Math.min(8, Math.round(Math.max(0, j.pontos || 0) / lider * 8))); j.deg = 0; });
    mudar('final'); mostrar('final');
    $('fMundo').style.transform = ''; $('fFala1').style.transform = 'scale(0)';
    $('fLinhas').innerHTML = lista.map((j, i) => `<div class="rl${i === 0 ? ' lider' : ''}"><span class="pos">${i + 1}</span><span class="av"><img src="${Q.img(j.char)}" alt=""></span><span class="nm">${Q.esc(j.nome)}</span><span class="pt">${j.pontos || 0}</span></div>`).join('');
    await espera(1400); if (!vivo()) return;
    Q.sfx('sfx_correr');
    await animar(2.2, (t) => { $('fMundo').style.transform = `translateX(${(-1920 * ease(cl(t / 2.2))).toFixed(1)}px)`; });
    $('fFala1').style.transform = 'scale(1)';
    await diz('A primeira fase acabou! Agora começa a grande final: a Pirâmide do Conhecimento!'); if (!vivo()) return;
    $('fFala1').style.transform = 'scale(0)';
    // Íris fecha na Coruja e abre na pirâmide
    const iris = $('iris'); iris.style.display = 'block';
    const abre = (r, cx, cy) => { iris.style.left = (cx - r) + 'px'; iris.style.top = (cy - r) + 'px'; iris.style.width = iris.style.height = (2 * r) + 'px'; };
    Q.sfx('sfx_tempo');
    await animar(1.0, (t) => abre(2400 * (1 - ease(cl(t / 1.0))), 760, 600));
    mudar('final'); mostrar('piramide');
    montarChars(); posicionar(); lousa('GRANDE', 'FINAL', '16 DEGRAUS'); $('pirRelogio').innerHTML = ''; brilhos([]); cartao(null);
    await espera(250);
    Q.sfx('sfx_porta');
    await animar(1.0, (t) => abre(2400 * ease(cl(t / 1.0)), 960, 540));
    iris.style.display = 'none';
    cartao({ texto: 'Seus pontos viraram degraus!', aviso: 'Quem fez mais pontos começa mais alto. Cada um para o seu lugar!', fs: 36 });
    await diz('Seus pontos viraram degraus! Quem fez mais pontos começa mais alto. Cada um para o seu lugar!'); if (!vivo()) return;
    // Cada um sobe até o seu degrau inicial
    const PASSO = 0.3, max = Math.max(...js.map((j) => j.inicio));
    Q.sfx('sfx_correr');
    await animar(max * PASSO + js.length * 0.18 + 0.6, (t) => {
      posicionar((i, j) => {
        const e = t - i * 0.18, feito = Math.max(0, e / PASSO), nivel = Math.min(j.inicio, Math.floor(feito));
        const u = e > 0 && nivel < j.inicio ? feito - Math.floor(feito) : 0, chegou = e > 0 && nivel >= j.inicio, ce = e - j.inicio * PASSO;
        return { deg: nivel, u, topo: chegou ? `<span class="chip-pir">${Q.esc(j.nome)} · degrau ${j.inicio}</span>` : '', tsc: chegou && ce < 0.2 ? (ce / 0.2 * 1.15).toFixed(2) : 1 };
      });
    });
    js.forEach((j) => { j.deg = j.inicio; });
    const doisRap = rapidosQueSobemDois() === 2;
    cartao({ texto: 'Acertou, sobe um degrau.', aviso: (doisRap ? 'Os dois mais rápidos sobem dois.' : 'O mais rápido sobe dois.') + ' Aqui ninguém joga poder: cada degrau tem o seu. Quanto mais alto, mais difícil!', fs: 36 });
    await diz(doisRap ? 'Acertou, sobe um degrau. Os dois mais rápidos sobem dois.' : 'Acertou, sobe um degrau. O mais rápido sobe dois.'); if (!vivo()) return;
    await diz('Aqui ninguém joga poder: cada degrau tem o seu. Quanto mais alto, mais difícil!'); if (!vivo()) return;
    posicionar();
  }

  // ---------- 18 · Pergunta na pirâmide ----------
  async function perguntaPir(k, total, q, vivo, finalistas) {
    const js = estado.jogadores, desemp = !!finalistas;
    const joga = (j) => !desemp || finalistas.includes(j);
    respostas = {};
    // poder do degrau entra sozinho no celular (no desempate, sem poder)
    const efeitos = {};
    if (!desemp) js.forEach((j) => { const pw = poderDoDegrau(j.deg); if (pw) efeitos[j.pid] = [{ poder: pw, de: [], degrau: j.deg, forte: false }]; });
    const d = { rodada: 'p' + k, pir: true, q: { id: q.id, cat: q.cat, texto: q.texto }, aberta: false, respondeu: [], prazo: 0, efeitos,
      participantes: desemp ? finalistas.map((j) => j.pid) : null };
    mudar('pergunta', d);
    const cab = desemp ? 'DESEMPATE · ' + finalistas.map((j) => j.nome.toUpperCase()).join(' × ') : 'PIRÂMIDE · ' + q.cat.toUpperCase();
    if (!desemp) lousa('PERGUNTA', `${k}<small>/${total}</small>`, q.cat);
    cartao({ cab, cabCor: desemp ? '#E0412F' : '#4A5878', lendo: true, texto: Q.esc(q.texto) });
    relogioPir(1, 15);
    const fadeDesemp = (i, j) => (desemp && !joga(j) ? { op: 0.45, fil: 'grayscale(.8)' } : {});
    const nomeDesemp = (j, x) => (desemp && joga(j) ? { lado: x < 960 ? 'right' : 'left' } : {});
    posicionar((i, j) => Object.assign(fadeDesemp(i, j), nomeDesemp(j, ponto(i, j.deg)[0]), desemp && joga(j) ? { topo: `<span class="chip-pir" style="font-size:26px;padding:4px 14px">${Q.esc(j.nome)}</span>` } : {}));
    Q.sfx('sfx_pergunta');
    await diz(desemp ? q.texto : `Pergunta ${Q.NUMEROS[k] || k}, ${q.cat}!`); if (!vivo()) return null;
    if (!desemp) { await diz(q.texto); if (!vivo()) return null; }
    cartao({ cab, cabCor: desemp ? '#E0412F' : '#4A5878', texto: Q.esc(q.texto) });

    inicioPergunta = Date.now(); d.aberta = true; d.prazo = inicioPergunta + Q.TEMPO_RESPOSTA; d.q.ops = q.ops;
    enviarEstado();
    let seg = 99, avisou = false;
    const marca = () => posicionar((i, j) => Object.assign(fadeDesemp(i, j), nomeDesemp(j, ponto(i, j.deg)[0]), {
      topo: (desemp && joga(j) ? `<span class="chip-pir" style="font-size:26px;padding:4px 14px">${Q.esc(j.nome)}</span>` : '') + (respostas[j.pid] ? '<span class="exclama" aria-label="respondeu">!</span>' : '') }));
    marca();
    const relo = setInterval(() => {
      const rest = Math.max(0, d.prazo - Date.now()), sg = Math.ceil(rest / 1000);
      relogioPir(rest / Q.TEMPO_RESPOSTA, sg);
      if (sg !== seg && sg > 0) { seg = sg; Q.sfx('sfx_tictac'); }
      if (!avisou && rest <= 5000 && rest > 0) { avisou = true; falaVoz(reacao('tempo')); }
      marca();
    }, 100);
    await aguardar(Q.TEMPO_RESPOSTA, () => { const on = js.filter((j) => online(j) && joga(j)); return on.length > 0 && on.every((j) => respostas[j.pid]); });
    clearInterval(relo);
    d.aberta = false; d.prazo = 0; enviarEstado();
    if (!vivo()) return null;
    const todos = js.filter(joga).every((j) => respostas[j.pid]);
    Q.sfx(todos ? 'sfx_pronto' : 'sfx_tempo');
    await diz(todos ? 'Todo mundo respondeu!' : 'Tempo esgotado!'); if (!vivo()) return null;

    // Revelação
    mudar('pirRevela');
    const certos = js.filter((j) => joga(j) && respostas[j.pid] && respostas[j.pid].op === q.certa).sort((a, b) => respostas[a.pid].ms - respostas[b.pid].ms);
    const n = certos.length;
    const extra = desemp ? (n ? (n > 1 ? `${n} acertaram · ${certos[0].nome} foi mais rápido` : `${certos[0].nome} acertou`) : 'ninguém acertou') : `${n} ${n === 1 ? 'acertou' : 'acertaram'}`;
    cartao({ cab, cabCor: desemp ? '#E0412F' : '#4A5878', texto: Q.esc(q.texto), fs: 28, rev: { k: q.certa, texto: q.ops[q.certa], extra } });
    Q.sfx(n ? 'sfx_certo' : 'sfx_errado');
    await diz('A resposta certa é… ' + q.falada + '!'); if (!vivo()) return null;
    return { certos, desemp };
  }

  // Selos ✓ ✗ e subida (2 mais rápidos sobem 2)
  async function subida(res, vivo) {
    const js = estado.jogadores, certos = res.certos, PASSO = 0.3;
    const rapidos = rapidosQueSobemDois();
    const ganho = (j) => { const o = certos.indexOf(j); return o < 0 ? 0 : o < rapidos ? 2 : 1; };
    const antes = {}; js.forEach((j) => { antes[j.pid] = j.deg; });
    const sobe = js.map((j) => Math.min(ganho(j), TOPO - j.deg));
    // selos
    await animar(1.6, (t) => {
      posicionar((i, j) => {
        const ts = t - i * 0.06, ok = ganho(j) > 0, resp = !!respostas[j.pid];
        if (ts <= 0) return {};
        const selo = ok ? `<span class="selo-pir" style="background:#52B947;box-shadow:0 5px 0 #2F7A2A">✓ +${ganho(j)}</span>` : resp ? '<span class="selo-pir" style="background:#F2545B;box-shadow:0 5px 0 #B83239">✗</span>' : '<span class="selo-pir" style="background:#9AA6BF;box-shadow:0 5px 0 #6C7894">—</span>';
        return { topo: selo, tsc: ts < 0.2 ? (ts / 0.2 * 1.2).toFixed(2) : 1, dy: ok ? -Math.abs(Math.sin(ts * 7)) * 18 : 0,
          fil: ok ? 'none' : 'grayscale(.65) brightness(.92)', dx: !ok && ts < 0.7 ? Math.sin(ts * 40) * 7 : 0 };
      });
    });
    if (!vivo()) return;
    await diz(certos.length ? 'Quem acertou, sobe!' : 'Ninguém acertou! Todo mundo fica onde está.'); if (!vivo()) return;
    if (certos.length) {
      const dur = Math.max(...certos.map((j, o) => o * 0.35 + sobe[js.indexOf(j)] * PASSO)) + 0.6;
      Q.sfx('sfx_correr');
      await animar(dur, (t) => {
        posicionar((i, j) => {
          const g = sobe[i]; if (!g && ganho(j) === 0) return { fil: 'grayscale(.65) brightness(.92)' };
          const o = certos.indexOf(j), e = t - o * 0.35, feito = Math.max(0, e / PASSO), sub = Math.min(g, Math.floor(feito));
          const u = e > 0 && sub < g ? feito - Math.floor(feito) : 0, fim = e > g * PASSO + 0.1;
          return { deg: antes[j.pid] + sub, u, topo: fim ? `<span class="chip-pir">${Q.esc(j.nome)} · degrau ${antes[j.pid] + g}</span>` : `<span class="selo-pir" style="background:#52B947;box-shadow:0 5px 0 #2F7A2A">✓ +${ganho(j)}</span>` };
        });
      });
      js.forEach((j, i) => { j.deg = antes[j.pid] + sobe[i]; });
    }
    posicionar((i, j) => (j.deg !== antes[j.pid] ? { topo: `<span class="chip-pir">${Q.esc(j.nome)} · degrau ${j.deg}</span>` } : {}));
    if (!vivo()) return;
    if (js.some((j) => j.deg >= TOPO)) return; // alguém venceu: sem mais falas, a vitória entra na hora
    // Reações: subiu dois, quase no topo
    if (js.some((j) => j.deg - antes[j.pid] >= 2)) { await diz(reacao('dois')); if (!vivo()) return; }
    const quase = js.filter((j) => j.deg >= 14 && j.deg < TOPO && antes[j.pid] < 14).sort((a, b) => b.deg - a.deg)[0];
    if (quase) { await diz(sorteia([`${fala(quase)} está quase no topo!`, `Olha quem está chegando lá em cima: ${fala(quase)}!`, `Falta pouco para ${fala(quase)}!`])); if (!vivo()) return; }
    await espera(600);
  }

  // ---------- 19 · Aviso "Faltam X perguntas" ----------
  async function faltam(rest, vivo) {
    const js = estado.jogadores;
    mudar('pirFaltam');
    cartao(null); $('pirRelogio').innerHTML = '';
    Q.sfx('sfx_tempo');
    await faixa(rest === 1 ? 'Falta <span style="color:#E0412F">1</span> pergunta!' : `Faltam <span style="color:#E0412F">${rest}</span> perguntas!`, '#FFC531', '#C28F00', 6, '#1D2A4D', 92);
    cartao({ texto: 'Atenção! Ninguém consegue mais chegar ao topo.', aviso: (rest === 1 ? 'Falta só 1 pergunta.' : `Faltam só ${rest} perguntas.`) + ' No fim, vence quem estiver <span style="color:#2F5FB8">mais alto na pirâmide</span>.', fs: 40 });
    await diz('Atenção! Ninguém consegue mais chegar ao topo.'); if (!vivo()) return;
    await diz(rest === 1 ? 'Falta só uma pergunta!' : `Faltam só ${Q.NUMEROS[rest] || rest} perguntas!`); if (!vivo()) return;
    await diz('No fim, vence quem estiver mais alto na pirâmide.'); if (!vivo()) return;
    await tiraFaixa();
    const lider = js.slice().sort((a, b) => b.deg - a.deg)[0], li = js.indexOf(lider);
    const [x, y, h] = ponto(li, lider.deg);
    brilhos([{ x, y: (y - h * 0.45).toFixed(1) }]);
    lousa('FALTAM', `<span style="color:#FFD23F;font-size:120px">${rest}</span>`, rest === 1 ? 'PERGUNTA' : 'PERGUNTAS');
    await animar(1.4, (t) => posicionar((i, j) => (j === lider ? { topo: `<span class="chip-pir" style="font-size:24px;padding:4px 12px">${Q.esc(j.nome)} · mais alto agora</span>${COROA}`, tsc: t < 0.25 ? (t / 0.25 * 1.15).toFixed(2) : 1, dy: t < 1.2 ? -Math.abs(Math.sin(t * 8)) * 16 : 0 } : {})));
    cartao(null);
    await espera(800);
    brilhos([]);
  }

  // ---------- 20 · Desempate entre as finalistas ----------
  async function desempate(finalistas, banco, vivo) {
    const js = estado.jogadores, deg = finalistas[0].deg;
    mudar('pirDesempate');
    $('pirRelogio').innerHTML = '';
    lousa('RODADA DE', '<span style="color:#FFD23F;font-size:48px">DESEMPATE</span>', 'DEGRAU ' + deg);
    const luzF = () => brilhos(finalistas.map((j) => { const i = js.indexOf(j), [x, y, h] = ponto(i, j.deg); return { x, y: (y - h * 0.45).toFixed(1) }; }));
    luzF();
    posicionar((i, j) => (finalistas.includes(j) ? { topo: `<span class="chip-pir" style="font-size:26px;padding:4px 14px">${Q.esc(j.nome)}</span>`, lado: ponto(i, j.deg)[0] < 960 ? 'right' : 'left' } : { op: 0.45, fil: 'grayscale(.8)' }));
    Q.sfx('sfx_tempo');
    await faixa('Desempate!', '#FF7A59', '#C4502F', 5, '#FFFFFF', 100);
    const nomes = finalistas.map((j) => j.nome), lista = nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
    const falaLista = finalistas.map(fala), fl = falaLista.slice(0, -1).join(', ') + ' e ' + falaLista[falaLista.length - 1];
    cartao({ texto: `Empate no degrau ${deg}!`, aviso: `${Q.esc(lista)} vão para o desempate. Só ${finalistas.length === 2 ? 'os dois' : 'os finalistas'} respondem: <span style="color:#2F5FB8">quem acertar mais rápido vence</span>.`, fs: 40 });
    await diz(`Empate no degrau ${Q.NUMEROS[deg] || deg}!`); if (!vivo()) return null;
    await diz(`${fl} vão para o desempate.`); if (!vivo()) return null;
    await diz('Só os finalistas respondem, e quem acertar mais rápido vence!'); if (!vivo()) return null;
    await tiraFaixa();
    for (let tent = 0; tent < 6; tent++) {
      const q = banco.shift(); if (!q) break;
      const res = await perguntaPir(0, 0, q, vivo, finalistas); if (!vivo() || !res) return null;
      // tempos de quem acertou
      posicionar((i, j) => (finalistas.includes(j) ? { lado: ponto(i, j.deg)[0] < 960 ? 'right' : 'left', topo: `<span class="chip-pir" style="font-size:26px;padding:4px 14px">${Q.esc(j.nome)}</span>` + (res.certos.includes(j) ? `<span class="selo-pir" style="background:#52B947;box-shadow:0 5px 0 #2F7A2A;font-size:28px">✓ ${(respostas[j.pid].ms / 1000).toFixed(1).replace('.', ',')} s</span>` : respostas[j.pid] ? '<span class="selo-pir" style="background:#F2545B;box-shadow:0 5px 0 #B83239">✗</span>' : '') } : { op: 0.45, fil: 'grayscale(.8)' }));
      await espera(1200);
      if (res.certos.length) {
        const v = res.certos[0];
        await diz('Quem chegou primeiro foi… ' + fala(v) + '!');
        const vi = js.indexOf(v), [x, y, h] = ponto(vi, v.deg);
        brilhos([{ x, y: (y - h * 0.45).toFixed(1), s: 1.25, c: 'rgba(255,214,80,.95)' }]);
        await animar(1.4, (t) => posicionar((i, j) => (j === v ? { lado: x < 960 ? 'right' : 'left', topo: `<div style="display:flex;align-items:center;gap:8px">${COROA}<span style="white-space:nowrap;font-family:Fredoka,sans-serif;font-weight:700;font-size:30px;background:#FFD23F;color:#1D2A4D;border-radius:14px;padding:6px 16px;box-shadow:0 5px 0 #C49A0C">Venceu!</span></div>`, dy: -Math.abs(Math.sin(t * 7)) * 22 } : finalistas.includes(j) ? {} : { op: 0.45, fil: 'grayscale(.8)' })));
        brilhos([]);
        return v;
      }
      await diz('Ninguém acertou! Vamos para mais uma pergunta de desempate.'); if (!vivo()) return null;
      luzF();
    }
    // Sem perguntas sobrando: sorteio entre os finalistas
    return sorteia(finalistas);
  }

  // ---------- 21 · Vitória, pódio e troféu ----------
  let confAtivo = false;
  function confete(on) {
    confAtivo = on; const box = $('confete');
    if (!on) { box.innerHTML = ''; return; }
    const cores = ['#F2545B', '#FFD23F', '#4F8DF7', '#6CC24A', '#FF7A59', '#B98CF2'], t0 = performance.now();
    box.innerHTML = Array.from({ length: 70 }, () => '<span></span>').join('');
    const sp = [...box.children];
    (function anda() {
      if (!confAtivo) return;
      const t = (performance.now() - t0) / 1000;
      sp.forEach((el, i) => {
        const s = Math.sin(i * 12.9898) * 43758.5453, r1 = s - Math.floor(s), s2 = Math.sin(i * 78.233) * 12345.678, r2 = s2 - Math.floor(s2);
        const vel = 180 + r2 * 160, per = 1300 / vel, a = (t + r1 * per) % per, y = -40 + a * vel;
        el.style.cssText = `left:${(r1 * 1920 + Math.sin(a * 2 + i) * 30).toFixed(0)}px;top:${y.toFixed(0)}px;width:${14 + r2 * 10}px;height:${8 + r1 * 8}px;background:${cores[i % 6]};transform:rotate(${((t * (60 + r2 * 200) + i * 40) % 360).toFixed(0)}deg) scaleX(${Math.cos(t * 5 + i).toFixed(2)})`;
      });
      requestAnimationFrame(anda);
    })();
  }
  function classificacao(venc) {
    return estado.jogadores.slice().sort((a, b) => (b === venc) - (a === venc) || b.deg - a.deg || (b.pontos || 0) - (a.pontos || 0));
  }
  function desenharDeNovo() {
    const js = estado.jogadores, cl_ = (estado.d && estado.d.ordem) || js.map((j) => j.pid);
    const n = js.filter((j) => j.pronto).length;
    $('dnAv').innerHTML = cl_.map((pid) => { const j = js.find((x) => x.pid === pid); return j ? `<i class="${j.pronto ? 'ok' : ''}"><img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}"></i>` : ''; }).join('') + `<span id="dnN">${n}/${js.length}</span>`;
  }
  async function vitoria(venc, porLimite, vivo) {
    const js = estado.jogadores, vi = js.indexOf(venc);
    // Tudo para: corta qualquer fala da Coruja e toca a fanfarra da vitória
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    Q.sfx('sfx_vitoria');
    mudar('pirVitoria');
    cartao(null); $('pirRelogio').innerHTML = ''; brilhos([]);
    lousa('DEGRAU', '<span style="color:#FFD23F;font-size:110px">16</span>', 'TOPO!');
    const de = venc.deg, passos = Math.max(1, TOPO - de);
    Q.sfx('sfx_correr');
    await animar(passos * 0.3 + 0.2, (t) => {
      const feito = cl(t / (passos * 0.3)) * passos, nivel = Math.min(TOPO, de + Math.floor(feito)), u = nivel < TOPO ? feito - Math.floor(feito) : 0;
      posicionar((i, j) => (j === venc ? { deg: nivel, u } : {}));
    });
    venc.deg = TOPO;
    confete(true);
    const b = $('bordao'); b.classList.remove('oculto');
    const out = (u) => { const k = 1.70158; return 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2); };
    window.QSS_CORUJA.reagir('rindo', 3);
    const grito = diz('Quem sabe… SOBE!');
    await animar(2.2, (t) => {
      b.style.transform = `translate(-50%,-50%) scale(${t < 0.35 ? out(cl(t / 0.35)).toFixed(2) : 1}) rotate(-3deg)`;
      posicionar((i, j) => (j === venc ? { dy: -Math.abs(Math.sin(t * 7)) * 22 } : { op: 0.75, fil: 'grayscale(.4)' }));
    });
    await grito; if (!vivo()) return;
    // Clarão e corte para o pódio
    const fl = $('flash');
    await animar(0.3, (t) => { fl.style.opacity = cl(t / 0.3); });
    b.classList.add('oculto');
    const ordem = classificacao(venc);
    const inutil = sorteia(window.QSS_INUTEIS);
    mudar('fim', { vencedor: venc.pid, inutil, ordem: ordem.map((j) => j.pid), degraus: Object.fromEntries(js.map((j) => [j.pid, j.deg])) });
    js.forEach((j) => { j.pronto = false; });
    mostrar('podio');
    $('podTit').textContent = venc.nome + ' venceu!';
    const LUG = [[960, 600, 360], [600, 680, 290], [1320, 740, 280]], CHAO = [[270], [1530], [375], [1650], [1770]];
    const resto = ordem.slice(3);
    const pos = ordem.map((j, k) => (k < 3 ? LUG[k] : [[270, 1530, 375, 1650, 1770][k - 3] || 1770, 860, 210]));
    $('podChars').innerHTML = ordem.map((j, k) => `<div class="pc" style="left:${pos[k][0]}px;top:${pos[k][1]}px;z-index:${500 + pos[k][1] + (k === 0 ? 50 : 0)}"><img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}" style="height:${pos[k][2]}px"></div>`).join('');
    $('podFala').classList.add('oculto'); $('deNovoBox').classList.add('oculto');
    $('trofeu').style.transform = 'scale(0)';
    const imgs = [...$('podChars').querySelectorAll('img')];
    let vivoPod = true;
    const t0 = performance.now();
    (function festa() {
      if (!vivoPod || estado.fase !== 'fim') return;
      const t = (performance.now() - t0) / 1000;
      document.querySelector('#podio .raios').style.transform = `rotate(${(t * 12).toFixed(1)}deg) scale(${cl(t / 0.6).toFixed(2)})`;
      $('podTit').style.transform = `scale(${t < 0.5 ? out(cl((t - 0.1) / 0.4)).toFixed(2) : 1})`;
      imgs.forEach((im, k) => { const f = k === 0 ? Math.abs(Math.sin(t * 6)) * 24 : k < 3 ? Math.abs(Math.sin(t * 5 + k)) * 12 : Math.abs(Math.sin(t * 8 + k * 1.3)) * 8; im.style.transform = `translateY(${-f}px)`; });
      const tt = t - 0.6;
      $('trofeu').style.top = (600 - 240 - 10 - (tt > 0 ? Math.sin(tt * 2.2) * 8 : 0)).toFixed(1) + 'px';
      $('trofeu').style.transform = `scale(${tt < 0 ? 0 : (tt < 0.5 ? out(cl(tt / 0.5)) : 1).toFixed(2)}) rotate(${tt > 0 ? (Math.sin(tt * 2) * 4).toFixed(1) : 0}deg)`;
      requestAnimationFrame(festa);
    })();
    await animar(0.5, (t) => { fl.style.opacity = 1 - cl(t / 0.5); });
    await espera(2200); if (!vivo()) return;
    $('pfTit').textContent = `Parabéns, ${venc.nome}! ${porLimite ? 'Você terminou mais alto!' : 'Você chegou ao topo!'}`;
    $('podFala').classList.remove('oculto');
    await diz(porLimite ? `Parabéns! ${fala(venc)} terminou mais alto na pirâmide!` : `Parabéns! ${fala(venc)} chegou ao topo da Pirâmide do Conhecimento!`); if (!vivo()) return;
    await diz('O seu prêmio já está no seu celular: um conhecimento inútil! Leia em voz alta para todo mundo.'); if (!vivo()) return;
    desenharDeNovo(); $('deNovoBox').classList.remove('oculto');
    await diz('Querem jogar de novo? Segurem o botão no celular.');
  }

  async function finalPiramide(vivo) {
    const js = estado.jogadores;
    await transicao(vivo); if (!vivo()) return;
    const banco = window.QSS_PERGUNTAS.filter((p) => p.fase === 'piramide').sort(() => Math.random() - 0.5);
    const extra = window.QSS_PERGUNTAS.filter((p) => p.fase === 'desempate').sort(() => Math.random() - 0.5);
    const total = Math.min(20, banco.length, parseInt(params.get('pir'), 10) || 20); // ?pir=3 limita as perguntas (teste)
    let avisouFaltam = false, venc = null;
    for (let k = 1; k <= total; k++) {
      const q = banco.shift();
      const res = await perguntaPir(k, total, q, vivo); if (!vivo() || !res) return;
      await subida(res, vivo); if (!vivo()) return;
      const noTopo = js.filter((j) => j.deg >= TOPO);
      if (noTopo.length) { venc = noTopo.sort((a, b) => res.certos.indexOf(a) - res.certos.indexOf(b))[0]; break; }
      const rest = total - k, max = Math.max(...js.map((j) => j.deg));
      if (!avisouFaltam && rest > 0 && max + 2 * rest < TOPO) { avisouFaltam = true; await faltam(rest, vivo); if (!vivo()) return; }
    }
    let porLimite = false;
    if (!venc) {
      porLimite = true;
      const max = Math.max(...js.map((j) => j.deg)), emp = js.filter((j) => j.deg === max);
      venc = emp.length > 1 ? await desempate(emp, extra.concat(banco), vivo) : emp[0];
      if (!vivo() || !venc) return;
    }
    await vitoria(venc, porLimite, vivo);
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
    falaVoz('Entrem na sala! Apontem a câmera do celular para o QR code, ou digitem a senha.');
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
