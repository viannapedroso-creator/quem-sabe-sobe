# Quem sabe sobe!

Quiz de festa: a TV mostra o jogo e cada jogador usa o próprio celular como controle.

- `index.html` — tela da TV (anfitriã da sala).
- `c/index.html` — controle no celular (entrar na sala, escolher personagem, responder).
- `js/config.js` — endereço e chave **publicável** do Supabase (tempo real).
- Publicado pelo GitHub Pages em https://quemsabesobe.com.br

## Como funciona a sala
A TV cria um canal de tempo real no Supabase (`qss-sala-<SENHA>`), decide as regras e manda o estado completo para os celulares. Os celulares só mandam intenções (entrar, escolher personagem, segurar Iniciar, responder).
