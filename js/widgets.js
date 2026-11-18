/* Smaller interactive pieces used across the deck */
(function () {
  'use strict';
  const { decode, micro, FETCH, FL, alu, pop8 } = window.SP8;
  const sub = window.SimUI.sub;
  const hx = v => v.toString(16).toUpperCase().padStart(2, '0');
  const bin = (v, n = 8) => v.toString(2).padStart(n, '0');
  const W = {};

  /* ---------- timing diagram renderer ----------
     spec: {cycles, labels?, cw?, rows:[{n, clk}|{n, on:[cycles]}|{n, bus:{cyc:label}}|{n, reg:[v0, v1...]} (value after each falling edge; null = unchanged)]} */
  function svgSig(n) {
    return n.split(' ').map(t => /^[ELIDRS][A-Z]{2,4}$/.test(t) ? `${t[0]}<tspan class="sb" dy="4">${t.slice(1)}</tspan><tspan dy="-4"> </tspan>` : t + ' ').join('');
  }
  function timing(spec) {
    const n = spec.cycles, cw = spec.cw || 150, lw = spec.lw || 92, rh = spec.rh || 32, top = 26;
    const Wd = lw + n * cw + 20, H = top + spec.rows.length * rh + 6;
    let s = `<svg class="tim" viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}">`;
    for (let c = 0; c <= n; c++) {
      const x = lw + c * cw;
      s += `<line class="edge" x1="${x}" y1="${top - 6}" x2="${x}" y2="${H}"/>`;
      if (c < n) {
        s += `<line class="fall" x1="${x + cw / 2}" y1="${top}" x2="${x + cw / 2}" y2="${H}"/>`;
        s += `<text class="ck" x="${x + cw / 2}" y="14" text-anchor="middle">${spec.labels ? spec.labels[c] : 'Ck ' + (c + 1)}</text>`;
      }
    }
    spec.rows.forEach((r, i) => {
      const y0 = top + i * rh + 6, y1 = y0 + rh - 12, ym = (y0 + y1) / 2;
      s += `<text class="rn" x="8" y="${ym + 5}">${svgSig(r.n)}</text>`;
      if (r.clk) {
        let p = `M${lw} ${y1}`;
        for (let c = 0; c < n; c++) { const x = lw + c * cw; p += ` L${x} ${y0} L${x + cw / 2} ${y0} L${x + cw / 2} ${y1} L${x + cw} ${y1}`; }
        s += `<path class="w" d="${p}"/>`;
      } else if (r.on) {
        let p = `M${lw} ${y1}`; const d = 6;
        for (let c = 0; c < n; c++) {
          const x = lw + c * cw, on = r.on.includes(c + 1), prev = r.on.includes(c), y = on ? y0 : y1;
          p += ` L${x + d} ${prev ? y0 : y1} L${x + d} ${y}`;
          p += ` L${x + cw} ${y}`;
        }
        s += `<path class="w${r.hl ? ' hl' : ''}" d="${p}"/>`;
      } else if (r.bus) {
        for (let c = 0; c < n; c++) {
          const x = lw + c * cw, lab = r.bus[c + 1];
          if (lab === undefined) s += `<line class="z" x1="${x}" y1="${ym}" x2="${x + cw}" y2="${ym}"/>`;
          else {
            const a = x + 10, b = x + cw - 2, k = 6;
            s += `<line class="z" x1="${x}" y1="${ym}" x2="${a}" y2="${ym}"/><path class="w hx" d="M${a} ${ym} L${a + k} ${y0} L${b - k} ${y0} L${b} ${ym} L${b - k} ${y1} L${a + k} ${y1} Z"/>`;
            s += `<text class="tv" x="${(a + b) / 2}" y="${ym + 5}" text-anchor="middle">${lab}</text>`;
          }
        }
      } else if (r.reg) {
        const segs = []; let cur = r.reg[0], st = lw;
        for (let c = 0; c < n; c++) { const v = r.reg[c + 1]; if (v !== null && v !== undefined && v !== cur) { segs.push([st, lw + c * cw + cw / 2, cur]); cur = v; st = lw + c * cw + cw / 2; } }
        segs.push([st, lw + n * cw, cur]);
        segs.forEach(([a, b, v], j) => {
          const k = j === 0 ? 0 : 5, k2 = j === segs.length - 1 ? 0 : 5;
          s += `<path class="w hx" d="M${a} ${ym} L${a + k} ${y0} L${b - k2} ${y0} L${b} ${ym} L${b - k2} ${y1} L${a + k} ${y1} Z"/>`;
          s += `<text class="tv" x="${(a + b) / 2}" y="${ym + 5}" text-anchor="middle">${v}</text>`;
        });
      }
    });
    return s + '</svg>';
  }
  W.timing = timing;

  const SPECS = {
    fetch2010: { cycles: 2, cw: 260, rows: [
      { n: 'CLK', clk: 1 }, { n: 'EPC', on: [1] }, { n: 'RD (ERD)', on: [2] }, { n: 'LMR', on: [1] }, { n: 'LIR', on: [2] },
      { n: 'IPC', on: [1] }, { n: 'LMS', on: [2] }, { n: 'BUS', bus: { 1: '100 (from PC)', 2: '05 (from memory)' } },
      { n: 'MAR', reg: ['?', '100', null] }, { n: 'PC', reg: ['100', '101', null] }, { n: 'IR', reg: ['?', null, '05'] }] },
    add4: { cycles: 4, cw: 196, rows: [
      { n: 'CLK', clk: 1 }, { n: 'EPC LMR IPC', on: [1] }, { n: 'RD LIR LMS', on: [2] }, { n: 'ERG LOR', on: [3] },
      { n: 'SRG = 4', on: [3] }, { n: 'EAR LAR', on: [4] }, { n: 'SALU = ADD', on: [4] }, { n: 'End', on: [4] },
      { n: 'BUS', bus: { 1: '[PC]', 2: '14h', 3: '[R4]', 4: '[AR]' } }, { n: 'OR', reg: ['?', null, null, '[R4]', null] },
      { n: 'AR', reg: ['[AR]', null, null, null, '[AR]+[R4]'] }] },
    eaLb: { cycles: 1, cw: 420, labels: ['Ck i'], rows: [
      { n: 'CLK', clk: 1 }, { n: 'EA', on: [1] }, { n: 'LB', on: [1] }, { n: 'others', on: [] },
      { n: 'VAL A', reg: ['VAL A'] }, { n: 'BUS', bus: { 1: 'VAL A (after the rising edge)' } }, { n: 'VAL B', reg: ['VAL B', 'VAL A'] }] },
  };
  W.spec = SPECS;

  /* ---------- multipurpose register playground ---------- */
  function regPlay(el) {
    const st = { val: 0b10110010, hist: [] };
    el.innerHTML = `<div class="rp">
      <div class="rp-l">
        <div class="rp-bits"></div>
        <div class="rp-row"><label>IN lines</label><input class="rp-in" value="3C" maxlength="2"> <span class="mut">hex</span></div>
        <div class="rp-acts">${['none', 'LD', 'INC', 'DEC', 'SHL', 'SHR', 'ROL', 'ROR', 'RESET'].map(a => `<button data-a="${a}"${a === 'none' ? ' class="on"' : ''}>${a}</button>`).join('')}</div>
        <div class="rp-row"><button class="tg" data-en="1">EN = 0</button><button class="bk">◂ Back</button><button class="go">Clock ▸</button><button class="clr ghost">Clear</button></div>
        <div class="rp-msg"></div>
      </div>
      <div class="rp-w"></div></div>`;
    let act = 'none', en = 0;
    const bits = el.querySelector('.rp-bits');
    const draw = (out) => {
      bits.innerHTML = '<div class="rp-cap">VAL (inside)</div>' + bin(st.val).split('').map((b, i) => `<span class="${b === '1' ? 'b1' : ''}"><i>B${7 - i}</i>${b}</span>`).join('') +
        `<div class="rp-out">OUT lines: <b>${out === undefined ? (en ? hx(st.val) : 'Z  (floating)') : out}</b></div>`;
      const h = st.hist.slice(-6); const n = Math.max(h.length, 1);
      el.querySelector('.rp-w').innerHTML = h.length ? timing({ cycles: h.length, cw: 92, lw: 70, rh: 30, labels: h.map((_, i) => '#' + (st.hist.length - h.length + i + 1)), rows: [
        { n: 'CLK', clk: 1 }, { n: 'EN', on: h.map((x, i) => x.en ? i + 1 : 0) }, { n: 'action', bus: Object.fromEntries(h.map((x, i) => [i + 1, x.a]).filter(x => x[1] !== 'none')) },
        { n: 'OUT', bus: Object.fromEntries(h.map((x, i) => [i + 1, hx(x.before)]).filter((x, i) => h[i].en)) },
        { n: 'VAL', reg: [hx(h[0].before)].concat(h.map(x => hx(x.after))) }] }) : '<div class="mut" style="padding:30px">The waveform appears here as you clock the register.</div>';
    };
    el.querySelector('.rp-acts').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; act = b.dataset.a; el.querySelectorAll('.rp-acts button').forEach(x => x.classList.toggle('on', x === b)); b.blur(); });
    el.querySelector('.tg').addEventListener('click', e => { en = 1 - en; e.target.textContent = 'EN = ' + en; e.target.classList.toggle('on', !!en); e.target.blur(); draw(); });
    el.querySelector('.clr').addEventListener('click', e => { st.hist = []; e.target.blur(); draw(); });
    el.querySelector('.bk').addEventListener('click', e => {
      e.target.blur(); const h = st.hist.pop(); if (!h) return;
      st.val = h.before;
      el.querySelector('.rp-msg').innerHTML = `Back one clock: VAL is ${hx(h.before)} again (that clock did ${h.a === 'none' ? 'nothing' : h.a}).`;
      draw();
    });
    el.querySelector('.go').addEventListener('click', e => {
      e.target.blur();
      const before = st.val; const inv = parseInt(el.querySelector('.rp-in').value, 16) & 255 || 0; let v = before;
      switch (act) {
        case 'LD': v = inv; break; case 'INC': v = (v + 1) & 255; break; case 'DEC': v = (v - 1) & 255; break;
        case 'SHL': v = (v << 1) & 255; break; case 'SHR': v = v >> 1; break;
        case 'ROL': v = ((v << 1) | (v >> 7)) & 255; break; case 'ROR': v = ((v >> 1) | ((v & 1) << 7)) & 255; break;
        case 'RESET': v = 0; break;
      }
      st.val = v; st.hist.push({ en, a: act, before, after: v });
      el.querySelector('.rp-msg').innerHTML = `Rising edge: OUT ${en ? 'shows the <b>old</b> value ' + hx(before) : 'stays floating'}. Falling edge: ${act === 'none' ? 'nothing to do, VAL kept' : act + ' applied, VAL ' + hx(before) + ' → ' + hx(v)}.`;
      draw(en ? hx(before) : undefined);
    });
    draw();
  }

  /* ---------- bus lab (Fig 3.4 configuration) ---------- */
  function busLab(el) {
    const init = { A: 3, B: 10, C: 0, D: 7, OR: 0, AR: 0 };
    let R = Object.assign({}, init), ck = 10, log = [];
    const regs = ['A', 'B', 'C', 'D'];
    const sigs = {};
    const card = n => `<div class="bl-r" data-r="${n}"><div class="bl-n">${n}</div><div class="bl-v">00</div>
        <div class="bl-c"><button data-s="E${n}">E</button><button data-s="L${n}">L</button><button data-s="I${n}">I</button></div></div>`;
    el.innerHTML = `<div class="bl">
      <div class="bl-col">${card('A')}${card('B')}</div>
      <div class="bl-bus"><span>BUS</span><b class="bl-bv">Z</b></div>
      <div class="bl-col">${card('C')}${card('D')}</div>
      <div class="bl-alu">
        <div class="bl-r sm" data-r="OR"><div class="bl-n">OR</div><div class="bl-v">00</div><div class="bl-c"><button data-s="LOR">L</button><button data-s="EOR">E→ALU</button></div></div>
        <div class="bl-alu-b"><span>ALU</span><select class="bl-op"><option>ADD</option><option>SUB</option><option>AND</option><option>PASS0</option></select></div>
        <div class="bl-r sm" data-r="AR"><div class="bl-n">AR</div><div class="bl-v">00</div><div class="bl-c"><button data-s="EAR">E</button><button data-s="LAR">L</button></div></div>
      </div>
      <div class="bl-side">
        <div class="bl-pre"><div class="mut">Try a preset</div>
          <button data-p="EA LB">B ← A</button><button data-p="LB ED LC LA">D → A, B, C</button><button data-p="EB LA IB">E<sub>B</sub> L<sub>A</sub> I<sub>B</sub></button><button data-p="EA EB LC">two enables</button>
          <button data-seq="sub">C ← B − A (3 clocks)</button><button data-seq="and">D ← C ∧ D (3 clocks)</button></div>
        <div class="bl-act"><button class="bk">◂ Back</button><button class="go">Clock ▸</button><button class="rs ghost">Reset values</button></div>
        <div class="bl-msg"></div><div class="bl-log"></div>
      </div></div>`;
    const seqs = {
      sub: [['EA LOR', 'ADD'], ['EB EOR LAR', 'SUB'], ['EAR LC', null]],
      and: [['EC LOR', 'ADD'], ['ED EOR LAR', 'AND'], ['EAR LD', null]],
    };
    let queue = [], back = [];
    const paint = () => {
      regs.concat(['OR', 'AR']).forEach(n => { el.querySelector(`[data-r="${n}"] .bl-v`).textContent = R[n]; });
      el.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', !!sigs[b.dataset.s]));
    };
    const setSigs = (str, op) => { Object.keys(sigs).forEach(k => delete sigs[k]); str.split(/\s+/).forEach(s => sigs[s] = 1); if (op) el.querySelector('.bl-op').value = op; paint(); };
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; b.blur();
      if (b.dataset.s) { sigs[b.dataset.s] = !sigs[b.dataset.s]; queue = []; paint(); return; }
      if (b.dataset.p) { queue = []; setSigs(b.dataset.p); return; }
      if (b.dataset.seq) { queue = seqs[b.dataset.seq].slice(); const [s, op] = queue.shift(); setSigs(s, op); el.querySelector('.bl-msg').innerHTML = 'Signals for the first clock are set. Press Clock; the next clock’s signals load automatically.'; return; }
      if (b.classList.contains('bk')) {
        const h = back.pop(); if (!h) return;
        R = h.R; ck = h.ck; log = h.log; queue = h.queue; Object.keys(sigs).forEach(k => delete sigs[k]); Object.assign(sigs, h.sigs);
        el.querySelector('.bl-op').value = h.op; el.querySelector('.bl-msg').innerHTML = h.msg; el.querySelector('.bl-bv').textContent = h.bv;
        el.querySelector('.bl-bus').className = h.busCls; el.querySelector('.bl-log').innerHTML = log.slice(-5).map(l => `<div>${l}</div>`).join('');
        paint(); return;
      }
      if (b.classList.contains('rs')) { R = Object.assign({}, init); ck = 10; log = []; queue = []; back = []; setSigs(''); el.querySelector('.bl-log').innerHTML = ''; el.querySelector('.bl-msg').textContent = ''; el.querySelector('.bl-bv').textContent = 'Z'; el.querySelector('.bl-bus').classList.remove('on', 'bad'); return; }
      if (b.classList.contains('go')) {
        back.push({ R: Object.assign({}, R), ck, log: log.slice(), queue: queue.slice(), sigs: Object.assign({}, sigs), op: el.querySelector('.bl-op').value,
          msg: el.querySelector('.bl-msg').innerHTML, bv: el.querySelector('.bl-bv').textContent, busCls: el.querySelector('.bl-bus').className });
        const on = Object.keys(sigs).filter(k => sigs[k]);
        const drv = regs.filter(n => sigs['E' + n]).concat(sigs.EAR ? ['AR'] : []);
        const busEl = el.querySelector('.bl-bus'); busEl.classList.remove('on', 'bad');
        let msg = '';
        if (drv.length > 1) {
          busEl.classList.add('bad'); el.querySelector('.bl-bv').textContent = '✕';
          msg = `<b>Bus conflict.</b> ${drv.join(' and ')} both drive the bus. The tristate rule (at most one enable) is broken, so nothing is loaded.`;
        } else {
          const bus = drv.length ? R[drv[0]] : null;
          el.querySelector('.bl-bv').textContent = bus === null ? 'Z' : bus; if (bus !== null) busEl.classList.add('on');
          const op = el.querySelector('.bl-op').value; const old = Object.assign({}, R);
          const aluOut = sigs.EOR || op === 'PASS0' ? alu(op, bus || 0, old.OR).r : null;
          const ch = [];
          regs.forEach(n => { if (sigs['L' + n] && bus !== null) { R[n] = bus; ch.push(`${n} ← ${bus}`); } });
          regs.forEach(n => { if (sigs['I' + n]) { R[n] = (old[n] + 1) & 255; ch.push(`${n} ← ${old[n]} + 1`); } });
          if (sigs.LOR && bus !== null) { R.OR = bus; ch.push(`OR ← ${bus}`); }
          if (sigs.LAR) { if (aluOut !== null) { R.AR = aluOut; ch.push(`AR ← ALU ${op} = ${aluOut}`); } else ch.push('AR load ignored (ALU right input not enabled)'); }
          msg = (bus === null ? 'No enable: bus floats. ' : `Bus carries ${bus} from ${drv[0]}. `) + (ch.length ? 'Falling edge: ' + ch.join(', ') + '.' : 'Nothing loads.');
          if (sigs.IB && sigs.EB && sigs.LA) msg += ' A got the <b>old</b> B: the increment lands at the same falling edge, after the bus value was sampled.';
        }
        log.push(`Ck ${ck++}: ${on.map(sub).join(', ') || '—'}${sigs.LAR ? ' · S<sub>ALU</sub>=' + el.querySelector('.bl-op').value : ''}`);
        el.querySelector('.bl-log').innerHTML = log.slice(-5).map(l => `<div>${l}</div>`).join('');
        el.querySelector('.bl-msg').innerHTML = msg;
        if (queue.length) { const [s, op] = queue.shift(); setSigs(s, op); } else { paint(); }
      }
    });
    paint();
  }

  /* ---------- ROM as a truth table: 7 × x ---------- */
  function rom7(el) {
    let a = 3;
    const draw = () => {
      let t = '<table class="rt"><tr><th>A2 A1 A0</th><th>x</th><th>D5 … D0</th><th>7x</th></tr>';
      for (let i = 0; i < 8; i++) t += `<tr class="${i === a ? 'on' : ''}" data-i="${i}"><td>${bin(i, 3).split('').join(' ')}</td><td>${i}</td><td>${bin(7 * i, 6)}</td><td>${7 * i}</td></tr>`;
      t += '</table>';
      el.innerHTML = `<div class="r7"><div class="r7-in">${[2, 1, 0].map(k => `<button data-b="${k}" class="${(a >> k) & 1 ? 'on' : ''}">A${k}<b>${(a >> k) & 1}</b></button>`).join('')}<div class="mut">address lines (click)</div></div>${t}
        <div class="r7-out">${bin(7 * a, 6).split('').map((b, i) => `<span class="${b === '1' ? 'b1' : ''}"><i>D${5 - i}</i>${b}</span>`).join('')}<div class="mut">output word = ${7 * a}</div></div></div>`;
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-b]'); const r = e.target.closest('tr[data-i]'); if (b) a ^= 1 << +b.dataset.b; else if (r) a = +r.dataset.i; else return; draw(); });
    draw();
  }

  /* ---------- opcode map ---------- */
  function clocksOf(d) { const n = micro(d).length; return 2 + n; }
  function opmap(el) {
    const grp = d => ({ nop: 'g0', stop: 'g0', imm: 'g1', ret: 'g5', alu: 'g2', movs: 'g3', movd: 'g3', movi: 'g3', stor: 'g3', load: 'g3', push: 'g4', pop: 'g4', jmpd: 'g5', jmpr: 'g5', cd: 'g5', cr: 'g5' }[d.g]);
    let h = '<div class="om"><div class="om-g"><div></div>' + [...Array(16).keys()].map(i => `<div class="om-h">${i.toString(16).toUpperCase()}</div>`).join('');
    for (let r = 0; r < 16; r++) {
      h += `<div class="om-h">${r.toString(16).toUpperCase()}</div>`;
      for (let c = 0; c < 16; c++) {
        const b = r * 16 + c, d = decode(b);
        const bad = d.r !== undefined && d.r > 11;
        h += `<div class="om-c ${grp(d)}${bad ? ' bad' : ''}" data-b="${b}">${bad ? '' : d.mn.replace(/ r\d+/, '').replace(/^(jmpd|jmpr|cd|cr|ret)(\w+)$/, '$1<i>$2</i>')}</div>`;
      }
    }
    h += '</div><div class="om-p"></div></div>';
    el.innerHTML = h;
    const P = el.querySelector('.om-p');
    const show = b => {
      const d = decode(b); const bad = d.r !== undefined && d.r > 11;
      el.querySelectorAll('.om-c').forEach(c => c.classList.toggle('sel', +c.dataset.b === b));
      const steps = micro(d);
      P.innerHTML = `<div class="om-big">${hx(b)}<small>h</small></div>
        <div class="om-bin"><span>${bin(b >> 4, 4)}</span><span>${bin(b & 15, 4)}</span></div>
        <div class="om-bl"><span>upper nibble: ${{ 0: 'misc / immediate / ret', 14: 'jump', 15: 'call' }[b >> 4] || 'operation'}</span><span>lower nibble: ${d.r !== undefined ? 'register R' + d.r : d.fl !== undefined ? (b >= 0xE0 ? (b & 8 ? 'bit 3 = 1 (no address word), ' : 'bit 3 = 0 (address word follows), ') : '') + 'flag ' + FL[d.fl] : 'picks the variant'}</span></div>
        <div class="om-mn">${bad ? '<s>' + d.mn + '</s> <small>no such register</small>' : d.mn + (d.len === 2 ? ' <em>xx</em>' : '')}</div>
        <div class="om-k">${d.len} word${d.len > 1 ? 's' : ''} · ${clocksOf(d)} clocks${d.fl !== undefined ? ' if taken, 3 if not' : ''}</div>
        <div class="om-mc">${FETCH.concat(steps).map((s, i) => `<div><b>Ck ${i + 1}</b>${s.sig.map(sub).join(', ')}</div>`).join('')}</div>`;
    };
    el.addEventListener('click', e => { const c = e.target.closest('.om-c'); if (c) show(+c.dataset.b); });
    el.addEventListener('mouseover', e => { const c = e.target.closest('.om-c'); if (c && e.buttons === 0 && el.dataset.hover) show(+c.dataset.b); });
    show(+(el.dataset.start || 0x27));
  }

  /* ---------- flag calculator ---------- */
  function flagCalc(el) {
    el.innerHTML = `<div class="fc"><div class="fc-in">
      <label>AR <input class="fa" value="${el.dataset.a || '5'}"></label>
      <select class="fo"><option>SUB</option><option>ADD</option><option>CMP</option><option>AND</option><option>OR</option><option>XOR</option></select>
      <label>operand <input class="fb" value="${el.dataset.b || '9'}"></label><span class="mut">decimal or 0x..</span></div><div class="fc-out"></div></div>`;
    const P = v => /^0x/i.test(v) ? parseInt(v, 16) & 255 : (+v) & 255;
    const go = () => {
      const a = P(el.querySelector('.fa').value), b = P(el.querySelector('.fb').value), op = el.querySelector('.fo').value;
      const R = alu(op, a, b), r = R.r, arith = R.arith, ones = pop8(r);
      const row = (f, v, why, live = true) => `<div class="fr${v ? ' set' : ''}${live ? '' : ' dim'}"><b>${f}</b><span>${live ? v : '–'}</span><em>${why}</em></div>`;
      el.querySelector('.fc-out').innerHTML = `
        <div class="fc-sum"><code>${bin(a)}</code><code>${{ ADD: '+', SUB: '−', CMP: '−', AND: '∧', OR: '∨', XOR: '⊕' }[op]} ${bin(b)}</code><code class="res">${bin(r)}</code>
        <div class="mut">${a} ${op} ${b} → ${r}${op === 'CMP' ? ' (AR is NOT written)' : ''}</div></div>
        <div class="fc-fl">${row('Z', r === 0 ? 1 : 0, r === 0 ? 'result is exactly 0' : 'result is not 0')}
        ${row('C', R.c, arith ? (op === 'ADD' ? (R.c ? 'carry out of bit 7' : 'no carry out of bit 7') : (R.c ? 'borrow: AR < operand' : 'no borrow: AR ≥ operand')) : 'logic op: C keeps its old value', arith)}
        ${row('S', (r >> 7) & 1, arith ? 'copy of bit 7 of the result' : 'logic op: S keeps its old value', arith)}
        ${row('P', ones & 1, `${ones} one${ones === 1 ? '' : 's'} in the result → ${ones & 1 ? 'odd' : 'even'}`)}</div>`;
    };
    el.addEventListener('input', go); el.addEventListener('change', go); go();
  }

  /* ---------- microcode table from the simulator's own microcode ---------- */
  const REP = { 'add <R>': 0x10, 'sub <R>': 0x20, 'xor <R>': 0x30, 'and <R>': 0x40, 'or <R>': 0x50, 'cmp <R>': 0x60, 'nop': 0,
    'movs <R>': 0x70, 'movd <R>': 0x80, 'load <R>': 0xB0, 'stor <R>': 0xA0, 'movi <R> xx': 0x90, 'adi xx': 1, 'sbi xx': 2, 'xri xx': 3, 'ani xx': 4, 'ori xx': 5, 'cmi xx': 6,
    'jmpd<FL> xx': 0xE0, 'jmpr<FL>': 0xE8, 'cd<FL> xx': 0xF0, 'cr<FL>': 0xF8, 'ret<FL>': 0x08, 'push <R>': 0xC0, 'pop <R>': 0xD0, 'stop': 7, 'fetch': -1 };
  function mctable(el) {
    const keys = el.dataset.ins.split('|');
    let h = '<table class="mc"><thead><tr><th>Instruction</th><th>Ck</th><th>Control signals</th><th>Select</th></tr></thead><tbody>';
    keys.forEach((k, ki) => {
      const steps = k === 'fetch' ? FETCH : micro(decode(REP[k]));
      steps.forEach((s, i) => {
        const sel = [];
        if (s.rg !== undefined) sel.push('S<sub>RG</sub> ← ⟨R⟩');
        if (s.alu) sel.push('S<sub>ALU</sub> ← ' + s.alu);
        if (s.fl !== undefined) sel.push('S<sub>FL</sub> ← ⟨FL⟩');
        h += `<tr class="${i === 0 ? 'first' : ''}${ki % 2 ? ' alt' : ''}">${i === 0 ? `<td rowspan="${steps.length}" class="in">${k.replace(/</g, '&lt;').replace(/&lt;(R|FL)>/g, '⟨$1⟩')}</td>` : ''}<td class="ck">${k === 'fetch' ? i + 1 : i + 3}</td><td class="sg">${s.sig.filter(x => x !== 'StopClock' || true).map(sub).join(', ')}</td><td class="se">${sel.join(', ') || '–'}</td></tr>`;
      });
    });
    el.innerHTML = h + '</tbody></table>';
  }

  /* ---------- clock-count chart ---------- */
  function clocks(el) {
    const rows = [['nop', 0], ['stop', 7], ['movs / movd', 0x70], ['add … cmp ⟨R⟩', 0x10], ['load / stor', 0xB0], ['movi ⟨R⟩ xx', 0x90], ['pop', 0xD0], ['push', 0xC0], ['adi … cmi xx', 1],
      ['jmpd / jmpr', 0xE0], ['ret', 0x08], ['cd / cr', 0xF0]];
    let h = '<div class="cc">';
    rows.forEach(([n, b]) => {
      const d = decode(b), ex = micro(d).length, cond = d.fl !== undefined;
      h += `<div class="cc-r"><span class="cc-n">${n}</span><span class="cc-b">${'<i class="f"></i>'.repeat(2)}${'<i class="e"></i>'.repeat(ex)}</span><span class="cc-t">${2 + ex}${cond ? '<small> taken · 3 not</small>' : ''}</span></div>`;
    });
    el.innerHTML = h + '<div class="cc-k"><span><i class="f"></i> fetch (Ck 1–2)</span><span><i class="e"></i> execute (Ck 3+)</span></div></div>';
  }

  W.init = function (root) {
    const map = { reg: regPlay, bus: busLab, rom7, opmap, flags: flagCalc, mctable, clocks };
    root.querySelectorAll('[data-w]').forEach(el => {
      const k = el.dataset.w;
      if (k === 'timing') el.innerHTML = timing(SPECS[el.dataset.spec]);
      else if (map[k]) map[k](el);
    });
  };
  window.W = W;
})();
