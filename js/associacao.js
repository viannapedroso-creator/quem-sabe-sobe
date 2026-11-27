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
  },
  {
    titulo: 'Rio ou São Paulo?',
    esq: { nome: 'Rio', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="17" cy="7" r="3"/>' },
    dir: { nome: 'São Paulo', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<rect x="4" y="3" width="9" height="18"/><path d="M13 9h7v12h-7M7 7h3M7 11h3M7 15h3"/>' },
    itens: [
      { t: 'Cristo Redentor', lado: 'E' }, { t: 'Avenida Paulista', lado: 'D' }, { t: 'Pão de Açúcar', lado: 'E' }, { t: 'MASP', lado: 'D' },
      { t: 'Copacabana', lado: 'E' }, { t: 'Parque Ibirapuera', lado: 'D' }, { t: 'Maracanã', lado: 'E' }, { t: 'Mercadão', lado: 'D' },
      { t: 'Escadaria Selarón', lado: 'E' }, { t: 'Beco do Batman', lado: 'D' }
    ]
  },
  {
    titulo: 'Marvel ou DC?',
    esq: { nome: 'Marvel', cor: '#F2545B', sombra: '#B83239', tx: '#FFFFFF', icone: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>' },
    dir: { nome: 'DC', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
    itens: [
      { t: 'Homem de Ferro', lado: 'E' }, { t: 'Batman', lado: 'D' }, { t: 'Thor', lado: 'E' }, { t: 'Mulher-Maravilha', lado: 'D' },
      { t: 'Hulk', lado: 'E' }, { t: 'Super-Homem', lado: 'D' }, { t: 'Capitão América', lado: 'E' }, { t: 'Flash', lado: 'D' },
      { t: 'Pantera Negra', lado: 'E' }, { t: 'Aquaman', lado: 'D' }
    ]
  },
  {
    titulo: 'Gato ou cachorro?',
    esq: { nome: 'Gato', cor: '#A77BF3', sombra: '#7650C2', tx: '#FFFFFF', icone: '<path d="M5 20v-9l-1-7 5 4h6l5-4-1 7v9z"/><circle cx="9.5" cy="13" r=".8"/><circle cx="14.5" cy="13" r=".8"/>' },
    dir: { nome: 'Cachorro', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<path d="M7 9a2.5 2.5 0 1 1 2-4l6 6a2.5 2.5 0 1 1 4 2 2.5 2.5 0 1 1-2 4l-6-6a2.5 2.5 0 1 1-4-2z"/>' },
    itens: [
      { t: 'Persa', lado: 'E' }, { t: 'Poodle', lado: 'D' }, { t: 'Siamês', lado: 'E' }, { t: 'Labrador', lado: 'D' },
      { t: 'Maine Coon', lado: 'E' }, { t: 'Dálmata', lado: 'D' }, { t: 'Sphynx', lado: 'E' }, { t: 'Pug', lado: 'D' },
      { t: 'Angorá', lado: 'E' }, { t: 'Shih-tzu', lado: 'D' }
    ]
  },
  {
    titulo: 'Olimpíadas de verão ou de inverno?',
    esq: { nome: 'Verão', cor: '#F7D046', sombra: '#C9A21C', tx: '#1D2A4D', icone: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    dir: { nome: 'Inverno', cor: '#2EC4B6', sombra: '#1E8F85', tx: '#FFFFFF', icone: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 2 3-2M9 20l3-2 3 2"/>' },
    itens: [
      { t: 'Natação', lado: 'E' }, { t: 'Esqui', lado: 'D' }, { t: 'Vôlei', lado: 'E' }, { t: 'Patinação no gelo', lado: 'D' },
      { t: 'Judô', lado: 'E' }, { t: 'Snowboard', lado: 'D' }, { t: 'Atletismo', lado: 'E' }, { t: 'Curling', lado: 'D' },
      { t: 'Ginástica', lado: 'E' }, { t: 'Hóquei no gelo', lado: 'D' }
    ]
  },
  {
    titulo: 'Rock ou sertanejo?',
    esq: { nome: 'Rock', cor: '#A77BF3', sombra: '#7650C2', tx: '#FFFFFF', icone: '<path d="M14 10l6-6M18 2l4 4"/><path d="M11 9c-2-1-5 0-6 2s-1 4 1 6 4 2 6 1 3-4 2-6l-3-3z"/>' },
    dir: { nome: 'Sertanejo', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<path d="M2 16c3 2 17 2 20 0"/><path d="M6 15c0-5 2-9 6-9s6 4 6 9"/>' },
    itens: [
      { t: 'Legião Urbana', lado: 'E' }, { t: 'Marília Mendonça', lado: 'D' }, { t: 'Titãs', lado: 'E' }, { t: 'Henrique e Juliano', lado: 'D' },
      { t: 'Capital Inicial', lado: 'E' }, { t: 'Gusttavo Lima', lado: 'D' }, { t: 'Paralamas do Sucesso', lado: 'E' }, { t: 'Jorge e Mateus', lado: 'D' },
      { t: 'Raimundos', lado: 'E' }, { t: 'Maiara e Maraisa', lado: 'D' }
    ]
  },
  {
    titulo: 'Planeta ou estrela?',
    esq: { nome: 'Planeta', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>' },
    dir: { nome: 'Estrela', cor: '#F7D046', sombra: '#C9A21C', tx: '#1D2A4D', icone: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z"/>' },
    itens: [
      { t: 'Marte', lado: 'E' }, { t: 'Sol', lado: 'D' }, { t: 'Saturno', lado: 'E' }, { t: 'Sirius', lado: 'D' },
      { t: 'Netuno', lado: 'E' }, { t: 'Betelgeuse', lado: 'D' }, { t: 'Vênus', lado: 'E' }, { t: 'Estrela Polar', lado: 'D' },
      { t: 'Urano', lado: 'E' }, { t: 'Rigel', lado: 'D' }
    ]
  },
  {
    titulo: 'Futebol ou basquete?',
    esq: { nome: 'Futebol', cor: '#6CC24A', sombra: '#43892A', tx: '#FFFFFF', icone: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/>' },
    dir: { nome: 'Basquete', cor: '#F2A33A', sombra: '#B86E14', tx: '#1D2A4D', icone: '<path d="M4 6h16M6 6l2 12h8l2-12M9 6l1 12M15 6l-1 12M7 11h10"/>' },
    itens: [
      { t: 'Pênalti', lado: 'E' }, { t: 'Cesta de três', lado: 'D' }, { t: 'Escanteio', lado: 'E' }, { t: 'Garrafão', lado: 'D' },
      { t: 'Impedimento', lado: 'E' }, { t: 'Enterrada', lado: 'D' }, { t: 'Gol olímpico', lado: 'E' }, { t: 'Toco', lado: 'D' },
      { t: 'Tiro de meta', lado: 'E' }, { t: 'Lance livre', lado: 'D' }
    ]
  },
  {
    titulo: 'Nordeste ou Sul?',
    esq: { nome: 'Nordeste', cor: '#F7D046', sombra: '#C9A21C', tx: '#1D2A4D', icone: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    dir: { nome: 'Sul', cor: '#6CC24A', sombra: '#43892A', tx: '#FFFFFF', icone: '<path d="M12 2l6 8h-3l4 6h-5v6h-4v-6H5l4-6H6z"/>' },
    itens: [
      { t: 'Maceió', lado: 'E' }, { t: 'Gramado', lado: 'D' }, { t: 'João Pessoa', lado: 'E' }, { t: 'Blumenau', lado: 'D' },
      { t: 'Teresina', lado: 'E' }, { t: 'Caxias do Sul', lado: 'D' }, { t: 'Aracaju', lado: 'E' }, { t: 'Joinville', lado: 'D' },
      { t: 'São Luís', lado: 'E' }, { t: 'Pelotas', lado: 'D' }
    ]
  },
  {
    titulo: 'Inglês ou espanhol?',
    esq: { nome: 'Inglês', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<path d="M4 5h16v10H9l-5 4z"/>' },
    dir: { nome: 'Espanhol', cor: '#F2545B', sombra: '#B83239', tx: '#FFFFFF', icone: '<path d="M20 5H4v10h11l5 4z"/>' },
    itens: [
      { t: 'Thank you', lado: 'E' }, { t: 'Gracias', lado: 'D' }, { t: 'Window', lado: 'E' }, { t: 'Ventana', lado: 'D' },
      { t: 'Friday', lado: 'E' }, { t: 'Viernes', lado: 'D' }, { t: 'Kitchen', lado: 'E' }, { t: 'Cocina', lado: 'D' },
      { t: 'Butterfly', lado: 'E' }, { t: 'Mariposa', lado: 'D' }
    ]
  },
  {
    titulo: 'Bicho do mar ou do rio?',
    esq: { nome: 'Mar', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="17" cy="7" r="3"/>' },
    dir: { nome: 'Rio', cor: '#2EC4B6', sombra: '#1E8F85', tx: '#FFFFFF', icone: '<path d="M3 12c3-4 7-5 11-5 3 0 5 2 7 5-2 3-4 5-7 5-4 0-8-1-11-5z"/><path d="M3 12l-1-3M3 12l-1 3"/>' },
    itens: [
      { t: 'Tubarão', lado: 'E' }, { t: 'Piranha', lado: 'D' }, { t: 'Polvo', lado: 'E' }, { t: 'Boto-cor-de-rosa', lado: 'D' },
      { t: 'Água-viva', lado: 'E' }, { t: 'Pirarucu', lado: 'D' }, { t: 'Estrela-do-mar', lado: 'E' }, { t: 'Tambaqui', lado: 'D' },
      { t: 'Cavalo-marinho', lado: 'E' }, { t: 'Lambari', lado: 'D' }
    ]
  },
  {
    titulo: 'Sólido ou líquido?',
    esq: { nome: 'Sólido', cor: '#F6B6B8', sombra: '#D78A8D', tx: '#1D2A4D', icone: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>' },
    dir: { nome: 'Líquido', cor: '#4F8DF7', sombra: '#2F5FB8', tx: '#FFFFFF', icone: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>' },
    itens: [
      { t: 'Ferro', lado: 'E' }, { t: 'Água', lado: 'D' }, { t: 'Sal', lado: 'E' }, { t: 'Azeite', lado: 'D' },
      { t: 'Açúcar', lado: 'E' }, { t: 'Leite', lado: 'D' }, { t: 'Madeira', lado: 'E' }, { t: 'Álcool', lado: 'D' },
      { t: 'Pedra', lado: 'E' }, { t: 'Mel', lado: 'D' }
    ]
  }
];
