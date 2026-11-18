/* Visual front-end for SP8.Machine: datapath drawing + program listing + memory/stack + trace */
(function () {
  'use strict';
  const { Machine, assemble, FLTEST, ROMORDER, ROMROWS } = window.SP8;
  const NS = 'http://www.w3.org/2000/svg';
  const CW = ['EPC', 'IPC', 'LPC', 'ESP', 'ISP', 'DSP', 'LMR', 'RD', 'WR', 'LIR',
    'LMS', 'LOR', 'EOR', 'EAR', 'LAR', 'ERG', 'LRG', 'EFL', 'End', 'Stop'];

  function sub(t) {
    if (t === 'End?') return 'End if ⟨FL⟩′';
    if (t === 'StopClock') return 'StopClock';
    if (t === 'RD' || t === 'WR' || t === 'End' || t === 'Stop') return t;
    return t[0] + '<sub>' + t.slice(1) + '</sub>';
  }
  window.sigHTML = sub;

  function datapathSVG() {
    const box = (id, x, y, w, h, label) =>
      `<g class="bx" id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>` +
      `<text class="lb" x="${x + 9}" y="${y + 15}">${label}</text>` +
      `<text class="vl" x="${x + w - 10}" y="${y + h - 11}" text-anchor="end">00</text></g>`;
    const link = (id, x1, y1, x2, y2) => `<line class="lk" id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    let rg = '';
    for (let i = 0; i < 12; i++) {
      const c = i % 4, r = Math.floor(i / 4), x = 300 + c * 51, y = 300 + r * 42;
      rg += `<g class="rc" id="r${i}"><rect x="${x}" y="${y}" width="46" height="36" rx="3"/>` +
        `<text class="rn" x="${x + 5}" y="${y + 12}">R${i}</text><text class="rv" x="${x + 41}" y="${y + 30}" text-anchor="end">00</text></g>`;
    }
    let cw = '';
    CW.forEach((s, i) => {
      const c = i % 10, r = Math.floor(i / 10), x = 20 + c * 48.4, y = 480 + r * 30;
      cw += `<g class="cw" id="cw-${s}"><rect x="${x}" y="${y}" width="45" height="26" rx="2"/><text x="${x + 22.5}" y="${y + 17.5}" text-anchor="middle">${s === 'Stop' ? 'Stop' : sub(s).replace(/<sub>(.*)<\/sub>/, '<tspan class="sb" dy="3">$1</tspan>')}</text></g>`;
    });
    return `<svg viewBox="0 0 520 545" class="dp">
      <rect class="bus" x="250" y="16" width="12" height="438" rx="2"/>
      <text class="buslb" x="256" y="10" text-anchor="middle">BUS</text>
      ${link('l-mem', 180, 48, 250, 48)}${link('l-mar', 180, 112, 250, 112)}${link('l-pc', 180, 168, 250, 168)}
      ${link('l-sp', 180, 224, 250, 224)}${link('l-ir', 180, 280, 250, 280)}
      ${link('l-or', 262, 34, 380, 34)}
      <path class="lk" id="l-a1" d="M262 66 H342 V82"/><path class="lk" id="l-a2" d="M440 54 V82"/>
      <path class="lk" id="l-alu" d="M400 136 V160"/>${link('l-ar', 262, 180, 330, 180)}${link('l-rg', 262, 292, 300, 292)}
      <path class="lk thin" id="l-fl" d="M478 110 H508 V238 H470"/>
      <path class="lk thin" id="l-adr" d="M100 92 V76"/><path class="lk thin" id="l-dec" d="M100 318 V336"/>
      <path class="lk thin" id="l-rom" d="M100 376 V392"/>
      <g class="bx" id="mem"><rect x="20" y="20" width="160" height="56" rx="4"/><text class="lb" x="29" y="35">MEMORY</text>
        <text class="vl" x="170" y="64" text-anchor="end">--</text><text class="sm" id="memad" x="29" y="64"></text>
        <text class="rw" id="rdwr" x="170" y="35" text-anchor="end"></text></g>
      ${box('mar', 20, 92, 160, 40, 'MAR')}${box('pc', 20, 148, 160, 40, 'PC')}${box('sp', 20, 204, 160, 40, 'SP')}
      ${box('ir', 20, 260, 160, 40, 'IR')}
      <g class="bx dc" id="dec"><rect x="20" y="300" width="160" height="18"/><text class="sm" x="100" y="313" text-anchor="middle">DECODER</text></g>
      ${box('ms', 20, 336, 160, 40, 'μPC  (sequencer)')}${box('rom', 20, 392, 160, 40, 'μROM row')}
      ${box('or', 380, 14, 120, 40, 'OR')}
      <g class="bx" id="alu"><path d="M300 82 H500 L460 136 H340 Z"/><text class="lb" x="400" y="104" text-anchor="middle">ALU</text>
        <text class="vl" id="aluop" x="400" y="126" text-anchor="middle"></text></g>
      ${box('ar', 330, 160, 140, 40, 'AR (accumulator)')}
      <g class="bx" id="fl"><rect x="330" y="220" width="140" height="36" rx="4"/>
        ${['Z', 'C', 'S', 'P'].map((f, i) => `<g class="fb" id="f${f}"><text class="fn" x="${346 + i * 33}" y="234" text-anchor="middle">${f}</text><text class="fv" x="${346 + i * 33}" y="250" text-anchor="middle">0</text></g>`).join('')}</g>
      <text class="lb2" x="300" y="290">REGISTER ARRAY</text>${rg}
      <text class="lb2" x="20" y="472">CONTROL WORD · μROM output this clock</text>${cw}
      <g id="tags"></g>
    </svg>`;
  }

  class Sim {
    constructor(el) {
      this.el = el;
      const ds = el.dataset;
      const sc = el.querySelector('script[type="text/x-asm"]');
      this.src0 = sc ? sc.textContent.replace(/^\n/, '') : '';
      this.base = ds.base === 'dec' ? 10 : 16;
      this.watch = ds.watch ? parseRange(ds.watch) : null;
      this.stack = ds.stack ? parseRange(ds.stack) : null;
      this.rom = ds.rom !== undefined;
      this.m = new Machine();
      this.timer = null;
      this.build();
      this.setSrc(this.src0);
    }
    fmt(v) {
      if (v === null || v === undefined) return '--';
      return this.base === 16 ? v.toString(16).toUpperCase().padStart(2, '0') : String(v);
    }
    build() {
      const e = this.el;
      e.classList.add('sim');
      e.innerHTML = `<div class="sim-dp">${datapathSVG()}</div>
        <div class="sim-side">
          <div class="sim-bar">
            <button data-a="reset" title="Reset (R)">⟲ Reset</button>
            <button data-a="back" title="Back one clock (B)">◂ Back</button>
            <button data-a="micro" title="One clock (C)">Clock ▸</button>
            <button data-a="instr" title="One instruction (I)">Instr ▸▸</button>
            <button data-a="run">Run</button>
            <button data-a="fin" title="Run to stop">⇥ End</button>
            <span class="sp"></span>
            <button data-a="base" class="ghost">HEX</button>
            <button data-a="edit" class="ghost">Edit</button>
          </div>
          <div class="sim-now"><div class="sim-ph"><b>READY</b><span class="sim-clk"></span></div>
            <div class="sim-sigs"></div><div class="sim-why"></div></div>
          <div class="sim-mid">
            <div class="sim-left">
              <div class="sim-tabs"><button data-t="code" class="on">Program</button><button data-t="trace">Trace</button>${this.rom ? '<button data-t="rom">μROM</button>' : ''}</div>
              <div class="sim-pane sim-code"><svg class="sim-arr"></svg><div class="lst"></div></div>
              <div class="sim-pane sim-trace" hidden><table><thead><tr><th>#</th><th>addr</th><th>instruction</th><th>what changed</th></tr></thead><tbody></tbody></table></div>
              ${this.rom ? '<div class="sim-pane sim-rom" hidden></div>' : ''}
              <div class="sim-pane sim-edit" hidden><textarea spellcheck="false"></textarea><div class="ed-bar"><button data-a="asm">Assemble &amp; load</button><button data-a="orig" class="ghost">Original</button><span class="err"></span></div></div>
            </div>
            <div class="sim-mem"></div>
          </div>
        </div>`;
      this.svg = e.querySelector('svg.dp');
      this.q = s => this.svg.querySelector(s);
      e.querySelector('.sim-bar').addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return; b.blur(); this.act(b.dataset.a);
      });
      e.querySelector('.ed-bar').addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return; b.blur(); this.act(b.dataset.a);
      });
      e.querySelector('.sim-tabs').addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return; b.blur(); this.tab(b.dataset.t);
      });
      if (this.rom) this.buildRom();
    }
    buildRom() {
      const p = this.el.querySelector('.sim-rom');
      let h = '<div class="romg">';
      ROMROWS.forEach((r, i) => { h += `<div class="rr" data-i="${i}"><span>${i}</span>${r.key}${r.key === 'fetch' ? '' : ''}<em>Ck${r.key === 'fetch' ? r.i + 1 : r.i + 3}</em></div>`; });
      p.innerHTML = h + '</div>';
    }
    tab(t) {
      this.el.querySelectorAll('.sim-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      this.el.querySelectorAll('.sim-pane').forEach(p => p.hidden = true);
      this.el.querySelector('.sim-' + t).hidden = false;
      if (t === 'code') this.drawArrow();
    }
    setSrc(src) {
      this.src = src;
      const p = assemble(src);
      const err = this.el.querySelector('.err');
      err.textContent = p.errors.join(' · ');
      if (p.errors.length) return false;
      this.prog = p; this.m.load(p); this.lastJump = null; this.hist = [];
      this.renderListing(); this.renderTraceAll(); this.render(null);
      return true;
    }
    act(a) {
      if (a !== 'run') this.stop();
      switch (a) {
        case 'reset': this.m.reset(); this.lastJump = null; this.hist = []; this.renderTraceAll(); this.render(null); break;
        case 'back': {
          const h = this.hist.pop(); if (!h) break;
          this.m.restore(h.s); this.lastJump = h.j;
          this.renderTraceAll(); this.render(this.m.last); this.drawArrow(); break;
        }
        case 'micro': this.doStep('micro'); break;
        case 'instr': this.doStep('instr'); break;
        case 'run':
          if (this.timer) { this.stop(); break; }
          if (this.m.halted) { this.m.reset(); this.hist = []; this.renderTraceAll(); }
          this.el.querySelector('[data-a="run"]').textContent = 'Pause';
          this.timer = setInterval(() => { const ev = this.doStep('instr'); if (!ev || this.m.halted) this.stop(); }, +(this.el.dataset.speed || 380));
          break;
        case 'fin': {
          let g = 0, ev = null, last = null;
          while (!this.m.halted && g++ < 60000) { this.push(); ev = this.m.step(); if (ev && ev.done) last = ev.done; if (ev && ev.done && ev.done.jump) this.lastJump = ev.done.jump; }
          this.renderTraceAll(); this.render(ev); break;
        }
        case 'base': this.base = this.base === 16 ? 10 : 16; this.el.querySelector('[data-a="base"]').textContent = this.base === 16 ? 'HEX' : 'DEC';
          this.renderListing(); this.renderTraceAll(); this.render(this.m.last); break;
        case 'edit': { const ta = this.el.querySelector('textarea'); ta.value = this.src; this.tab('edit'); ta.focus(); break; }
        case 'asm': if (this.setSrc(this.el.querySelector('textarea').value)) this.tab('code'); break;
        case 'orig': this.el.querySelector('textarea').value = this.src0; break;
      }
    }
    stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; const b = this.el.querySelector('[data-a="run"]'); if (b) b.textContent = 'Run'; } }
    push() { this.hist.push({ s: this.m.save(), j: this.lastJump }); if (this.hist.length > 6000) this.hist.shift(); }
    doStep(kind) {
      if (this.m.halted) return null;
      let ev, g = 0;
      do { this.push(); ev = this.m.step(); g++; } while (kind === 'instr' && ev && !ev.done && g < 20);
      if (ev && ev.done) { this.lastJump = ev.done.jump; this.appendTrace(ev.done); }
      this.render(ev);
      return ev;
    }
    renderListing() {
      const L = this.el.querySelector('.lst');
      let h = '';
      this.prog.list.forEach((it, i) => {
        if (it.kind === 'ins') {
          const b = [it.enc.op]; if (it.enc.len === 2) b.push(this.prog.bytes[(it.addr + 1) & 255]);
          h += `<div class="ln" data-a="${it.addr}" data-i="${i}"><span class="ad">${this.fmt(it.addr)}</span><span class="by">${b.map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ')}</span><span class="la">${it.label ? it.label + ':' : ''}</span><span class="as">${esc(it.src)}</span>${it.comment ? `<span class="cm">${esc(it.comment)}</span>` : ''}</div>`;
        } else if (it.kind === 'note') {
          h += `<div class="ln nt"><span class="ad"></span><span class="by"></span><span class="la">${it.label ? it.label + ':' : ''}</span><span class="cm wide">${esc(it.comment)}</span></div>`;
        } else if (it.kind === 'dir') {
          h += `<div class="ln dr"><span class="ad"></span><span class="by"></span><span class="la"></span><span class="as dir">${esc(it.s)}</span></div>`;
        }
      });
      L.innerHTML = h;
    }
    lineFor(addr) { return this.el.querySelector(`.lst .ln[data-a="${addr}"]`); }
    drawArrow() {
      const svg = this.el.querySelector('.sim-arr'); svg.innerHTML = '';
      const j = this.lastJump; if (!j) return;
      const a = this.lineFor(j.from), b = this.lineFor(j.to); if (!a || !b) return;
      const y1 = a.offsetTop + a.offsetHeight / 2, y2 = b.offsetTop + b.offsetHeight / 2;
      const dx = Math.min(30, 10 + Math.abs(y2 - y1) / 12);
      svg.setAttribute('height', Math.max(y1, y2) + 20);
      svg.innerHTML = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#fff"/></marker></defs>
        <path d="M34 ${y1} C ${34 - dx} ${y1}, ${34 - dx} ${y2}, 34 ${y2}" class="jarr" marker-end="url(#ah)"/>
        <text x="4" y="${(y1 + y2) / 2 + 4}" class="jlb">${j.kind === 'ret' ? 'ret' : j.kind.startsWith('c') ? 'call' : 'jump'}</text>`;
    }
    renderTraceAll() { const tb = this.el.querySelector('.sim-trace tbody'); tb.innerHTML = ''; this.m.trace.forEach(r => this.appendTrace(r)); }
    appendTrace(r) {
      const tb = this.el.querySelector('.sim-trace tbody');
      const f = v => this.fmt(v);
      const ch = r.ch.map(([k, v]) => `${k}=${f(v)}`).concat(r.memc.map(([a, v]) => `M[${f(a)}]=${f(v)}`)).concat(r.fl.length ? ['flags ' + r.fl.join(' ')] : []);
      const ins = r.dec.mn + (r.opnd !== null ? ' ' + f(r.opnd) : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.n}</td><td>${f(r.addr)}</td><td>${ins}</td><td>${ch.join(', ') || '—'}${r.jump ? ` <i>PC→${f(r.pc)}</i>` : ''}</td>`;
      tb.appendChild(tr);
      const pane = this.el.querySelector('.sim-trace'); pane.scrollTop = pane.scrollHeight;
    }
    setVal(id, v) {
      const g = this.q('#' + id); if (!g) return;
      const t = g.querySelector('.vl, .rv'); const s = this.fmt(v);
      if (t.textContent !== s) { t.textContent = s; g.classList.remove('chg'); void g.getBBox; g.classList.add('chg'); }
    }
    render(ev) {
      const m = this.m, q = this.q;
      this.svg.querySelectorAll('.drv,.ld,.on,.onr,.act,.chg2').forEach(x => x.classList.remove('drv', 'ld', 'on', 'onr', 'act', 'chg2'));
      this.svg.querySelectorAll('.chg').forEach(x => x.classList.remove('chg'));
      // values
      this.setVal('mar', m.MAR); this.setVal('pc', m.PC); this.setVal('sp', m.SP); this.setVal('ir', m.IR);
      this.setVal('or', m.OR); this.setVal('ar', m.AR); this.setVal('ms', m.MS);
      q('#rom .vl').textContent = ROMROWS[m.MS] ? `${m.MS} · ${ROMROWS[m.MS].key}` : m.MS;
      q('#mem .vl').textContent = 'M[' + this.fmt(m.MAR) + '] = ' + this.fmt(m.mem[m.MAR]);
      for (let i = 0; i < 12; i++) this.setVal('r' + i, m.R[i]);
      ['Z', 'C', 'S', 'P'].forEach(f => { const g = q('#f' + f); g.querySelector('.fv').textContent = m.F[f]; g.classList.toggle('set', !!m.F[f]); });
      q('#dec text').textContent = m.dec ? 'DECODER · ' + m.dec.mn : 'DECODER';
      q('#rdwr').textContent = '';
      const bus = q('.bus'); bus.classList.remove('on');
      this.svg.querySelectorAll('.cw').forEach(c => c.classList.remove('on'));
      const tags = q('#tags'); tags.innerHTML = '';
      const ph = this.el.querySelector('.sim-ph b'), clk = this.el.querySelector('.sim-clk');
      const sigs = this.el.querySelector('.sim-sigs'), why = this.el.querySelector('.sim-why');
      clk.textContent = `clock ${m.clk} · ${m.nInstr} instr`;
      if (!ev) {
        ph.textContent = m.halted ? 'HALTED' : 'READY · PC = ' + this.fmt(m.PC);
        sigs.innerHTML = '<span class="hint">Press Clock to run one microcycle, Instr for a full fetch + execute.</span>'; why.innerHTML = '';
      } else {
        const st = ev.st, f = v => this.fmt(v);
        ph.innerHTML = (ev.phase === 'fetch' ? 'FETCH' : 'EXECUTE · ' + ev.dec.mn) + ` · Ck ${ev.ck}` + (m.halted ? ' · HALTED' : '');
        let sh = st.sig.map(s => {
          const fired = s === 'End?' ? (ev.end ? ' fired' : ' quiet') : '';
          return `<span class="sg${fired}">${sub(s)}</span>`;
        }).join('');
        if (st.rg !== undefined) sh += `<span class="sl">S<sub>RG</sub> ← R${st.rg}</span>`;
        if (st.alu) sh += `<span class="sl">S<sub>ALU</sub> ← ${st.alu}</span>`;
        if (st.fl !== undefined) sh += `<span class="sl">S<sub>FL</sub> ← ${ev.cond.fl}</span>`;
        sigs.innerHTML = sh;
        // datapath highlights
        const dmap = { PC: ['pc', 'l-pc'], SP: ['sp', 'l-sp'], AR: ['ar', 'l-ar'], OR: ['or', 'l-or'], MEM: ['mem', 'l-mem'] };
        const out = [];
        ev.drivers.forEach(([n, v]) => {
          let ids = dmap[n];
          if (!ids && n[0] === 'R') { ids = ['rg-none', 'l-rg']; q('#r' + n.slice(1))?.classList.add('drv'); }
          if (ids) { q('#' + ids[0])?.classList.add('drv'); q('#' + ids[1]).classList.add('on'); }
          out.push(n === 'MEM' ? `memory[MAR = ${f(ev.rdAddr)}] puts ${f(v)} on the bus` : `${n} (${f(v)}) drives the bus`);
        });
        if (ev.drivers.length) { bus.classList.add('on'); }
        if (ev.conflict) out.push('<b>BUS CONFLICT</b>');
        if (ev.alu) {
          q('#alu').classList.add('act'); q('#l-a1').classList.add('on');
          if (ev.alu.op !== 'PASS0') q('#l-a2').classList.add('on');
          q('#aluop').textContent = ev.alu.op === 'PASS0' ? 'PASS bus → ' + f(ev.alu.r) : `${f(ev.alu.a)} ${{ ADD: '+', SUB: '−', CMP: '−', XOR: '⊕', AND: '∧', OR: '∨' }[ev.alu.op]} ${f(ev.alu.b)} = ${f(ev.alu.r)}`;
        } else q('#aluop').textContent = '';
        const lmap = { MAR: ['mar', 'l-mar'], OR: ['or', 'l-or'], IR: ['ir', 'l-ir'], PC: ['pc', 'l-pc'], MEM: ['mem', 'l-mem'] };
        ev.loads.forEach(n => {
          if (n === 'AR') { q('#ar').classList.add('ld'); q('#l-alu').classList.add('on'); out.push(`AR ← ${ev.alu ? 'ALU output ' : ''}${f(m.AR)}`); return; }
          if (n === 'FL') { q('#fl').classList.add('ld'); q('#l-fl').classList.add('on'); out.push(`flags updated (${ev.flagsArith ? 'Z C S P' : 'Z P only: logic op'})`); return; }
          if (n[0] === 'R' && n !== 'R') { q('#' + n.toLowerCase())?.classList.add('ld'); q('#l-rg').classList.add('onr'); out.push(`${n} ← ${f(ev.bus)}`); return; }
          const ids = lmap[n]; if (ids) { q('#' + ids[0]).classList.add('ld'); q('#' + ids[1]).classList.add('onr'); }
          if (n === 'MEM') { out.push(`memory[${f(ev.wrAddr)}] ← ${f(ev.bus)} (write)`); q('#rdwr').textContent = 'WR'; }
          else if (n === 'IR') out.push(`IR ← ${f(ev.bus)}  (opcode)`);
          else out.push(`${n} ← ${f(ev.bus)}`);
        });
        if (ev.rdAddr !== null && ev.rdAddr !== undefined) q('#rdwr').textContent = 'RD';
        ev.incs.forEach(n => {
          if (n === 'PC') { q('#pc').classList.add('ld'); out.push(`PC + 1 → ${f(m.PC)}`); tags.innerHTML += '<text class="tag" x="186" y="160">+1</text>'; }
          if (n === 'SP') { q('#sp').classList.add('ld'); out.push(`SP + 1 → ${f(m.SP)}`); tags.innerHTML += '<text class="tag" x="186" y="216">+1</text>'; }
          if (n === 'SP-') { q('#sp').classList.add('ld'); out.push(`SP − 1 → ${f(m.SP)}`); tags.innerHTML += '<text class="tag" x="186" y="216">−1</text>'; }
        });
        if (ev.cond) out.push(`flag test <b>${ev.cond.fl}</b> (${FLTEST[ev.cond.fl]}) is ${ev.cond.ok ? '<b>true</b>: carry on' : '<b>false</b>: End now, branch skipped'}`);
        if (ev.lms !== undefined) { q('#ms').classList.add('ld'); q('#l-dec').classList.add('on'); out.push(`decoder maps ${f(m.IR)} → μROM row ${ev.lms} (start of ${ev.dec.key})`); }
        else if (ev.end) { q('#ms').classList.add('ld'); out.push('End: μPC reset to 0, next clock fetches'); }
        if (ev.halt) out.push('<b>StopClock</b>: the processor stops');
        if (ev.badReg !== undefined) out.push(`<b>R${ev.badReg} does not exist</b> (only R0–R11)`);
        why.innerHTML = out.map(s => `<span>${s}</span>`).join('');
        st.sig.forEach(s => { const k = s === 'End?' ? (ev.end ? 'End' : null) : s === 'StopClock' ? 'Stop' : s; if (k) q('#cw-' + k)?.classList.add('on'); });
        q('#rom').classList.add('drv2');
      }
      // listing highlight
      this.el.querySelectorAll('.lst .ln').forEach(l => l.classList.remove('cur', 'nxt'));
      const curAddr = (m.phase === 'fetch' && m.k === 0) ? null : m.instrAddr;
      const done = ev && ev.done;
      const hl = done ? done.addr : curAddr;
      if (hl !== null && hl !== undefined) { const l = this.lineFor(hl); if (l) l.classList.add('cur'); }
      if (!m.halted && m.phase === 'fetch' && m.k === 0) { const l = this.lineFor(m.PC); if (l) { l.classList.add('nxt'); } }
      const lc = this.el.querySelector('.lst .cur') || this.el.querySelector('.lst .nxt');
      if (lc) { const p = this.el.querySelector('.sim-code'); const t = lc.offsetTop; if (t < p.scrollTop + 10 || t > p.scrollTop + p.clientHeight - 40) p.scrollTop = t - 60; }
      this.drawArrow();
      this.renderMem(ev);
      if (this.rom) this.el.querySelectorAll('.rr').forEach(r => r.classList.toggle('on', +r.dataset.i === (ev ? ev.row : -1)));
    }
    renderMem(ev) {
      const M = this.el.querySelector('.sim-mem'); const m = this.m; let h = '';
      const wr = ev && ev.wrAddr !== undefined ? ev.wrAddr : -1;
      if (this.watch) {
        h += `<div class="mh">MEMORY</div>`;
        this.watch.forEach(a => { h += `<div class="mc${a === wr ? ' w' : ''}${a === m.MAR && ev && (ev.rdAddr === a) ? ' r' : ''}"><span>${this.fmt(a)}</span><b>${this.fmt(m.mem[a])}</b></div>`; });
      }
      if (this.stack) {
        h += `<div class="mh">STACK <small>grows ↓</small></div>`;
        this.stack.slice().reverse().forEach(a => { h += `<div class="mc st${a === wr ? ' w' : ''}${a === m.SP ? ' top' : ''}"><span>${this.fmt(a)}</span><b>${this.fmt(m.mem[a])}</b>${a === m.SP ? '<i>◀ SP</i>' : ''}</div>`; });
        if (this.stack.indexOf(m.SP) < 0) h += `<div class="mc st top"><span>SP</span><b>${this.fmt(m.SP)}</b></div>`;
      }
      M.innerHTML = h;
    }
  }
  function parseRange(s) {
    const out = [];
    s.split(',').forEach(p => { const [a, b] = p.trim().split('-').map(x => parseInt(x, 16)); if (b === undefined) out.push(a); else for (let i = a; i <= b; i++) out.push(i); });
    return out;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  window.SimUI = { Sim, sub, esc };
})();
