// TV: anfitriã da sala. Ela decide tudo e manda o estado completo para os celulares.
(function () {
  const Q = window.QSS;
  const $ = (id) => document.getElementById(id);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const params = new URLSearchParams(location.search);
  const N_PERGUNTAS = Math.max(1, Math.min(9, parseInt(params.get('perguntas'), 10) || 5));

  // Escala o palco de 1920×1080 para caber na janela
  function ajustar() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    $('palco').style.transformOrigin = '50% 50%';
    $('palco').style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener('resize', ajustar); ajustar();

  function mostrar(id) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('oculto', t.id !== id));
    const jogo = !['inicio', 'sala'].includes(id);
    $('corujaJogo').classList.toggle('oculto', !jogo);
    $('corujaJogo').classList.toggle('grande', id === 'explica');
  }
  function aviso(txt) { const a = $('aviso'); a.textContent = txt || ''; a.classList.toggle('oculto', !txt); }

  // jogadores: {pid, nome, char, pronto, visto, pontos, ganho}
  const estado = { fase: 'sala', jogadores: [], d: null };
  let rede = null, codigo = '', partida = 0;

  const online = (j) => Date.now() - j.visto < 12000;
  const nomeChar = (j) => (Q.pers(j.char) || {}).nome || j.nome;

  function enviarEstado() {
    if (!rede) return;
    let d = estado.d;
    if (d && d.prazo) d = Object.assign({}, d, { restante: Math.max(0, d.prazo - Date.now()), prazo: undefined });
    rede.enviar('estado', {
      fase: estado.fase, d,
      jogadores: estado.jogadores.map((j) => ({ pid: j.pid, nome: j.nome, char: j.char, pronto: j.pronto, online: online(j), pontos: j.pontos || 0 }))
    });
  }
  function mudar(fase, d) { estado.fase = fase; estado.d = d || null; enviarEstado(); }

  // ---------- Coruja: balão + voz ----------
  // Espera a voz terminar, mas nunca menos que o tempo de leitura (caso o navegador não tenha voz).
  async function diz(texto) {
    $('balaoJogo').textContent = texto;
    $('balaoJogo').classList.remove('surge'); void $('balaoJogo').offsetWidth; $('balaoJogo').classList.add('surge');
    await Promise.all([Q.falar(texto), espera(Math.min(6000, 900 + texto.length * 45))]);
  }
  function listaNomes(js) {
    const n = js.map(nomeChar);
    return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
  }

  // Espera até o tempo acabar ou a condição ficar verdadeira (checada a cada mensagem recebida)
  let acordar = null;
  function aguardar(ms, pronto) {
    return new Promise((ok) => {
      const fim = () => { clearTimeout(t); acordar = null; ok(); };
      const t = setTimeout(fim, ms);
      acordar = () => { if (pronto()) fim(); };
      acordar();
    });
  }
  const todosOnline = () => estado.jogadores.filter(online);

  // ---------- Mensagens dos celulares ----------
  function aoReceber(m) {
    const agora = Date.now();
    const j = estado.jogadores.find((x) => x.pid === m.pid);
    if (j) j.visto = agora;
    const d = estado.d;
    switch (m.t) {
      case 'ola':
        break;
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
      case 'votar':
        if (!j || estado.fase !== 'porta' || !d || d.fechada) break;
        if (!(m.i >= 0 && m.i < d.portas.length)) break;
        d.votos[j.pid] = m.i; Q.sfx('sfx_voto');
        desenharPortas();
        break;
      case 'responder':
        if (!j || estado.fase !== 'pergunta' || !d || !d.aberta || m.qid !== d.q.id) break;
        if (respostas[j.pid] || !(m.op >= 0 && m.op <= 3)) break;
        respostas[j.pid] = { op: m.op, ms: agora - inicioPergunta };
        d.respondeu.push(j.pid); Q.sfx('sfx_resposta');
        desenharJogadoresPergunta();
        break;
    }
    if (estado.fase === 'sala') desenhar();
    enviarEstado();
    if (acordar) acordar();
  }

  function verificarInicio() {
    const js = estado.jogadores;
    if (js.length >= 2 && js.every((x) => x.char && x.pronto)) iniciarPartida();
  }

  // ---------- Sala de espera ----------
  function desenhar() {
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

  // ---------- Partida ----------
  let respostas = {}, inicioPergunta = 0;

  async function iniciarPartida() {
    const id = ++partida;
    const vivo = () => id === partida;
    estado.jogadores.forEach((j) => { j.pontos = 0; j.ganho = 0; });
    Q.sfx('sfx_comecar');
    mudar('comecando');
    mostrar('comecando');
    $('fila').innerHTML = estado.jogadores.map((x) => `<img src="${Q.img(x.char)}" alt="${Q.esc(x.nome)}">`).join('');
    await diz('Todo mundo pronto! Então vamos começar!');
    if (!vivo()) return;

    // 1) Explicação
    mudar('explica'); mostrar('explica');
    const regras = [
      ['Eu faço a pergunta aqui na TV, e vocês respondem no celular.', 0],
      ['Quem acerta ganha pontos. E quanto mais rápido, mais pontos!', 1],
      [`Antes de cada pergunta, vocês votam na porta da categoria. Serão ${N_PERGUNTAS} perguntas.`, 2],
      ['No final, os pontos viram degraus na pirâmide. Quem sabe... sobe!', 3]
    ];
    for (const [txt, i] of regras) {
      document.querySelectorAll('#regras li').forEach((li, k) => li.classList.toggle('ativa', k === i));
      document.querySelectorAll('#regras li').forEach((li, k) => li.classList.toggle('vista', k < i));
      await diz(txt); if (!vivo()) return;
    }

    // 2) Perguntas
    const restantes = window.QSS_PERGUNTAS.filter((p) => p.fase === 'fase1').slice();
    for (let i = 0; i < N_PERGUNTAS && restantes.length; i++) {
      const cat = await votarPorta(i, restantes, vivo); if (!vivo()) return;
      const doCat = restantes.filter((p) => p.cat === cat);
      const q = doCat[Math.floor(Math.random() * doCat.length)];
      restantes.splice(restantes.indexOf(q), 1);
      await fazerPergunta(i, q, vivo); if (!vivo()) return;
      await revelar(q, vivo); if (!vivo()) return;
      await mostrarRanking(i, vivo); if (!vivo()) return;
    }
    fimDaFase();
  }

  // Porta: 3 categorias sorteadas entre as que ainda têm pergunta. Empate é sorteado.
  async function votarPorta(i, restantes, vivo) {
    const cats = [...new Set(restantes.map((p) => p.cat))].sort(() => Math.random() - 0.5).slice(0, 3);
    if (cats.length === 1) return cats[0];
    const d = { num: i + 1, total: N_PERGUNTAS, portas: cats, votos: {}, prazo: Date.now() + Q.TEMPO_PORTA, fechada: false, vencedora: null };
    mudar('porta', d); mostrar('porta');
    $('portaTitulo').textContent = `Pergunta ${i + 1} de ${N_PERGUNTAS}`;
    desenharPortas();
    Q.sfx('sfx_porta');
    Q.falar(i === 0 ? 'Escolham a porta da primeira pergunta!' : 'Escolham a próxima porta!');
    const relogio = setInterval(() => { $('portaTempo').textContent = Math.ceil(Math.max(0, d.prazo - Date.now()) / 1000) + 's'; }, 200);
    await aguardar(Q.TEMPO_PORTA, () => { const on = todosOnline(); return on.length > 0 && on.every((j) => d.votos[j.pid] !== undefined); });
    clearInterval(relogio);
    if (!vivo()) return cats[0];
    d.fechada = true; d.prazo = 0; $('portaTempo').textContent = '';
    const cont = cats.map((_, k) => Object.values(d.votos).filter((v) => v === k).length);
    const max = Math.max(...cont);
    const empatadas = cont.map((c, k) => (c === max ? k : -1)).filter((k) => k >= 0);
    d.vencedora = empatadas[Math.floor(Math.random() * empatadas.length)];
    d.sorteio = empatadas.length > 1;
    enviarEstado(); desenharPortas();
    Q.sfx('sfx_porta');
    await diz((d.sorteio ? (max === 0 ? 'Ninguém votou, então eu sorteei: ' : 'Deu empate! Sorteei: ') : 'Porta escolhida: ') + cats[d.vencedora] + '!');
    return cats[d.vencedora];
  }

  const CORES_PORTA = ['amarelo', 'azul', 'vermelho'];
  function desenharPortas() {
    const d = estado.d; if (!d || !d.portas) return;
    $('portas').innerHTML = d.portas.map((c, k) => {
      const quem = estado.jogadores.filter((j) => d.votos[j.pid] === k);
      const cls = d.vencedora === null ? '' : d.vencedora === k ? ' venceu' : ' perdeu';
      return `<div class="porta ${CORES_PORTA[k]}${cls}">
        <div class="folha"><span class="num">${k + 1}</span><span class="cat">${Q.esc(c)}</span><span class="macaneta"></span></div>
        <div class="votos">${quem.map((j) => `<img src="${Q.img(j.char)}" alt="${Q.esc(j.nome)}">`).join('')}</div></div>`;
    }).join('');
  }

  async function fazerPergunta(i, q, vivo) {
    respostas = {};
    estado.jogadores.forEach((j) => { j.ganho = 0; });
    const d = { num: i + 1, total: N_PERGUNTAS, q: { id: q.id, cat: q.cat, texto: q.texto, ops: q.ops }, aberta: false, respondeu: [], prazo: 0 };
    mudar('pergunta', d); mostrar('pergunta');
    $('pCat').textContent = q.cat; $('pNum').textContent = `Pergunta ${i + 1} de ${N_PERGUNTAS}`;
    $('pTexto').textContent = q.texto;
    $('pOps').innerHTML = q.ops.map((o, k) => `<div class="op op${k}"><b>${'ABCD'[k]}</b><span>${Q.esc(o)}</span></div>`).join('');
    $('pOps').className = 'ops';
    $('pRelogio').classList.remove('urgente'); pintarRelogio(1, Q.TEMPO_RESPOSTA);
    desenharJogadoresPergunta();
    Q.sfx('sfx_pergunta');
    await diz(q.texto); if (!vivo()) return;

    // Abre as respostas
    inicioPergunta = Date.now(); d.aberta = true; d.prazo = inicioPergunta + Q.TEMPO_RESPOSTA;
    $('pOps').classList.add('abertas');
    enviarEstado();
    let ultimoSeg = 99, raf = 0;
    const tique = () => {
      const r = Math.max(0, d.prazo - Date.now()), s = Math.ceil(r / 1000);
      pintarRelogio(r / Q.TEMPO_RESPOSTA, r);
      if (s !== ultimoSeg) { ultimoSeg = s; if (s <= 5 && s > 0) { Q.sfx('sfx_tique'); $('pRelogio').classList.add('urgente'); } }
      if (d.aberta) raf = requestAnimationFrame(tique);
    };
    raf = requestAnimationFrame(tique);
    await aguardar(Q.TEMPO_RESPOSTA, () => { const on = todosOnline(); return on.length > 0 && on.every((j) => respostas[j.pid]); });
    d.aberta = false; d.prazo = 0; cancelAnimationFrame(raf);
    enviarEstado();
    Q.sfx('sfx_tempo');
    await espera(700);
  }

  function pintarRelogio(frac, ms) {
    $('pArco').setAttribute('stroke-dashoffset', (565 * (1 - frac)).toFixed(1));
    $('pSeg').textContent = Math.ceil(ms / 1000);
  }

  function desenharJogadoresPergunta(revelado) {
    const d = estado.d; if (!d) return;
    $('pJogadores').innerHTML = estado.jogadores.map((j) => {
      const r = respostas[j.pid];
      let selo = '';
      if (revelado) selo = !r ? '<span class="selo cinza">—</span>' : r.ok ? `<span class="selo">+${Q.fmt(r.pts)}</span>` : '<span class="selo vermelho">✗</span>';
      else if (r) selo = '<span class="selo azul">✓</span>';
      return `<div class="jp${r ? ' respondeu' : ''}${revelado && r && r.ok ? ' acertou' : ''}">${selo}<img src="${Q.img(j.char)}" alt=""><span>${Q.esc(j.nome)}</span></div>`;
    }).join('');
  }

  async function revelar(q, vivo) {
    const acertaram = [];
    estado.jogadores.forEach((j) => {
      const r = respostas[j.pid];
      if (!r) return;
      r.ok = r.op === q.certa; r.pts = r.ok ? Q.pontosPor(r.ms) : 0;
      j.ganho = r.pts; j.pontos = (j.pontos || 0) + r.pts;
      if (r.ok) acertaram.push(j);
    });
    const res = {}; Object.keys(respostas).forEach((pid) => { res[pid] = { op: respostas[pid].op, ok: respostas[pid].ok, pts: respostas[pid].pts }; });
    const d = Object.assign({}, estado.d, { aberta: false, certa: q.certa, resultados: res, falada: q.falada });
    mudar('revela', d);
    $('pOps').className = 'ops revelado';
    $('pOps').children[q.certa].classList.add('certa');
    // Mostra quem marcou cada opção
    [...$('pOps').children].forEach((el, k) => {
      const quem = estado.jogadores.filter((j) => respostas[j.pid] && respostas[j.pid].op === k);
      if (quem.length) el.insertAdjacentHTML('beforeend', `<i class="marcaram">${quem.map((j) => `<img src="${Q.img(j.char)}" alt="">`).join('')}</i>`);
    });
    desenharJogadoresPergunta(true);
    Q.sfx(acertaram.length ? 'sfx_certo' : 'sfx_errado');
    await diz(`A resposta certa é: ${q.falada}!`); if (!vivo()) return;
    const n = estado.jogadores.length;
    if (!acertaram.length) await diz('Ninguém acertou essa!');
    else if (acertaram.length === n) await diz('Todo mundo acertou! Muito bem!');
    else if (acertaram.length === 1) await diz(`Só ${listaNomes(acertaram)} acertou!`);
    else await diz(`Acertaram: ${listaNomes(acertaram)}!`);
    await espera(600);
  }

  function ordenados() { return estado.jogadores.slice().sort((a, b) => (b.pontos || 0) - (a.pontos || 0)); }

  async function mostrarRanking(i, vivo) {
    mudar('ranking', { num: i + 1, total: N_PERGUNTAS });
    mostrar('ranking');
    $('rTitulo').textContent = i + 1 < N_PERGUNTAS ? `Placar · depois da pergunta ${i + 1} de ${N_PERGUNTAS}` : 'Placar final da fase';
    desenharRanking($('rLista'), true);
    Q.sfx('sfx_ranking');
    const lider = ordenados()[0];
    const empateTopo = ordenados().filter((j) => j.pontos === lider.pontos).length > 1;
    if (i + 1 < N_PERGUNTAS) {
      if (!lider.pontos) await diz('Ninguém pontuou ainda. Bora pra próxima!');
      else if (empateTopo) await diz('Empate na liderança! Vamos pra próxima.');
      else await diz(`${nomeChar(lider)} está na frente! Próxima pergunta.`);
      await espera(900);
    } else await espera(1500);
  }

  function desenharRanking(el, anima) {
    const lista = ordenados();
    const max = Math.max(1, ...lista.map((j) => j.pontos || 0));
    let pos = 0, ant = null;
    el.innerHTML = lista.map((j, k) => {
      if (j.pontos !== ant) { pos = k + 1; ant = j.pontos; }
      return `<li class="${pos === 1 && j.pontos ? 'lider' : ''}">
        <span class="pos">${pos}º</span><img src="${Q.img(j.char)}" alt="">
        <span class="quem"><b>${Q.esc(j.nome)}</b><small>${Q.esc(nomeChar(j))}</small></span>
        <span class="barra"><i style="width:${anima ? 0 : (100 * (j.pontos || 0)) / max}%" data-w="${(100 * (j.pontos || 0)) / max}"></i></span>
        <span class="pts">${Q.fmt(j.pontos)}${j.ganho ? `<em>+${Q.fmt(j.ganho)}</em>` : ''}</span></li>`;
    }).join('');
    if (anima) requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('.barra i').forEach((b) => { b.style.width = b.dataset.w + '%'; })));
  }

  async function fimDaFase() {
    estado.jogadores.forEach((j) => { j.ganho = 0; });
    mudar('fim');
    mostrar('fim');
    desenharRanking($('fLista'), true);
    Q.sfx('sfx_fim');
    const lista = ordenados(), lider = lista[0];
    const empatados = lista.filter((j) => j.pontos === lider.pontos);
    await diz(empatados.length > 1
      ? `Fim da primeira fase! ${listaNomes(empatados)} terminaram empatados na frente.`
      : `Fim da primeira fase! ${nomeChar(lider)} terminou na frente, com ${Q.fmt(lider.pontos)} pontos.`);
    await diz('A pirâmide vem na próxima etapa. Querem jogar de novo?');
  }

  function voltarParaSala() {
    partida++; // cancela qualquer sequência em andamento
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    estado.jogadores.forEach((j) => { j.pronto = false; j.pontos = 0; j.ganho = 0; });
    mudar('sala'); mostrar('sala'); desenhar();
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
    mostrar('sala'); desenhar();
    Q.falar('Entrem na sala! Apontem a câmera do celular para o QR code, ou digitem a senha.');
    // Reenvia o estado e, na sala, tira quem sumiu há mais de 40 segundos
    setInterval(() => {
      if (estado.fase === 'sala') {
        const antes = estado.jogadores.length;
        estado.jogadores = estado.jogadores.filter((x) => Date.now() - x.visto < 40000);
        if (estado.jogadores.length !== antes) Q.sfx('sfx_sair');
        desenhar();
      }
      enviarEstado();
    }, 3000);
  }

  $('criar').addEventListener('click', () => { Q.sfx('sfx_toque'); criarSala(); });
  $('deNovo').addEventListener('click', () => { Q.sfx('sfx_toque'); voltarParaSala(); });
  if (!Q.configurado()) aviso('Falta configurar o Supabase em js/config.js');

  // Modo de teste local: index.html?demo=1 cria jogadores falsos que votam e respondem sozinhos
  if (params.get('demo')) window.QSS_DEMO = { estado, aoReceber: (m) => aoReceber(m), iniciar: iniciarPartida, mostrar, desenhar };
})();
