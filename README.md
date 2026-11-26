# Quem sabe sobe!

Quiz de festa: a TV mostra o jogo e cada jogador usa o próprio celular como controle.

- `index.html` — tela da TV (anfitriã da sala).
- `c/index.html` — controle no celular (entrar na sala, escolher personagem, responder).
- `js/config.js` — endereço e chave **publicável** do Supabase (tempo real).
- Publicado pelo GitHub Pages em https://quemsabesobe.com.br

## Como funciona a sala
A TV cria um canal de tempo real no Supabase (`qss-sala-<SENHA>`), decide as regras e manda o estado completo para os celulares. Os celulares só mandam intenções (entrar, escolher personagem, segurar Iniciar, responder).

## Primeira fase (já jogável)
1. A Coruja explica as regras (celulares mostram "Olhe para a TV").
2. Para cada pergunta: votação de porta com 3 categorias (10 s; empate é sorteado), pergunta lida pela Coruja, 15 s para responder no celular.
3. Acerto vale de 500 a 1.000 pontos (metade fixa, metade pela rapidez). A TV marca o tempo de cada resposta pelo próprio relógio.
4. Revelação com quem marcou cada opção, placar e, no fim, a classificação da fase com "Jogar de novo".

- Perguntas: `js/perguntas.js`, gerado da planilha "Banco de perguntas do MVP". O celular nunca recebe a resposta antes da revelação.
- Quantidade de perguntas: 5 por padrão; para testar mais rápido, abra a TV com `?perguntas=2` (de 1 a 9).
- A voz da Coruja ainda é a do navegador; os áudios da ElevenLabs entram depois.
