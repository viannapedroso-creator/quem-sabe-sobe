# Quem sabe sobe!

Quiz de festa: a TV mostra o jogo e cada jogador usa o próprio celular como controle.

- `index.html` — tela da TV (anfitriã da sala).
- `c/index.html` — controle no celular (entrar na sala, escolher personagem, responder).
- `js/config.js` — endereço e chave **publicável** do Supabase (tempo real).
- Publicado pelo GitHub Pages em https://quemsabesobe.com.br

## Como funciona a sala
A TV cria um canal de tempo real no Supabase (`qss-sala-<SENHA>`), decide as regras e manda o estado completo para os celulares. Os celulares só mandam intenções (entrar, escolher personagem, segurar Iniciar, responder).

## Primeira fase (já jogável)
Segue o quadro "Quem sabe sobe! · Telas do jogo" (telas 06 a 13) e o roteiro de falas da Coruja.

1. **06 · Explicação**: a Coruja explica uma vez (na revanche ela não repete). Celular: "Olhe para a TV".
2. **07 · Votação**: 4 portas de categoria, 15 s no relógio de despertador. Cada um corre para a porta que escolheu (07b). Empate: sorteio piscando entre as portas empatadas (07c).
3. **11 · Pergunta**: a TV mostra a pergunta e os 4 blocos com cor e forma, **sem as respostas**. As respostas aparecem só no celular. 15 s.
4. **12 · Revelação**: as respostas aparecem nos blocos, os personagens correm até o bloco que escolheram e a certa acende.
5. **13 · Pontuação**: acertou = 10 + bônus de rapidez (o mais rápido entre os que acertaram ganha N de bônus, N = número de jogadores; o segundo, N−1…). Errou = 0. A câmera aproxima, os pontos aparecem um por um, o cenário corre e o ranking reordena com setas. Celular: "Olhe para a TV".
6. Fim da Fase 1: ranking final. Para jogar de novo, todos seguram o botão no celular.

- 10 rodadas ("Pergunta X de dez").

## Final: Pirâmide do Conhecimento (telas 17 a 21)
1. **Transição**: ranking final da Fase 1, o cenário corre até a Coruja, íris fecha e abre na pirâmide. Os pontos viram degraus: o líder começa no 8; os outros, proporcional aos pontos.
2. **Pergunta**: acertou sobe 1; os mais rápidos que acertaram sobem 2 (os 2 mais rápidos com 5 a 8 jogadores; só o mais rápido com 4 ou menos); errou fica parado. O poder do degrau entra sozinho no celular (4–5 Cupins, 6–7 Encolhe, 8–9 Bombas, 10–11 Redemoinho, 12–13 Gelo, 14–15 Gosma).
3. **Faltam**: aparece uma vez, quando ninguém mais consegue chegar ao topo (degrau mais alto + 2 × perguntas que restam < 16).
4. **Desempate**: se o limite de perguntas acaba com empate no degrau mais alto, só os finalistas respondem, sem poder; vence quem acertar mais rápido. Se todos erram, vem outra pergunta.
5. **Vitória**: quem chega ao degrau 16 vence na hora: a narração para e toca a fanfarra. "Quem sabe… SOBE!", clarão, pódio, troféu e o prêmio (um conhecimento inútil) abre só no celular do vencedor. Jogar de novo: todos seguram o botão.
- Limite de perguntas: 20 ou o que houver no banco (hoje 12 da Pirâmide). Testes: `?inicio=11` vai direto para a final; `?pir=3` limita a 3 perguntas.
- Depois de mudar JS ou CSS, rode `python3 versao.py` antes de publicar: ele atualiza o `?v=` dos arquivos para o navegador não usar código velho do cache.

## Rodada 6 · Associação (telas 14, 15 e 16)
Sem categoria e sem poderes. A Coruja explica, e cada um tem 20 s para ligar 10 itens no celular (tocar no lado ou arrastar o item). A TV mostra uma pilha de blocos por jogador, sem dizer se acertou. Depois confere item por item: certa +2, errada −1, sem resposta 0, e bônus para quem terminou primeiro (N para o 1º, N−1 para o 2º…, N = número de jogadores). Em seguida, o ranking. Os itens vêm de `js/associacao.js` (aba "Associação" da planilha).

## Poderes (rodadas 2 a 10, menos a 6)
Telas 08, 09 e 10 e os efeitos no celular.
1. Depois da votação da rodada 2, a Coruja explica os poderes (só uma vez).
2. **Escolha (15 s)**: cada um escolhe um poder e um alvo no celular. Cada poder pode ser usado 2 vezes na Fase 1. O Espelho é usado em si mesmo.
3. **Lançamento**: um de cada vez, na ordem em que foram escolhidos. Se o alvo usou Espelho, o poder volta para quem jogou.
4. **Pergunta**: os efeitos aparecem só no celular de quem foi atingido e se somam. O mesmo poder vindo de 2 ou mais jogadores fica "em dobro":
   - Gosma: duas passadas de dedo. A primeira deixa a gosma 80% transparente; a segunda limpa.
   - Gelo: 5 toques para quebrar em vez de 3.
   - Bombas: 8 em vez de 5.
   - Cupins: mais mordidas e 2 cupins.
   - Redemoinho: troca a cada 1 s em vez de 1,5 s.
   - Encolhe: letras ainda menores (zoom vai mais longe).

- Perguntas: `js/perguntas.js`, gerado da planilha "Banco de perguntas do MVP". O celular nunca recebe a resposta certa antes da revelação.
- Teste rápido: `?rodadas=2` joga só até a rodada 2; `?inicio=6` começa direto na rodada 6 (dá para juntar: `?inicio=6&rodadas=7`).
- A voz da Coruja ainda é a do navegador; os áudios da ElevenLabs entram depois.

## Ajustes de 27/11
- **Pular explicações**: chave ao lado de "Criar sala" (desligada por padrão). Ligada, pula a explicação inicial, a dos poderes, a da associação e as regras da pirâmide.
- **Só espelho na rodada**: se ninguém lançou poder mas alguém pegou Espelho, a tela de lançamento mostra "Todo mundo pegou Espelho!" (ou quem pegou) e a Coruja explica que ninguém foi atingido.
- **Opções embaralhadas**: cada celular mostra as 4 opções numa ordem própria; cores e formas seguem a posição. Na TV, os blocos mostram só o texto e a resposta certa vem com um ✓.
- **Empate no ranking**: pontos iguais ficam na mesma posição (1, 1, 3…); empate na liderança é anunciado.

## Personagens animados (27/11)
- Os personagens da TV usam o rig em partes (`js/rig.js` + `js/rig-dados.js`, imagens em `img/rig/`): pernas, braços, tronco e 6 rostos.
- Cada boneco tem uma ação no atributo `data-acao`: parado, contente, pronto, pensando, feliz, comemora, vibra, triste, assustado, perdido, correr, subir.
- Avatares pequenos (ranking, celular) continuam com a imagem parada.
- A versão anterior, com personagens parados, está guardada no branch `versao-estatica`.

## Banco ampliado (27/11)
- 159 perguntas: 99 da Fase 1 (16 a 17 por categoria), 48 da pirâmide e 12 de desempate. 15 temas de associação.
- A TV guarda no navegador as perguntas e os temas já usados; as próximas partidas priorizam o que ainda não saiu e recomeçam quando acaba.
