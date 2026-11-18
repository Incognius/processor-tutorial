(function () {
  'use strict';
  /* decorative marks drawn after the reference theme (no star) */
  const D = {
    dots3: '<svg viewBox="0 0 86 22"><circle cx="11" cy="11" r="9"/><circle cx="43" cy="11" r="9"/><circle cx="75" cy="11" r="9"/></svg>',
    vdots: '<svg viewBox="0 0 22 86"><circle cx="11" cy="11" r="9"/><circle cx="11" cy="43" r="9"/><circle cx="11" cy="75" r="9"/></svg>',
    plus3: '<svg viewBox="0 0 30 110"><path class="o" d="M11 2h8v9h9v8h-9v9h-8v-9H2v-8h9z"/><path d="M11 41h8v9h9v8h-9v9h-8v-9H2v-8h9z"/><path class="o" d="M11 80h8v9h9v8h-9v9h-8v-9H2v-8h9z"/></svg>',
    arcs: '<svg viewBox="0 0 120 120"><path class="o" d="M10 120a110 110 0 0 1 110-110"/><path class="o" d="M28 120a92 92 0 0 1 92-92"/><path class="o" d="M46 120a74 74 0 0 1 74-74"/><path class="o" d="M64 120a56 56 0 0 1 56-56"/><path class="o" d="M82 120a38 38 0 0 1 38-38"/></svg>',
    zig: '<svg viewBox="0 0 120 40"><path class="o" d="M2 10l10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8"/><path class="o" d="M2 24l10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8"/><path class="o" d="M2 38l10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8"/></svg>',
    grid: '<svg viewBox="0 0 150 46">' + Array.from({ length: 30 }, (_, i) => `<circle cx="${6 + (i % 10) * 15.4}" cy="${6 + Math.floor(i / 10) * 17}" r="2.6"/>`).join('') + '</svg>',
    arches: '<svg viewBox="0 0 90 120"><path class="o" d="M6 120V45a39 39 0 0 1 78 0v75"/><path class="o" d="M20 120V48a25 25 0 0 1 50 0v72"/><path class="o" d="M34 120V52a11 11 0 0 1 22 0v68"/></svg>',
    half: '<svg viewBox="0 0 120 200"><path d="M4 64a56 56 0 0 1 112 0z"/><path class="o" d="M30 76v124M48 76v124"/></svg>',
    tri3: '<svg viewBox="0 0 96 26"><path d="M2 1l22 12L2 25z"/><path d="M34 1l22 12-22 12z"/><path d="M66 1l22 12-22 12z"/></svg>',
    diam: '<svg viewBox="0 0 24 90"><path class="o" d="M12 2l10 12-10 12L2 14z"/><path class="o" d="M12 32l10 12-10 12L2 44z"/><path class="o" d="M12 62l10 12-10 12L2 74z"/></svg>',
    ring: '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" class="o"/><circle cx="60" cy="60" r="44" class="o"/><circle cx="60" cy="60" r="32" class="o"/><circle cx="60" cy="60" r="20" class="o"/><circle cx="60" cy="60" r="8"/></svg>',
    halftone: '<svg viewBox="0 0 220 60">' + Array.from({ length: 110 }, (_, i) => { const c = i % 22, r = Math.floor(i / 22); const rad = Math.max(0.4, 3.4 - c * 0.14 - r * 0.1); return `<circle cx="${5 + c * 10}" cy="${6 + r * 12}" r="${rad.toFixed(2)}"/>`; }).join('') + '</svg>',
  };
  document.querySelectorAll('i[data-d]').forEach(i => { i.classList.add('dec'); i.innerHTML = D[i.dataset.d] || ''; });

  /* signal chips written as plain text: <span class="sgs">EPC, LMR, IPC</span> */
  document.querySelectorAll('.sgs').forEach(e => {
    e.innerHTML = e.textContent.split(/\s*,\s*/).map(t => `<span class="sg">${window.SimUI.sub(t.trim())}</span>`).join('');
  });

  const deck = document.getElementById('deck');
  const slides = [...deck.querySelectorAll('.slide')];
  let sec = '';
  slides.forEach((s, i) => {
    if (s.dataset.sec) sec = s.dataset.sec;
    if (!s.classList.contains('nofoot')) {
      const f = document.createElement('div'); f.className = 'foot';
      f.innerHTML = `<span>${sec}</span><span>${String(i + 1).padStart(2, '0')}</span>`;
      s.appendChild(f);
    }
  });

  window.W.init(document);
  const sims = [];
  document.querySelectorAll('.simbox').forEach(el => sims.push(new window.SimUI.Sim(el)));

  document.querySelectorAll('.reveal').forEach(r => {
    const b = document.createElement('button'); b.className = 'rv-btn'; b.textContent = r.dataset.label || 'Reveal answer';
    r.parentNode.insertBefore(b, r);
    b.addEventListener('click', () => { r.classList.add('shown'); b.remove(); });
  });

  /* question paper overlay: data-q="a.png,b.png" on a slide; P toggles, Esc closes */
  const ov = document.createElement('div'); ov.id = 'paper-ov'; deck.appendChild(ov);
  function openPaper(q) {
    ov.innerHTML = '<div class="pv-hint">Question paper · click or Esc to close</div>' + q.split(',').map(src => `<img src="${src}" alt="question paper">`).join('');
    ov.classList.add('on'); ov.scrollTop = 0;
  }
  const closePaper = () => ov.classList.remove('on');
  ov.addEventListener('click', closePaper);
  slides.forEach(s => {
    if (!s.dataset.q) return;
    if (s.classList.contains('qp')) { s.querySelectorAll('.paper').forEach(p => p.addEventListener('click', () => openPaper(s.dataset.q))); return; }
    const b = document.createElement('button'); b.className = 'qp-chip'; b.textContent = 'Question paper · P';
    b.addEventListener('click', () => openPaper(s.dataset.q)); s.appendChild(b);
  });

  slides.forEach((s, i) => s.querySelectorAll('.qp-go').forEach(a => {
    const to = i + (+a.dataset.go);
    const run = slides[to] && /^Run it/.test((slides[to].querySelector('.kick') || {}).textContent || '');
    a.textContent = (run ? 'Run · slide ' : 'Answer · slide ') + (to + 1);
    a.addEventListener('click', e => { e.stopPropagation(); show(to); });
  }));

  let cur = 0;
  const bar = document.getElementById('prog');
  function show(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    closePaper();
    slides[cur].classList.remove('on');
    cur = i; slides[cur].classList.add('on');
    bar.style.width = ((cur + 1) / slides.length * 100) + '%';
    history.replaceState(null, '', '#' + (cur + 1));
    sims.forEach(s => s.stop && s.stop());
    const s = slides[cur].querySelector('.simbox'); if (s && s._sim) s._sim.drawArrow();
  }
  sims.forEach(s => { s.el._sim = s; });
  function fit() {
    const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    deck.style.transform = `scale(${k})`;
  }
  window.addEventListener('resize', fit); fit();
  let typed = '';
  document.addEventListener('keydown', e => {
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const sim = slides[cur].querySelector('.simbox');
    const k = e.key;
    if (/^\d$/.test(k)) { typed += k; return; }
    if (k === 'Enter' && typed) { show(+typed - 1); typed = ''; return; }
    typed = '';
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && t !== 'BUTTON')) { e.preventDefault(); show(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); show(cur - 1); }
    else if (k === 'Home') show(0);
    else if (k === 'End') show(slides.length - 1);
    else if (k === 'Escape') closePaper();
    else if ((k === 'p' || k === 'P') && slides[cur].dataset.q) { ov.classList.contains('on') ? closePaper() : openPaper(slides[cur].dataset.q); }
    else if (k === 'f') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (sim && sim._sim) {
      if (k === 'c') sim._sim.act('micro'); else if (k === 'b') sim._sim.act('back'); else if (k === 'i') sim._sim.act('instr'); else if (k === 'r') sim._sim.act('reset');
    }
  });
  window.deckShow = n => show(n - 1);

  /* QR code to the hosted copy: set by tools/publish.py through #deck[data-url]; Q shows it full screen */
  const url = deck.dataset.url;
  const qov = document.createElement('div'); qov.id = 'qr-ov';
  if (url) {
    const short = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    document.querySelectorAll('.qr-card').forEach(c => { c.hidden = false; c.querySelector('.qr-url').innerHTML = short.replace('/', '/<wbr>'); });
    qov.innerHTML = `<div><img src="assets/qr.svg" alt="QR code"><b>Scan to follow along</b><span>${short}</span></div>`;
    qov.addEventListener('click', () => qov.classList.remove('on')); deck.appendChild(qov);
  }
  document.addEventListener('keydown', e => {
    if (!url || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'q' || e.key === 'Q') qov.classList.toggle('on'); else if (e.key === 'Escape') qov.classList.remove('on');
  });

  /* phones: swipe, on-screen arrows, rotate hint */
  const nav = document.createElement('div'); nav.id = 'tnav';
  nav.innerHTML = '<button data-d="-1" aria-label="Previous slide">‹</button><button data-d="1" aria-label="Next slide">›</button>';
  nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { b.blur(); show(cur + (+b.dataset.d)); } });
  document.body.appendChild(nav);
  const rot = document.createElement('div'); rot.id = 'rothint';
  rot.innerHTML = '<div>Turn your phone sideways for a bigger view<br><small>tap to dismiss · swipe to change slides</small></div>';
  rot.addEventListener('click', () => rot.remove()); document.body.appendChild(rot);
  let tx = null, ty = 0, tt = 0;
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('textarea, .sim-pane, .sim-mem, #paper-ov')) { tx = null; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - tt < 800) show(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  const h = parseInt(location.hash.slice(1), 10);
  slides[0].classList.add('on');
  show(isNaN(h) ? 0 : h - 1);
})();
