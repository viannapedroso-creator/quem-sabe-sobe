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

- 10 rodadas ("Pergunta X de dez"). Ainda não entram: a associação (rodada 6, pulada por enquanto) e a pirâmide (telas 17 a 21).

## Poderes (rodadas 2 a 10, menos a 6)
Telas 08, 09 e 10 e os efeitos no celular.
1. Depois da votação da rodada 2, a Coruja explica os poderes (só uma vez).
2. **Escolha (15 s)**: cada um escolhe um poder e um alvo no celular. Cada poder pode ser usado 2 vezes na Fase 1. O Espelho é usado em si mesmo.
3. **Lançamento**: um de cada vez, na ordem em que foram escolhidos. Se o alvo usou Espelho, o poder volta para quem jogou.
4. **Pergunta**: os efeitos aparecem só no celular de quem foi atingido e se somam. O mesmo poder vindo de 2 ou mais jogadores fica "em dobro":
   - Gosma: cobre a parte de baixo também (precisa esfregar mais).
   - Gelo: 5 toques para quebrar em vez de 3.
   - Bombas: 8 em vez de 5.
   - Cupins: mais mordidas e 2 cupins.
   - Redemoinho: troca a cada 1 s em vez de 1,5 s.
   - Encolhe: letras ainda menores (zoom vai mais longe).

- Perguntas: `js/perguntas.js`, gerado da planilha "Banco de perguntas do MVP". O celular nunca recebe a resposta certa antes da revelação.
- Teste rápido: abra a TV com `?rodadas=2`.
- A voz da Coruja ainda é a do navegador; os áudios da ElevenLabs entram depois.
