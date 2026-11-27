// Coruja apresentadora animada (rig da etapa de animação: pés, corpo, asas, microfone e 8 rostos).
// Uso: QSS_CORUJA.montar(elemento) troca o conteúdo do elemento pela Coruja viva.
// QSS_CORUJA.falar(promessa) mexe a boca e a asa com o microfone enquanto a fala dura.
// QSS_CORUJA.reagir('feliz' | 'rindo' | 'pensando' | 'assustado' | 'triste').
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const B = (window.QSS_BASE || '') + 'img/coruja/';
  const RIG = {
    layers: [
      { id: 'legL', f: 'legL.png', w: 85, h: 105, x: -90.8, y: -104.8, px: -48.2, py: -88.8, r0: 0 },
      { id: 'legR', f: 'legR.png', w: 85, h: 104, x: 5.2, y: -104.4, px: 47.8, py: -88.4, r0: 0 },
      { id: 'armL', f: 'armL.png', w: 123, h: 204, x: -186.3, y: -252.9, px: -124.0, py: -236.8, r0: 2 },
      { id: 'armR', f: 'armR.png', w: 124, h: 204, x: 66.9, y: -251.9, px: 124.0, py: -236.8, r0: -2 },
      { id: 'torso', f: 'torso.png', w: 294, h: 231, x: -145.2, y: -306.0, px: 0, py: 0, r0: 0 },
      { id: 'head', px: 0.0, py: -296.8, faces: {
        neutra: { w: 200, h: 220, x: -100, y: -492.4 }, feliz: { w: 200, h: 220, x: -100, y: -492.8 }, assustado: { w: 200, h: 220, x: -100, y: -492.8 },
        pensando: { w: 200, h: 225, x: -100, y: -497.7 }, rindo: { w: 200, h: 223, x: -100, y: -495.5 }, triste: { w: 200, h: 222, x: -100, y: -495.0 },
        fala1: { w: 200, h: 222, x: -100, y: -495.0 }, fala2: { w: 200, h: 221, x: -100, y: -494.0 } } }
    ],
    mic: { w: 41, h: 107 }
  };
  const ROSTOS = ['neutra', 'feliz', 'assustado', 'pensando', 'rindo', 'triste', 'fala1', 'fala2'];
  const DUR = { feliz: 1.8, rindo: 2.4, pensando: 2.6, assustado: 1.6, triste: 2.2 };
  const clamp = (v) => Math.max(0, Math.min(1, v)), lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a || {}) e.setAttribute(k, a[k]); return e; };

  const todas = [];
  let act = null, now = 0;

  function montar(host) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: '-205 -505 410 515', 'aria-label': 'Coruja apresentadora', role: 'img' });
    svg.style.cssText = 'width:100%;height:100%;overflow:visible;display:block';
    const g = el('g'), inner = el('g'), L = {};
    g.append(el('ellipse', { cx: 0, cy: 4, rx: 120, ry: 14, fill: '#1D2A4D', opacity: 0.18 }), inner);
    for (const ly of RIG.layers) {
      const lg = el('g');
      if (ly.id === 'head') {
        const F = {};
        for (const n of ROSTOS) {
          const f = ly.faces[n];
          const im = el('image', { href: B + 'cabeca_' + n + '.png?v=3', width: f.w, height: f.h, x: (f.x - ly.px).toFixed(1), y: (f.y - ly.py).toFixed(1) });
          im.style.display = n === 'neutra' ? '' : 'none'; lg.append(im); F[n] = im;
        }
        L.faces = F;
      } else lg.append(el('image', { href: B + ly.f, width: ly.w, height: ly.h, x: (ly.x - ly.px).toFixed(1), y: (ly.y - ly.py).toFixed(1) }));
      inner.append(lg);
      L[ly.id] = { g: lg, px: ly.px, py: ly.py, r0: ly.r0 || 0, w: ly.w, h: ly.h, ox: (ly.x || 0) - ly.px, oy: (ly.y || 0) - ly.py };
    }
    const a = L.armL, tip = [a.ox + a.w * 0.58, a.oy + a.h * 0.80];
    const mic = el('g'); mic.append(el('image', { href: B + 'mic.png', width: RIG.mic.w, height: RIG.mic.h, x: -RIG.mic.w / 2, y: -RIG.mic.h * 0.55 })); inner.append(mic);
    svg.append(g); host.append(svg);
    const o = { host, inner, L, mic, tip, face: 'neutra', front: false, fase: Math.random() * 3 };
    todas.push(o);
    return o;
  }

  function setRot(Lr, rot, dy) { Lr.g.setAttribute('transform', `translate(${Lr.px},${(Lr.py - (dy || 0)).toFixed(1)}) rotate(${(rot + Lr.r0).toFixed(1)})`); }

  function desenhar(o) {
    const t = now + o.fase, a = act; let e = a ? now - a.t0 : 0;
    const q = { face: 'neutra', wl: 2 + Math.sin(t * 2) * 2, wr: 2 + Math.sin(t * 2 + 1) * 2, head: Math.sin(t * 1.3) * 2, bob: Math.sin(t * 2.2) * 3, sy: 1 + Math.sin(t * 2.2) * 0.01, front: false };
    if (a) {
      const ty = a.type;
      if (ty === 'talk') {
        const k = clamp(e / 0.25) * clamp((a.dur - e) / 0.25);
        q.wl = lerp(2, -112, ease(k)); q.front = k > 0.05;
        const ph = Math.floor(e * 9);
        q.face = k < 0.6 ? 'neutra' : ['fala1', 'fala2', 'neutra', 'fala2', 'fala1', 'fala2'][ph % 6];
        q.wr = 8 + Math.sin(e * 5) * 14; q.head = Math.sin(e * 4) * 3;
      } else {
        q.face = ty;
        if (ty === 'feliz') { q.wr = 70 + Math.sin(e * 10) * 25; q.bob += Math.abs(Math.sin(e * 7)) * -8; }
        if (ty === 'rindo') { q.bob += Math.abs(Math.sin(e * 9)) * -10; q.wl = 40 + Math.sin(e * 9) * 10; q.wr = 40 + Math.sin(e * 9) * 10; q.head = Math.sin(e * 9) * 4; }
        if (ty === 'pensando') { q.wr = 25; q.head = -6 + Math.sin(e * 2) * 2; }
        if (ty === 'assustado') { const k = Math.max(0, 1 - e / 0.6); q.bob -= 18 * k; q.wl = q.wr = 55; q.head = Math.sin(e * 30) * 4 * k; }
        if (ty === 'triste') { q.head = 8; q.wl = q.wr = -4; q.sy = 0.97; }
      }
    }
    if (q.face !== o.face) { o.L.faces[o.face].style.display = 'none'; o.L.faces[q.face].style.display = ''; o.face = q.face; }
    if (q.front !== o.front) { o.front = q.front; if (q.front) { o.inner.append(o.L.armL.g); o.inner.append(o.mic); } else { o.L.torso.g.before(o.L.armL.g); o.inner.append(o.mic); } }
    o.inner.setAttribute('transform', `translate(0,${q.bob.toFixed(1)}) scale(1,${q.sy.toFixed(3)})`);
    setRot(o.L.armL, q.wl); setRot(o.L.armR, -q.wr); setRot(o.L.legL, 0); setRot(o.L.legR, 0);
    o.L.head.g.setAttribute('transform', `translate(${o.L.head.px},${o.L.head.py}) rotate(${q.head.toFixed(1)})`);
    const al = o.L.armL, th = (q.wl + al.r0) * Math.PI / 180, [tx, ty] = o.tip;
    const mx = al.px + tx * Math.cos(th) - ty * Math.sin(th), my = al.py + tx * Math.sin(th) + ty * Math.cos(th);
    o.mic.setAttribute('transform', `translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${(q.wl * 0.95 + 150).toFixed(1)})`);
  }

  let ultimo = performance.now();
  function loop(ts) {
    now += Math.min(0.05, (ts - ultimo) / 1000); ultimo = ts;
    if (act && act.type !== 'talk' && now - act.t0 > act.dur) act = null;
    if (act && act.type === 'talk' && now - act.t0 > act.dur) act = null;
    // só desenha as Corujas que estão na tela
    todas.forEach((o) => { if (o.host.offsetParent) desenhar(o); });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Fala: a boca mexe enquanto a promessa da voz não termina
  function falar(promessa) {
    act = { type: 'talk', t0: now, dur: 60 };
    const inicio = act;
    Promise.resolve(promessa).then(() => { if (act === inicio) act.dur = Math.min(act.dur, now - act.t0 + 0.3); });
  }
  function reagir(tipo, dur) { act = { type: tipo, t0: now, dur: dur || DUR[tipo] || 2 }; }

  window.QSS_CORUJA = { montar, falar, reagir };
})();
