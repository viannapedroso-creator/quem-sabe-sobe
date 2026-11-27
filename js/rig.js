/* Quem sabe sobe! · Personagens animados (rig em partes: pernas, braços, tronco e 6 rostos)
 *
 * Uso: QSS.boneco(char, nome, classe) devolve um <svg class="rig"> que entra no lugar da <img>.
 * A expressão e o movimento vêm do atributo data-acao do próprio svg:
 *   parado · contente · pronto · pensando · feliz · comemora · vibra · triste · assustado (leva poder) · perdido · correr · subir
 * Um laço só anima todos os bonecos que estiverem na tela.
 */
(function () {
  const Q = window.QSS;
  const NS = 'http://www.w3.org/2000/svg';
  const D = window.QSS_RIG_DADOS || {};
  const FACES = ['neutra', 'feliz', 'triste', 'pensando', 'perdido', 'assustado'];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);

  function viewBox(char) {
    const d = D[char]; if (!d) return null;
    const h = d.height + 6, w = h * (d.asp || 0.62);
    return { x: -w / 2, y: -h, w, h };
  }

  // HTML de um boneco (svg vazio; o laço monta as partes quando ele aparece na página)
  Q.boneco = function (char, nome, classe, acao, estilo) {
    const vb = viewBox(char);
    if (!vb) return `<img class="${classe || ''}" src="${Q.img(char)}" alt="${Q.esc(nome || '')}">`;
    return `<svg class="rig ${classe || ''}" data-rig="${char}" data-acao="${acao || 'parado'}" viewBox="${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}" style="aspect-ratio:${(vb.w / vb.h).toFixed(4)};overflow:visible;${estilo || ''}" role="img" aria-label="${Q.esc(nome || '')}"></svg>`;
  };
  // Muda a ação de um boneco (ou de todos dentro de um elemento)
  Q.acao = function (el, acao) {
    if (!el) return;
    const lista = el.matches && el.matches('svg.rig') ? [el] : el.querySelectorAll ? el.querySelectorAll('svg.rig') : [];
    lista.forEach((s) => { if (s.dataset.acao !== acao) s.dataset.acao = acao; });
  };

  // Troca o HTML de um elemento reaproveitando os bonecos que já estavam lá (sem piscar nem reiniciar)
  Q.trocarHTML = function (alvo, html) {
    const velhos = {};
    alvo.querySelectorAll('svg.rig').forEach((v) => { velhos[v.dataset.rig] = v; });
    alvo.innerHTML = html;
    alvo.querySelectorAll('svg.rig').forEach((n) => {
      const v = velhos[n.dataset.rig]; if (!v) return;
      if (v.dataset.acao !== n.dataset.acao) v.dataset.acao = n.dataset.acao;
      v.setAttribute('class', n.getAttribute('class')); v.style.cssText = n.style.cssText;
      n.replaceWith(v); delete velhos[n.dataset.rig];
    });
  };

  function el(tag, at) { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; }
  function montar(svg) {
    const d = D[svg.dataset.rig]; svg.__rig = { ok: false };
    if (!d) return;
    const inner = el('g', {}), L = {};
    svg.append(inner);
    for (const ly of d.layers) {
      const g = el('g', {});
      if (ly.id === 'head') {
        const F = {};
        for (const n of FACES) {
          const f = ly.faces[n]; if (!f) continue;
          const im = el('image', { href: f.f, width: f.w, height: f.h, x: (f.x - ly.px).toFixed(1), y: (f.y - ly.py).toFixed(1) });
          if (n !== 'neutra') im.style.display = 'none';
          g.append(im); F[n] = im;
        }
        L.faces = F;
        if (ly.over) { const o = ly.over; g.append(el('image', { href: o.f, width: o.w, height: o.h, x: (o.x - ly.px).toFixed(1), y: (o.y - ly.py).toFixed(1) })); }
      } else {
        g.append(el('image', { href: ly.f, width: ly.w, height: ly.h, x: (ly.x - (ly.px || 0)).toFixed(1), y: (ly.y - (ly.py || 0)).toFixed(1) }));
      }
      inner.append(g);
      L[ly.id] = { g, px: ly.px || 0, py: ly.py || 0, r0: ly.r0 || 0 };
    }
    svg.__rig = { ok: true, inner, L, face: 'neutra', acao: null, t0: 0, fase: Math.random() * 6, key: svg.dataset.rig };
  }

  // Pose de cada ação em função do tempo (e = segundos desde que a ação começou)
  function pose(acao, e, t) {
    const q = { dx: 0, arc: 0, sx: 1, sy: 1 + Math.sin(t * 2.2) * 0.008, legL: 0, legR: 0, liftL: 0, liftR: 0, armL: 1.5 + Math.sin(t * 2.2) * 1.5, armR: 1.5 + Math.sin(t * 2.2) * 1.5, head: 0, headY: 0, face: 'neutra' };
    q.head = Math.sin(t * 0.9) * 1.5;
    switch (acao) {
      case 'pronto': { // acabou de responder / marcou pronto: um pulinho e fica contente
        q.face = 'feliz';
        if (e < 0.5) { const j = Math.sin(Math.PI * e / 0.5); q.arc = 40 * j; q.armL = q.armR = 6 + 40 * j; }
        break;
      }
      case 'contente': { q.face = 'feliz'; q.armL = q.armR = 6 + Math.sin(t * 2.2) * 3; break; }
      case 'comemora': { q.face = 'feliz'; const w = Math.sin(e * 9); q.armL = 120 + 14 * w; q.armR = 120 - 14 * w; break; }
      case 'feliz': { q.face = 'feliz'; const j = Math.abs(Math.sin(e * Math.PI * 2)); q.arc = j * 36; q.armL = q.armR = 60 + 40 * j; break; }
      case 'vibra': {
        q.face = 'feliz'; const j = Math.abs(Math.sin(e * Math.PI * 1.4));
        q.arc = j * 100; if (j < 0.12) { q.sy = 0.94; q.sx = 1.04; }
        q.armL = q.armR = 125 + 14 * Math.sin(e * 9); if (q.arc > 12) q.liftL = q.liftR = 10;
        break;
      }
      case 'triste': { q.face = 'triste'; const k = ease(clamp(e / 0.4)); q.head = 7 * k; q.headY = 8 * k; q.sy = 1 - 0.03 * k; q.armL = q.armR = -3 * k; break; }
      case 'pensando': { q.face = 'pensando'; q.head = -7 + Math.sin(e * 2.5) * 2; q.armR = 18 + Math.sin(e * 3) * 4; q.dx = Math.sin(e * 1.6) * 9; break; }
      case 'assustado': {
        if (e < 0.8) { q.face = 'assustado'; const k = 1 - e / 0.8; q.dx = Math.sin(e * 70) * 24 * k; q.armL = q.armR = 45 + Math.sin(e * 40) * 15; q.sy = 1 - 0.05 * k; q.head = Math.sin(e * 35) * 6 * k; }
        else { q.face = 'perdido'; q.head = Math.sin(e * 7) * 8; q.armL = q.armR = 22; }
        break;
      }
      case 'perdido': {
        q.face = 'perdido'; q.head = Math.sin(e * 3.2) * 10; q.armL = q.armR = 24 + Math.sin(e * 3.2) * 6;
        q.dx = Math.sin(e * 1.6) * 15; q.liftL = Math.max(0, Math.sin(e * 4)) * 5; q.liftR = Math.max(0, -Math.sin(e * 4)) * 5;
        break;
      }
      case 'correr': {
        q.face = 'feliz'; const c = Math.sin(e * 16);
        q.liftL = Math.max(0, c) * 16; q.liftR = Math.max(0, -c) * 16; q.legL = c * 7; q.legR = c * 7;
        q.armL = 12 + 28 * c; q.armR = 12 - 28 * c; q.arc = Math.abs(c) * 15;
        break;
      }
      case 'subir': { // um salto de degrau (repete enquanto a ação durar)
        q.face = 'feliz'; const v = (e % 0.6) / 0.6, s = Math.sin(Math.PI * v);
        q.arc = 0; q.sy = 1 + 0.07 * s; q.sx = 1 - 0.03 * s; q.armL = q.armR = 70; q.liftL = q.liftR = 10 * s;
        break;
      }
    }
    return q;
  }

  function rot(L, r, dy) { if (L) L.g.setAttribute('transform', `translate(${L.px},${(L.py - (dy || 0)).toFixed(1)}) rotate(${(r + L.r0).toFixed(1)})`); }

  function quadro(ms) {
    const t = ms / 1000;
    const lista = document.querySelectorAll('svg.rig');
    for (const svg of lista) {
      if (!svg.__rig) montar(svg);
      const R = svg.__rig; if (!R.ok) continue;
      if (!svg.isConnected || !svg.getClientRects().length) continue; // escondido: não gasta
      const acao = svg.dataset.acao || 'parado';
      if (acao !== R.acao) { R.acao = acao; R.t0 = t; }
      const q = pose(acao, t - R.t0, t + R.fase);
      if (q.face !== R.face && R.L.faces[q.face]) { R.L.faces[R.face].style.display = 'none'; R.L.faces[q.face].style.display = ''; R.face = q.face; }
      R.inner.setAttribute('transform', `translate(${q.dx.toFixed(1)},${(-q.arc).toFixed(1)}) scale(${q.sx.toFixed(3)},${q.sy.toFixed(3)})`);
      rot(R.L.legL, q.legL, q.liftL); rot(R.L.legR, q.legR, q.liftR);
      rot(R.L.armL, q.armL); rot(R.L.armR, -q.armR);
      const hf = R.key === 'coxinha' ? 0.3 : 1, H = R.L.head;
      if (H) H.g.setAttribute('transform', `translate(${H.px},${(H.py + q.headY * hf).toFixed(1)}) rotate(${(q.head * hf).toFixed(1)})`);
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
})();
