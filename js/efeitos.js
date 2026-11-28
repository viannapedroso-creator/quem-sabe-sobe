// Celular: monta os 4 botões de resposta e aplica os efeitos dos poderes (quadro "Efeito no celular").
// Os efeitos se somam: dá para ter Gosma + Gelo + Bombas ao mesmo tempo.
// "forte" = o mesmo poder veio de 2 ou mais jogadores.
(function () {
  const Q = window.QSS;
  const TRINCAS = ['', 'M100 8 L92 40 L108 55 L98 86', 'M100 8 L92 40 L108 55 L98 86 M92 40 L58 30 M108 55 L150 64', 'M100 8 L92 40 L108 55 L98 86 M92 40 L58 30 M108 55 L150 64 M58 30 L26 52 M150 64 L184 30 M98 86 L70 70'];
  const MORD = [[[22, 30, 13], [58, 62, 12], [84, 20, 11]], [[12, 70, 12], [44, 24, 13], [70, 60, 12], [92, 34, 10]], [[18, 26, 12], [50, 68, 13], [80, 30, 12]], [[30, 64, 13], [66, 22, 12]]];
  const MORD_FORTE = [[38, 50, 12], [74, 80, 11], [6, 36, 12]];
  const BOMBAS5 = [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]];
  const BOMBAS8 = [[14, 25], [36, 25], [64, 25], [86, 25], [14, 75], [36, 75], [64, 75], [86, 75]];
  const NS = 'http://www.w3.org/2000/svg';

  function criar(o) {
    const dir = o.dir, ops = o.ops || [], fx = {};
    (o.efeitos || []).forEach((e) => { fx[e.poder] = e; });
    const tem = (k) => !!fx[k], forte = (k) => !!(fx[k] && fx[k].forte);
    const ctl = new AbortController(), sig = { signal: ctl.signal };
    let sel = null, travadoAte = 0, parado = false, raf = 0;
    const timers = [];
    let ordem = [0, 1, 2, 3];
    const abs = tem('redemoinho');
    const slotDe = (k) => ordem[k];

    dir.innerHTML = `<div id="opsCel" class="${abs ? 'abs' : ''}"></div><span id="enviado" class="oculto">Resposta enviada!</span>`;
    const grade = dir.querySelector('#opsCel'), pill = dir.querySelector('#enviado');
    dir.style.touchAction = Object.keys(fx).length ? 'none' : '';

    // ---- Botões ----
    const ENC = tem('encolhe') ? (forte('encolhe') ? 5 : 7) : 0;
    let zoom = 1;
    const geloPrecisa = forte('gelo') ? 5 : 3, gelo = [0, 0, 0, 0];
    grade.innerHTML = ops.map((t, k) => {
      const a = Q.ALTS[k];
      const mord = tem('cupins') ? MORD[k].concat(forte('cupins') ? MORD_FORTE : []).map((m) => `<i class="mord" style="left:${m[0]}%;top:${m[1]}%;width:${m[2]}px;height:${m[2]}px;background:${a.cor}"></i>`).join('') : '';
      const g = tem('gelo') ? `<span class="gelo"><svg viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true"><path d="" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/><path d="" stroke="#7FA9E6" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg><em>Toque ${geloPrecisa}x</em></span>` : '';
      return `<button type="button" class="oc2" data-op="${k}" style="background:${a.cor};box-shadow:0 6px 0 ${a.sh};color:${a.tx}">
        <span class="fm">${Q.forma(k, 22)}</span><span class="tx"><span class="in">${Q.esc(t)}${mord}</span></span>${g}</button>`;
    }).join('');
    const botoes = [...grade.children];
    function posicionar() {
      if (!abs) return;
      botoes.forEach((b, k) => { const sl = slotDe(k); b.style.left = sl % 2 ? 'calc(50% + 7px)' : '0'; b.style.top = sl > 1 ? 'calc(50% + 7px)' : '0'; });
    }
    posicionar();
    function tamanhoTexto() {
      botoes.forEach((b) => {
        const tx = b.querySelector('.tx');
        if (ENC) { tx.style.fontSize = (ENC * zoom).toFixed(1) + 'px'; tx.style.whiteSpace = 'nowrap'; }
        else Q.caber(tx, 44, 15);
      });
    }
    requestAnimationFrame(tamanhoTexto);

    function sacudir(px, ms) { o.sacudir && o.sacudir(px); timers.push(setTimeout(() => o.sacudir && o.sacudir(0), ms || 110)); }

    // ---- Gosma: um pedaço de gosma em cima de cada resposta; esfregar abre buracos em cada pedaço ----
    // Gosma em dobro: cada parte precisa de 2 passadas. A 1ª deixa a gosma 80% transparente, a 2ª limpa.
    const GW = 220, GH = 120, FUROS_LIMPO = 9, RAIO = 26;
    const pedacos = [];
    function formaGosma(k) {
      // contorno ondulado próprio de cada pedaço, com 2 ou 3 pingos escorrendo por baixo
      let sem = 7 + k * 13; const rnd = () => { sem = (sem * 9301 + 49297) % 233280; return sem / 233280; };
      const ond = (n) => (rnd() - 0.5) * n;
      let d = `M${8 + ond(6)} ${10 + ond(6)}`;
      for (let x = 40; x <= GW - 30; x += 36) d += ` Q${x - 18} ${ond(10) - 4} ${x} ${6 + ond(8)}`;
      d += ` Q${GW + 2} ${ond(6)} ${GW - 4} ${30 + ond(8)}`;
      d += ` Q${GW + 4 + ond(4)} ${GH / 2} ${GW - 3} ${GH - 22 + ond(6)}`;
      const pingos = [0.78, 0.47, 0.2].slice(0, 2 + (k % 2)).map((f) => GW * f + ond(18));
      let xAtual = GW - 6;
      pingos.forEach((px) => {
        const w = 9 + rnd() * 6, fundo = GH + 4 + rnd() * 16;
        d += ` Q${(xAtual + px + w) / 2} ${GH - 6 + ond(6)} ${px + w} ${GH - 8}`;
        d += ` C${px + w} ${fundo - 6} ${px + w * 0.5} ${fundo} ${px} ${fundo} C${px - w * 0.5} ${fundo} ${px - w} ${fundo - 6} ${px - w} ${GH - 8}`;
        xAtual = px - w;
      });
      d += ` Q${xAtual / 2} ${GH - 4 + ond(6)} 6 ${GH - 20 + ond(6)}`;
      d += ` Q${-4 + ond(4)} ${GH / 2} ${8 + ond(4)} ${10 + ond(6)} Z`;
      return d;
    }
    if (tem('gosma')) {
      const camadas = forte('gosma') ? 2 : 1;
      botoes.forEach((b, k) => {
        const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'gosmaPeca');
        svg.setAttribute('viewBox', `0 0 ${GW} ${GH + 24}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
        const id = 'm' + k + Math.random().toString(36).slice(2, 7);
        svg.innerHTML = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9B6BE8"/><stop offset=".6" stop-color="#7E4FD6"/><stop offset="1" stop-color="#5E34B0"/></linearGradient>
          <mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${GW + 40}" height="${GH + 64}"><rect x="-20" y="-20" width="${GW + 40}" height="${GH + 64}" fill="#fff"/><g class="cinza"></g><g class="preto"></g></mask>
          <filter id="${id}v" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/><feSpecularLighting in="b" surfaceScale="5" specularConstant=".9" specularExponent="26" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="50"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3=".7"/></filter></defs>
          <g mask="url(#${id})" filter="url(#${id}v)"><path d="${formaGosma(k)}" fill="url(#${id}g)" opacity=".97"/>
          <path d="M${26 + k * 6} 26 C70 16 120 36 ${170 - k * 5} 22" stroke="#E6D4FF" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>
          <circle cx="${160 - k * 22}" cy="${70 + (k % 2) * 12}" r="6" fill="#E6D4FF" opacity=".55"/><circle cx="${174 - k * 22}" cy="${84 + (k % 2) * 12}" r="3.5" fill="#E6D4FF" opacity=".45"/></g>`;
        b.appendChild(svg);
        pedacos[k] = { svg, mascara: svg.querySelector('mask'), furos: [], celulas: {} };
      });
      let passada = 0;
      const esfrega = (e) => {
        if (e.type === 'pointerdown') passada++;
        if (e.type === 'pointermove' && e.pointerType === 'mouse' && e.buttons === 0) return;
        pedacos.forEach((p) => {
          const r = p.svg.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width * GW, y = (e.clientY - r.top) / r.height * (GH + 24);
          if (x < -RAIO || x > GW + RAIO || y < -RAIO || y > GH + 24 + RAIO) return;
          const ch = Math.floor(x / 22) + ',' + Math.floor(y / 20), cel = p.celulas[ch] || (p.celulas[ch] = { n: 0, ultima: -1 });
          if (cel.ultima !== passada) { cel.ultima = passada; cel.n++; }
          const nivel = Math.min(camadas, cel.n);
          const u = p.furos[p.furos.length - 1]; if (u && u.nivel === nivel && Math.hypot(u.x - x, u.y - y) < 10) return;
          p.furos.push({ x, y, nivel }); if (p.furos.length > 400) p.furos.shift();
          const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x.toFixed(0)); c.setAttribute('cy', y.toFixed(0)); c.setAttribute('r', RAIO);
          const limpa = nivel >= camadas;
          c.setAttribute('fill', limpa ? '#000' : '#333'); // #333 na máscara = 20% visível (80% transparente)
          p.mascara.querySelector(limpa ? '.preto' : '.cinza').appendChild(c);
        });
      };
      dir.addEventListener('pointerdown', esfrega, sig); dir.addEventListener('pointermove', esfrega, sig);
    }
    const limpo = (k) => {
      if (!tem('gosma')) return true;
      const camadas = forte('gosma') ? 2 : 1;
      return pedacos[k].furos.filter((f) => f.nivel >= camadas).length >= FUROS_LIMPO;
    };

    // ---- Bombas ----
    let bombas = [], trav = null;
    if (tem('bombas')) {
      bombas = (forte('bombas') ? BOMBAS8 : BOMBAS5).map((p, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'bomba'; b.setAttribute('aria-label', 'Bomba');
        b.innerHTML = `<img src="${Q.imgPoder('bombas')}" alt="">`;
        b.addEventListener('click', (e) => {
          e.stopPropagation(); b.remove(); bombas[i] = null;
          travadoAte = Date.now() + 800; Q.sfx('sfx_bum'); try { navigator.vibrate && navigator.vibrate(200); } catch (er) {}
          trav.style.background = `radial-gradient(circle at ${b.style.left} ${b.style.top},rgba(255,240,180,.95),rgba(242,163,58,.75) 30%,rgba(29,42,77,.55) 70%)`;
          trav.classList.remove('oculto');
          let n = 0; const s = setInterval(() => { n++; o.sacudir && o.sacudir(n % 2 ? 9 : -9); if (n > 8) { clearInterval(s); o.sacudir && o.sacudir(0); } }, 45); timers.push(s);
          timers.push(setTimeout(() => trav.classList.add('oculto'), 800));
        }, sig);
        dir.appendChild(b);
        return b;
      });
      trav = document.createElement('div'); trav.id = 'travado'; trav.className = 'oculto'; trav.innerHTML = '<span>BUM! Travado!</span>';
      dir.appendChild(trav);
    }

    // ---- Cupins ----
    const cupins = [];
    if (tem('cupins')) {
      for (let i = 0; i < (forte('cupins') ? 2 : 1); i++) {
        const c = document.createElement('img'); c.id = i ? '' : 'cupim'; c.className = 'cupim-x'; c.src = Q.imgPoder('cupins'); c.alt = '';
        c.style.cssText = 'position:absolute;width:86px;height:86px;margin:-43px 0 0 -43px;z-index:4;pointer-events:none';
        dir.appendChild(c); cupins.push(c);
      }
    }

    // ---- Redemoinho: troca de lugar ----
    if (abs) {
      const iv = setInterval(() => {
        if (sel !== null) return;
        const nova = ordem.slice(); for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nova[i], nova[j]] = [nova[j], nova[i]]; }
        ordem = nova; posicionar();
        botoes.forEach((b) => { b.style.transform = 'rotate(6deg)'; });
        timers.push(setTimeout(() => botoes.forEach((b) => { b.style.transform = ''; }), 350));
      }, forte('redemoinho') ? 1000 : 1500);
      timers.push(iv);
    }

    // ---- Encolhe: pinça com dois dedos ou rodinha do mouse ----
    let chip = null;
    if (ENC) {
      chip = document.createElement('span'); chip.id = 'zoomChip'; chip.textContent = 'zoom 1.0x'; dir.appendChild(chip);
      const max = forte('encolhe') ? 6 : 4.2, dedos = {}; let d0 = 0, z0 = 1;
      const dist = () => { const p = Object.values(dedos); return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
      const aplica = (z) => { zoom = Math.max(1, Math.min(max, z)); chip.textContent = 'zoom ' + zoom.toFixed(1) + 'x'; tamanhoTexto(); };
      dir.addEventListener('pointerdown', (e) => { dedos[e.pointerId] = { x: e.clientX, y: e.clientY }; d0 = dist(); z0 = zoom; }, sig);
      dir.addEventListener('pointermove', (e) => { if (!dedos[e.pointerId]) return; dedos[e.pointerId] = { x: e.clientX, y: e.clientY }; const n = dist(); if (d0 && n) aplica(z0 * n / d0); }, sig);
      const solta = (e) => { delete dedos[e.pointerId]; d0 = 0; };
      dir.addEventListener('pointerup', solta, sig); dir.addEventListener('pointercancel', solta, sig);
      dir.addEventListener('wheel', (e) => { e.preventDefault(); aplica(zoom - e.deltaY * 0.003); }, { signal: ctl.signal, passive: false });
    }

    // ---- Toque nas respostas ----
    function pintarGelo(k) {
      const b = botoes[k], g = b.querySelector('.gelo'); if (!g) return;
      const h = gelo[k];
      if (h >= geloPrecisa) { g.remove(); return; }
      const idx = h === 0 ? 0 : Math.min(3, Math.ceil(h / geloPrecisa * 3));
      g.querySelectorAll('path').forEach((pa) => pa.setAttribute('d', TRINCAS[idx]));
      g.querySelector('em').textContent = h === 0 ? `Toque ${geloPrecisa}x` : `Mais ${geloPrecisa - h}x`;
    }
    grade.addEventListener('click', (e) => {
      const b = e.target.closest('.oc2'); if (!b || sel !== null) return;
      const k = +b.dataset.op;
      if (Date.now() < travadoAte) return;
      if (!limpo(k)) { Q.sfx('sfx_gosma'); sacudir(5, 110); return; }
      if (tem('gelo') && gelo[k] < geloPrecisa) { gelo[k]++; Q.sfx('sfx_gelo'); pintarGelo(k); sacudir(3, 90); return; }
      escolhido(k); o.aoEscolher(k);
    }, sig);

    function escolhido(k) {
      sel = k;
      botoes.forEach((b, i) => { b.classList.toggle('sel', i === k); b.classList.toggle('outra', i !== k); b.disabled = true; });
      pill.classList.remove('oculto');
    }

    // ---- Animação (bombas flutuando, cupins andando) ----
    const t0 = performance.now();
    if (bombas.length || cupins.length) {
      (function anima(agora) {
        if (parado) return;
        const t = (agora - t0) / 1000;
        const base = forte('bombas') ? BOMBAS8 : BOMBAS5;
        bombas.forEach((b, i) => {
          if (!b) return; const a = i * 2.399, p = base[i];
          b.style.left = (p[0] + 6 * Math.sin(t * 2.25 * (0.6 + i * 0.07) + a)).toFixed(1) + '%';
          b.style.top = (p[1] + 8 * Math.sin(t * 2.25 * (0.9 + i * 0.05) + a * 1.3)).toFixed(1) + '%';
          b.style.transform = `rotate(${(Math.sin(t * 2 + i) * 12).toFixed(0)}deg)`;
        });
        cupins.forEach((c, i) => {
          const tt = t + i * 3.7;
          c.style.left = (50 + 44 * Math.sin(tt * 0.45)).toFixed(1) + '%'; c.style.top = (50 + 40 * Math.sin(tt * 0.8)).toFixed(1) + '%';
          c.style.transform = `scaleX(${Math.cos(tt * 0.45) > 0 ? 1 : -1}) rotate(${(Math.sin(tt * 6) * 6).toFixed(0)}deg)`;
        });
        raf = requestAnimationFrame(anima);
      })(t0);
    }

    return {
      escolhido,
      destruir() { parado = true; cancelAnimationFrame(raf); timers.forEach((x) => { clearTimeout(x); clearInterval(x); }); ctl.abort(); o.sacudir && o.sacudir(0); }
    };
  }

  // Texto da caixa escura: quem jogou o quê e o que fazer
  function dica(efeitos) {
    if (!efeitos || !efeitos.length) return '';
    const ics = efeitos.map((e) => `<img src="${Q.imgPoder(e.poder)}" alt="">`).join('');
    const quem = efeitos.map((e) => {
      if (e.degrau) return `<b>Degrau ${e.degrau}: ${Q.poder(e.poder).nome}!</b>`;
      const pw = Q.poder(e.poder), nomes = e.de.length > 1 ? e.de.slice(0, -1).join(', ') + ' e ' + e.de[e.de.length - 1] : e.de[0];
      return `<b>${Q.esc(nomes)} ${e.de.length > 1 ? 'te jogaram' : 'te jogou'} ${pw.nome}${e.forte ? ' (em dobro)' : ''}!</b>`;
    }).join('<br>');
    const como = efeitos.map((e) => { const pw = Q.poder(e.poder); return e.forte && pw.dicaForte ? pw.dicaForte : pw.dica; }).join(' ');
    return `<span class="ics">${ics}</span><span class="t">${quem}<br>${como}</span>`;
  }

  window.QSS_EFEITOS = { criar, dica };
})();
