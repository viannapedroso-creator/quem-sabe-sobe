// Rodada 6 · Associação (aba "Associação" da planilha "Banco de perguntas do MVP").
// lado: 'E' = esquerda, 'D' = direita. Só a TV usa o lado certo; o celular recebe apenas o texto.
window.QSS_ASSOC = [
  {
    titulo: 'Filmes ou séries?',
    esq: { nome: 'Filmes', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5l2 4M12 5l2 4M17 5l2 4"/>' },
    dir: { nome: 'Séries', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M8 3l4 3 4-3M8 22h8"/>' },
    itens: [
      { t: 'Titanic', lado: 'E' }, { t: 'Stranger Things', lado: 'D' }, { t: 'Toy Story', lado: 'E' }, { t: 'Breaking Bad', lado: 'D' },
      { t: 'Avatar', lado: 'E' }, { t: 'The Office', lado: 'D' }, { t: 'Procurando Nemo', lado: 'E' }, { t: 'La Casa de Papel', lado: 'D' },
      { t: 'Jurassic Park', lado: 'E' }, { t: 'Game of Thrones', lado: 'D' }
    ]
  },
  {
    titulo: 'Doce ou salgado?',
    esq: { nome: 'Doce', cor: '#F6B6B8', sombra: '#D78A8D', tx: '#1D2A4D', icone: '<path d="M12 3c-2 3-6 4-6 9a6 6 0 0 0 12 0c0-5-4-6-6-9z"/>' },
    dir: { nome: 'Salgado', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<path d="M4 15c0-5 4-9 8-9s8 4 8 9H4z"/><path d="M3 15h18M8 19h8"/>' },
    itens: [
      { t: 'Brigadeiro', lado: 'E' }, { t: 'Coxinha', lado: 'D' }, { t: 'Pudim', lado: 'E' }, { t: 'Pão de queijo', lado: 'D' },
      { t: 'Quindim', lado: 'E' }, { t: 'Feijoada', lado: 'D' }, { t: 'Beijinho', lado: 'E' }, { t: 'Empada', lado: 'D' },
      { t: 'Cocada', lado: 'E' }, { t: 'Kibe', lado: 'D' }
    ]
  },
  {
    titulo: 'Mamífero ou ave?',
    esq: { nome: 'Mamífero', cor: '#6CC24A', sombra: '#43892A', tx: '#FFFFFF', icone: '<circle cx="12" cy="13" r="6"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/>' },
    dir: { nome: 'Ave', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<path d="M3 12c4-1 6-5 9-5s5 3 9 2c-2 4-5 7-9 7s-7-2-9-4z"/><path d="M12 16v4"/>' },
    itens: [
      { t: 'Morcego', lado: 'E' }, { t: 'Pinguim', lado: 'D' }, { t: 'Golfinho', lado: 'E' }, { t: 'Avestruz', lado: 'D' },
      { t: 'Baleia', lado: 'E' }, { t: 'Galinha', lado: 'D' }, { t: 'Ornitorrinco', lado: 'E' }, { t: 'Coruja', lado: 'D' },
      { t: 'Canguru', lado: 'E' }, { t: 'Papagaio', lado: 'D' }
    ]
  },
  {
    titulo: 'Brasil ou Portugal?',
    esq: { nome: 'Brasil', cor: '#52B947', sombra: '#2F7A2A', tx: '#FFFFFF', icone: '<path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="3.5"/>' },
    dir: { nome: 'Portugal', cor: '#F2545B', sombra: '#B83239', tx: '#FFFFFF', icone: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="10" cy="12" r="3"/>' },
    itens: [
      { t: 'Recife', lado: 'E' }, { t: 'Porto', lado: 'D' }, { t: 'Curitiba', lado: 'E' }, { t: 'Coimbra', lado: 'D' },
      { t: 'Manaus', lado: 'E' }, { t: 'Braga', lado: 'D' }, { t: 'Fortaleza', lado: 'E' }, { t: 'Faro', lado: 'D' },
      { t: 'Natal', lado: 'E' }, { t: 'Évora', lado: 'D' }
    ]
  }
];
