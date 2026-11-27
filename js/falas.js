/* Quem sabe sobe! · Catálogo de falas da Coruja
 *
 * Cada fala tem um código. A TV pede o texto pelo código (QSS_FALAS.t('codigo', ...)), e o gerador de
 * áudios usa QSS_FALAS.lista() para saber todas as falas que existem, com todas as variações
 * (um áudio por personagem, por número, por categoria e por pergunta).
 * Falas com dois personagens ao mesmo tempo foram simplificadas para não multiplicar as gravações.
 */
(function () {
  const Q = window.QSS;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const N = (n) => Q.NUMEROS[n] || String(n);
  const P = (id) => Q.pers(id) || { id, fala: id };
  const PW = (id) => Q.poder(id) || { id, fala: id };
  const intervalo = (a, b, fora) => Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((n) => !(fora || []).includes(n));

  // Domínios das variações
  const DOM = {
    personagem: () => Q.PERSONAGENS.map((p) => p.id),
    poder: () => Q.PODERES.filter((p) => p.id !== 'espelho').map((p) => p.id),
    categoria: () => Object.keys(Q.CATEGORIAS),
    rodada: () => intervalo(1, Q.RODADAS, [Q.RODADA_ASSOCIACAO]),
    pirPergunta: () => intervalo(1, 20),
    degrau: () => intervalo(1, 16),
    faltam: () => intervalo(2, 20)
  };
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // [código, grupo, texto ou função, domínios das variáveis]
  const DEF = [
    // Sala
    ['sala_entrem', 'fixas', 'Entrem na sala! Apontem a câmera do celular para o QR code, ou digitem a senha.'],
    ['sala_prontos', 'fixas', 'Todo mundo pronto? Segurem o botão Iniciar por três segundos.'],
    ['sala_chegou', 'personagens', (p) => `Chegou… ${P(p).fala}!`, ['personagem']],
    // Explicação inicial
    ['explica_1', 'fixas', 'É assim que se joga! Prestem atenção, que eu só explico uma vez.'],
    ['explica_2', 'fixas', 'Eu leio a pergunta, e vocês têm quinze segundos para responder no celular.'],
    ['explica_3', 'fixas', 'Acertou, ganhou pontos. Quem acerta mais rápido leva um bônus.'],
    ['explica_4', 'fixas', 'E dá para atrapalhar os outros com poderes.'],
    ['explica_5', 'fixas', 'Na final, os pontos viram degraus. Quem chegar ao topo vence! Quem sabe… SOBE!'],
    // Votação
    ['rodada', 'numeros', (r) => `Rodada ${N(r)}! Qual vai ser a categoria? Votem no celular!`, ['rodada']],
    ['voto_empate', 'fixas', 'Deu empate! Vou sortear entre as portas.'],
    ['porta', 'categorias', (c) => `A porta escolhida foi… ${c}!`, ['categoria']],
    // Poderes
    ['poder_explica_1', 'fixas', 'Agora vale atrapalhar! A cada rodada, escolham um poder e um alvo. Cada poder pode ser usado duas vezes.'],
    ['poder_explica_2', 'fixas', 'Poderes diferentes no mesmo alvo se somam. E o mesmo poder, vindo de vários jogadores, fica mais forte.'],
    ['poder_hora', 'fixas', 'Hora de atrapalhar! Escolham um poder e um alvo.'],
    ['manda', 'personagens', (p, pw) => `${cap(P(p).fala)} manda ${PW(pw).fala}!`, ['personagem', 'poder']],
    ['espelho_volta', 'personagens', (p) => `Espelho! Voltou tudo para ${P(p).fala}!`, ['personagem']],
    ['espelho_todos', 'fixas', 'Todo mundo pegou espelho! Ninguém lançou poder, então ninguém foi atingido.'],
    ['espelho_alguns', 'fixas', 'Teve gente que pegou espelho! Mas ninguém lançou poder, então ninguém foi atingido.'],
    // Associação
    ['assoc_explica_1', 'fixas', 'Rodada especial! Sem categoria e sem poderes.'],
    ['assoc_explica_2', 'fixas', 'Vocês têm vinte segundos para ligar dez itens. Certo vale dois pontos, errado tira um.'],
    ['assoc_explica_3', 'fixas', 'E quem terminar primeiro ganha bônus!'],
    ['assoc_valendo', 'fixas', 'Valendo!'],
    ['assoc_todos', 'fixas', 'Todo mundo respondeu! Vamos contar os pontos.'],
    ['assoc_tempo', 'fixas', 'Tempo esgotado! Vamos contar os pontos.'],
    // Pergunta e revelação
    ['pergunta_de_dez', 'numeros', (r) => `Pergunta ${N(r)} de dez!`, ['rodada']],
    ['resp_todos', 'fixas', 'Todo mundo respondeu!'],
    ['resp_tempo', 'fixas', 'Tempo esgotado!'],
    ['rev_vamos', 'fixas', 'Vamos ver quem acertou…'],
    ['pontos_explica', 'fixas', 'Quem acertou ganha pontos, e quem respondeu mais rápido ganha bônus!'],
    ['ranking_frente', 'personagens', (p) => `Olha o ranking! Na frente está… ${P(p).fala}!`, ['personagem']],
    ['ranking_empate', 'fixas', 'Olha o ranking! Empate na frente!'],
    // Reações (sorteadas)
    ['reacao_ok_1', 'reacoes', 'Isso aí!'], ['reacao_ok_2', 'reacoes', 'Mandaram bem!'], ['reacao_ok_3', 'reacoes', 'Acertaram em cheio!'],
    ['reacao_erro_1', 'reacoes', 'Ih, essa foi difícil!'], ['reacao_erro_2', 'reacoes', 'Quase!'], ['reacao_erro_3', 'reacoes', 'Ninguém esperava essa!'],
    ['reacao_todos_1', 'reacoes', 'Todo mundo acertou? Essa estava fácil!'], ['reacao_todos_2', 'reacoes', 'Turma afiada!'], ['reacao_todos_3', 'reacoes', 'Cem por cento de acerto!'],
    ['reacao_nenhum_1', 'reacoes', 'Ninguém acertou! Era pegadinha.'], ['reacao_nenhum_2', 'reacoes', 'Ixi, zero acertos!'], ['reacao_nenhum_3', 'reacoes', 'Essa pegou todo mundo!'],
    ['reacao_tempo_1', 'reacoes', 'Cinco segundos!'], ['reacao_tempo_2', 'reacoes', 'Corre, corre!'], ['reacao_tempo_3', 'reacoes', 'O tempo está acabando!'],
    ['reacao_virada_1', 'reacoes', 'Temos um novo líder!'], ['reacao_virada_2', 'reacoes', 'Virou o jogo!'], ['reacao_virada_3', 'reacoes', 'Mudou tudo no ranking!'],
    ['reacao_dois_1', 'reacoes', 'Subiu dois de uma vez!'], ['reacao_dois_2', 'reacoes', 'Que pulo!'], ['reacao_dois_3', 'reacoes', 'Dois degraus, que velocidade!'],
    // Pirâmide
    ['final_comeca', 'fixas', 'A primeira fase acabou! Agora começa a grande final: a Pirâmide do Conhecimento!'],
    ['final_lugar', 'fixas', 'Cada um para o seu degrau!'],
    ['final_degraus', 'fixas', 'Seus pontos viraram degraus! Quem fez mais pontos começa mais alto. Cada um para o seu lugar!'],
    ['regras_dois', 'fixas', 'Acertou, sobe um degrau. Os dois mais rápidos sobem dois.'],
    ['regras_um', 'fixas', 'Acertou, sobe um degrau. O mais rápido sobe dois.'],
    ['regras_poder', 'fixas', 'Aqui ninguém joga poder: cada degrau tem o seu. Quanto mais alto, mais difícil!'],
    ['pir_pergunta', 'numeros', (k) => `Pergunta ${N(k)}!`, ['pirPergunta']],
    ['pir_sobe', 'fixas', 'Quem acertou, sobe!'],
    ['pir_ninguem', 'fixas', 'Ninguém acertou! Todo mundo fica onde está.'],
    ['quase_1', 'personagens', (p) => `${cap(P(p).fala)} está quase no topo!`, ['personagem']],
    ['quase_2', 'personagens', (p) => `Olha quem está chegando lá em cima: ${P(p).fala}!`, ['personagem']],
    ['quase_3', 'personagens', (p) => `Falta pouco para ${P(p).fala}!`, ['personagem']],
    ['faltam_atencao', 'fixas', 'Atenção! Ninguém consegue mais chegar ao topo.'],
    ['faltam_uma', 'fixas', 'Falta só uma pergunta!'],
    ['faltam', 'numeros', (n) => `Faltam só ${N(n)} perguntas!`, ['faltam']],
    ['faltam_fim', 'fixas', 'No fim, vence quem estiver mais alto na pirâmide.'],
    // Desempate
    ['empate_degrau', 'numeros', (d) => `Empate no degrau ${N(d)}!`, ['degrau']],
    ['desempate_vao', 'fixas', 'Os empatados vão para o desempate.'],
    ['desempate_regra', 'fixas', 'Só os finalistas respondem, e quem acertar mais rápido vence!'],
    ['desempate_venceu', 'personagens', (p) => `Quem chegou primeiro foi… ${P(p).fala}!`, ['personagem']],
    ['desempate_ninguem', 'fixas', 'Ninguém acertou! Vamos para mais uma pergunta de desempate.'],
    // Vitória
    ['grito', 'fixas', 'Quem sabe… SOBE!'],
    ['vitoria_topo', 'personagens', (p) => `Parabéns! ${cap(P(p).fala)} chegou ao topo da Pirâmide do Conhecimento!`, ['personagem']],
    ['vitoria_limite', 'personagens', (p) => `Parabéns! ${cap(P(p).fala)} terminou mais alto na pirâmide!`, ['personagem']],
    ['premio', 'fixas', 'O seu prêmio já está no seu celular: um conhecimento inútil! Leia em voz alta para todo mundo.'],
    ['de_novo', 'fixas', 'Querem jogar de novo? Segurem o botão no celular.']
  ];
  const POR_ID = Object.fromEntries(DEF.map((d) => [d[0], d]));

  // Texto de uma fala
  function t(id, ...args) {
    const d = POR_ID[id]; if (!d) { console.warn('Fala sem código:', id); return ''; }
    return typeof d[2] === 'function' ? d[2](...args) : d[2];
  }
  // Reações: sorteia uma variação diferente da última
  const ultima = {};
  function reacao(tipo) {
    const ids = DEF.filter((d) => d[0].startsWith('reacao_' + tipo + '_')).map((d) => d[0]).filter((x) => x !== ultima[tipo]);
    ultima[tipo] = ids[Math.floor(Math.random() * ids.length)];
    return t(ultima[tipo]);
  }
  // Perguntas: o texto e a resposta falada viram duas falas
  const pergunta = (q) => q.texto;
  const resposta = (q) => 'A resposta certa é… ' + q.falada + '!';

  // Todas as falas, com todas as variações: [{ id, grupo, texto }]
  function lista() {
    const out = [];
    for (const [id, grupo, tx, doms] of DEF) {
      if (typeof tx !== 'function') { out.push({ id, grupo, texto: tx }); continue; }
      const combos = (doms || []).reduce((acc, dm) => acc.flatMap((c) => DOM[dm]().map((v) => c.concat([v]))), [[]]);
      for (const c of combos) out.push({ id: id + '_' + c.map(slug).join('_'), grupo, texto: tx(...c) });
    }
    for (const q of window.QSS_PERGUNTAS || []) {
      out.push({ id: q.id + '_pergunta', grupo: 'perguntas', texto: pergunta(q) });
      out.push({ id: q.id + '_resposta', grupo: 'perguntas', texto: resposta(q) });
    }
    return out;
  }

  window.QSS_FALAS = { t, reacao, pergunta, resposta, lista };
})();
