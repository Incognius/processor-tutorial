/* Simple single-bus processor (P J Narayanan, "Design of a Simple Processor")
   Microcycle-accurate model: enables act on the rising edge, loads / inc / dec on
   the falling edge. Microcode is copied from Tables 5.1, 5.2, 6.2 and 7.1. */
(function () {
  'use strict';
  const FL = ['u', 'z', 'nz', 'c', 'nc', 'p', 'm', 'op'];
  const FLTEST = { u: 'always true', z: 'Z = 1', nz: 'Z = 0', c: 'C = 1', nc: 'C = 0', p: 'S = 0', m: 'S = 1', op: 'P = 1' };
  const IMM = ['adi', 'sbi', 'xri', 'ani', 'ori', 'cmi'];
  const RALU = ['add', 'sub', 'xor', 'and', 'or', 'cmp'];
  const OPS = ['ADD', 'SUB', 'XOR', 'AND', 'OR', 'CMP'];

  function decode(b) {
    b &= 255;
    const hi = b >> 4, lo = b & 15;
    if (b === 0) return { key: 'nop', g: 'nop', mn: 'nop', len: 1 };
    if (b <= 6) return { key: IMM[b - 1], g: 'imm', alu: OPS[b - 1], mn: IMM[b - 1], len: 2 };
    if (b === 7) return { key: 'stop', g: 'stop', mn: 'stop', len: 1 };
    if (b <= 15) return { key: 'ret', g: 'ret', fl: b & 7, mn: 'ret' + FL[b & 7], len: 1 };
    if (hi <= 6) return { key: RALU[hi - 1], g: 'alu', alu: OPS[hi - 1], r: lo, mn: RALU[hi - 1] + ' r' + lo, len: 1 };
    const rk = { 7: 'movs', 8: 'movd', 9: 'movi', 10: 'stor', 11: 'load', 12: 'push', 13: 'pop' }[hi];
    if (rk) return { key: rk, g: rk, r: lo, mn: rk + ' r' + lo, len: rk === 'movi' ? 2 : 1 };
    if (hi === 14) return lo < 8 ? { key: 'jmpd', g: 'jmpd', fl: lo, mn: 'jmpd' + FL[lo], len: 2 }
      : { key: 'jmpr', g: 'jmpr', fl: lo & 7, mn: 'jmpr' + FL[lo & 7], len: 1 };
    return lo < 8 ? { key: 'cd', g: 'cd', fl: lo, mn: 'cd' + FL[lo], len: 2 }
      : { key: 'cr', g: 'cr', fl: lo & 7, mn: 'cr' + FL[lo & 7], len: 1 };
  }

  const S = (sig, x) => Object.assign({ sig }, x || {});
  const FETCH = [S(['EPC', 'LMR', 'IPC']), S(['RD', 'LIR', 'LMS'])];
  function micro(d) {
    switch (d.g) {
      case 'nop': return [S(['End'])];
      case 'stop': return [S(['End', 'StopClock'])];
      case 'imm': return [S(['EPC', 'LMR', 'IPC']), S(['RD', 'LOR']),
        S(d.alu === 'CMP' ? ['EAR', 'End'] : ['EAR', 'LAR', 'End'], { alu: d.alu })];
      case 'alu': return [S(['ERG', 'LOR'], { rg: d.r }),
        S(d.alu === 'CMP' ? ['EAR', 'End'] : ['EAR', 'LAR', 'End'], { alu: d.alu })];
      case 'movs': return [S(['ERG', 'LAR', 'End'], { rg: d.r, alu: 'PASS0' })];
      case 'movd': return [S(['EAR', 'LRG', 'End'], { rg: d.r })];
      case 'movi': return [S(['EPC', 'LMR', 'IPC']), S(['RD', 'LRG', 'End'], { rg: d.r })];
      case 'stor': return [S(['EAR', 'LMR']), S(['ERG', 'WR', 'End'], { rg: d.r })];
      case 'load': return [S(['EAR', 'LMR']), S(['RD', 'LRG', 'End'], { rg: d.r })];
      case 'push': return [S(['DSP']), S(['ESP', 'LMR']), S(['ERG', 'WR', 'End'], { rg: d.r })];
      case 'pop': return [S(['ESP', 'LMR', 'ISP']), S(['RD', 'LRG', 'End'], { rg: d.r })];
      case 'jmpd': return [S(['EPC', 'LMR', 'IPC', 'EFL', 'End?'], { fl: d.fl }), S(['RD', 'LPC', 'End'])];
      case 'jmpr': return [S(['EFL', 'End?'], { fl: d.fl }), S(['EAR', 'LPC', 'End'])];
      case 'cd': return [S(['EPC', 'LMR', 'IPC', 'EFL', 'End?'], { fl: d.fl }), S(['RD', 'LOR', 'DSP']),
        S(['ESP', 'LMR']), S(['EPC', 'WR']), S(['EOR', 'LPC', 'End'])];
      case 'cr': return [S(['EFL', 'End?'], { fl: d.fl }), S(['DSP']), S(['ESP', 'LMR']), S(['EPC', 'WR']),
        S(['EAR', 'LPC', 'End'])];
      case 'ret': return [S(['EFL', 'End?'], { fl: d.fl }), S(['ESP', 'LMR', 'ISP']), S(['RD', 'LPC', 'End'])];
    }
    return [S(['End'])];
  }

  /* Microprogram ROM layout in the order of Table 7.1 (64 rows) */
  const ROMORDER = [['fetch', 2], ['nop', 1], ['adi', 3], ['sbi', 3], ['xri', 3], ['ani', 3], ['ori', 3], ['cmi', 3],
    ['stop', 1], ['ret', 3], ['add', 2], ['sub', 2], ['xor', 2], ['and', 2], ['or', 2], ['cmp', 2], ['movs', 1],
    ['movd', 1], ['movi', 2], ['stor', 2], ['load', 2], ['push', 3], ['pop', 2], ['jmpd', 2], ['jmpr', 2], ['cd', 5], ['cr', 5]];
  const ROMSTART = {}; const ROMROWS = [];
  (function () { let a = 0; ROMORDER.forEach(([k, n]) => { ROMSTART[k] = a; for (let i = 0; i < n; i++) ROMROWS.push({ key: k, i }); a += n; }); })();

  function alu(op, a, b) {
    let r = 0, c = 0, arith = false;
    switch (op) {
      case 'ADD': r = a + b; c = r > 255 ? 1 : 0; r &= 255; arith = true; break;
      case 'SUB': case 'CMP': r = (a - b) & 255; c = a < b ? 1 : 0; arith = true; break;
      case 'XOR': r = a ^ b; break;
      case 'AND': r = a & b; break;
      case 'OR': r = a | b; break;
      default: r = a;
    }
    return { r, c, arith };
  }
  const pop8 = v => { let n = 0; for (let i = 0; i < 8; i++) n += (v >> i) & 1; return n; };

  class Machine {
    constructor() { this.prog = null; this.reset(); }
    load(prog) { this.prog = prog; this.reset(); }
    reset() {
      this.mem = new Array(256).fill(0);
      this.R = new Array(12).fill(0);
      this.PC = 0; this.SP = 0; this.AR = 0; this.OR = 0; this.MAR = 0; this.IR = 0; this.MS = 0;
      this.F = { Z: 0, C: 0, S: 0, P: 0 };
      if (this.prog) {
        for (const a in this.prog.bytes) this.mem[a] = this.prog.bytes[a];
        const ini = this.prog.init;
        for (const k in ini) {
          const v = ini[k];
          if (/^r\d+$/.test(k)) this.R[+k.slice(1)] = v;
          else if (k in this.F) this.F[k] = v;
          else this[k.toUpperCase()] = v;
        }
      }
      this.phase = 'fetch'; this.k = 0; this.clk = 0; this.ck = 0; this.halted = false;
      this.instrAddr = this.PC; this.dec = null; this.code = null; this.trace = []; this.last = null; this.nInstr = 0;
    }
    cond(f) {
      const F = this.F;
      return [1, F.Z, 1 - F.Z, F.C, 1 - F.C, 1 - F.S, F.S, F.P][f] === 1;
    }
    /* full machine state for the simulator's one-clock Back button (prog is shared, everything mutable is copied) */
    save() { return Object.assign({}, this, { prog: undefined, mem: this.mem.slice(), R: this.R.slice(), F: Object.assign({}, this.F), trace: this.trace.slice() }); }
    restore(s) { const p = this.prog; Object.assign(this, s); this.prog = p; this.mem = s.mem.slice(); this.R = s.R.slice(); this.F = Object.assign({}, s.F); this.trace = s.trace.slice(); }
    snapshot() { return { PC: this.PC, SP: this.SP, AR: this.AR, R: this.R.slice(), F: Object.assign({}, this.F), mem: this.mem.slice() }; }
    step() {
      if (this.halted) return null;
      const isF = this.phase === 'fetch';
      if (isF && this.k === 0) { this.instrAddr = this.PC; this.snap = this.snapshot(); this.ck = 0; }
      const st = isF ? FETCH[this.k] : this.code[this.k];
      const sig = new Set(st.sig);
      const ev = { phase: this.phase, ck: this.ck + 1, st, row: this.MS, dec: this.dec, drivers: [], loads: [], incs: [] };
      let ok = true;
      if (sig.has('EFL')) { ok = this.cond(st.fl); ev.cond = { fl: FL[st.fl], ok }; }
      const rg = st.rg;
      if (rg !== undefined && rg > 11) ev.badReg = rg;
      const rv = rg !== undefined ? (this.R[rg] || 0) : 0;
      const d = [];
      if (sig.has('EPC')) d.push(['PC', this.PC]);
      if (sig.has('ESP')) d.push(['SP', this.SP]);
      if (sig.has('EAR')) d.push(['AR', this.AR]);
      if (sig.has('ERG')) d.push(['R' + rg, rv]);
      if (sig.has('EOR')) d.push(['OR', this.OR]);
      if (sig.has('RD')) d.push(['MEM', this.mem[this.MAR]]);
      ev.drivers = d; ev.conflict = d.length > 1;
      const bus = d.length ? d[0][1] : null; ev.bus = bus; ev.rdAddr = sig.has('RD') ? this.MAR : null;
      let A = null;
      if (st.alu) { A = alu(st.alu, bus == null ? 0 : bus, this.OR); ev.alu = { op: st.alu, a: bus, b: this.OR, r: A.r }; }
      const oMAR = this.MAR, oPC = this.PC, oSP = this.SP;
      if (sig.has('LMR')) { this.MAR = bus; ev.loads.push('MAR'); }
      if (sig.has('LOR')) { this.OR = bus; ev.loads.push('OR'); }
      if (sig.has('LAR')) { this.AR = A ? A.r : bus; ev.loads.push('AR'); }
      if (sig.has('LRG') && rg <= 11) { this.R[rg] = bus; ev.loads.push('R' + rg); }
      if (sig.has('LIR')) { this.IR = bus; ev.loads.push('IR'); }
      if (sig.has('WR')) { this.mem[oMAR] = bus; ev.loads.push('MEM'); ev.wrAddr = oMAR; }
      if (sig.has('LPC')) { this.PC = bus; ev.loads.push('PC'); }
      else if (sig.has('IPC')) { this.PC = (oPC + 1) & 255; ev.incs.push('PC'); }
      if (sig.has('ISP')) { this.SP = (oSP + 1) & 255; ev.incs.push('SP'); }
      if (sig.has('DSP')) { this.SP = (oSP - 1) & 255; ev.incs.push('SP-'); }
      if (A && st.alu !== 'PASS0') {
        this.F.Z = A.r === 0 ? 1 : 0; this.F.P = pop8(A.r) & 1;
        if (A.arith) { this.F.C = A.c; this.F.S = (A.r >> 7) & 1; }
        ev.loads.push('FL'); ev.flagsArith = A.arith;
      }
      const end = sig.has('End') || (sig.has('End?') && !ok);
      ev.end = end; ev.endIf = sig.has('End?');
      this.clk++; this.ck++;
      if (sig.has('StopClock')) { this.halted = true; ev.halt = true; }
      if (sig.has('LMS')) {
        this.dec = decode(this.IR); this.code = micro(this.dec); this.phase = 'exec'; this.k = 0;
        this.MS = ROMSTART[this.dec.key]; ev.lms = this.MS; ev.dec = this.dec;
      } else if (end) {
        this.finishInstr(ev);
        this.phase = 'fetch'; this.k = 0; this.MS = 0;
      } else { this.k++; this.MS++; }
      this.last = ev;
      return ev;
    }
    finishInstr(ev) {
      const s = this.snap, ch = [], d = this.dec;
      if (this.AR !== s.AR) ch.push(['AR', this.AR]);
      this.R.forEach((v, i) => { if (v !== s.R[i]) ch.push(['R' + i, v]); });
      if (this.SP !== s.SP) ch.push(['SP', this.SP]);
      const memc = [];
      this.mem.forEach((v, i) => { if (v !== s.mem[i]) memc.push([i, v]); });
      const fl = []; for (const k in this.F) if (this.F[k] !== s.F[k]) fl.push(k + '=' + this.F[k]);
      const fall = (this.instrAddr + d.len) & 255;
      let jump = null;
      if (/^(jmpd|jmpr|cd|cr|ret)$/.test(d.g) && this.PC !== fall) jump = { from: this.instrAddr, to: this.PC, kind: d.g };
      const opnd = d.len === 2 ? s.mem[(this.instrAddr + 1) & 255] : null;
      this.nInstr++;
      const row = { n: this.nInstr, addr: this.instrAddr, dec: d, opnd, ch, memc, fl, pc: this.PC, clocks: this.ck, jump };
      this.trace.push(row);
      ev.done = row;
    }
    instr() {
      let ev, guard = 0;
      do { ev = this.step(); guard++; } while (ev && !ev.done && guard < 20);
      return ev;
    }
  }

  /* ---------------- assembler ---------------- */
  const REGOP = { add: 0x10, sub: 0x20, xor: 0x30, and: 0x40, or: 0x50, cmp: 0x60, movs: 0x70, movd: 0x80, stor: 0xA0, store: 0xA0, load: 0xB0, push: 0xC0, pop: 0xD0 };
  const IMMOP = { adi: 1, sbi: 2, subi: 2, sui: 2, xri: 3, ani: 4, ori: 5, cmi: 6 };
  function flOf(s) { if (s === '') return 0; const i = FL.indexOf(s); return i; }
  function encode(mn, args) {
    const reg = t => { const m = /^r(\d+)$/i.exec(t || ''); if (!m) throw new Error('expected a register, got "' + (t || '') + '"'); const n = +m[1]; if (n > 11) throw new Error('only R0–R11 exist'); return n; };
    if (mn === 'nop') return { op: 0, len: 1 };
    if (mn === 'stop' || mn === 'hlt') return { op: 7, len: 1 };
    if (mn in IMMOP) return { op: IMMOP[mn], len: 2, arg: args[0] };
    if (mn in REGOP) return { op: REGOP[mn] | reg(args[0]), len: 1 };
    if (mn === 'movi') return { op: 0x90 | reg(args[0]), len: 2, arg: args[1] };
    let m;
    if ((m = /^(?:jmpd|jumpd|jmp)(\w*)$/.exec(mn))) { const f = flOf(m[1]); if (f >= 0) return { op: 0xE0 | f, len: 2, arg: args[0] }; }
    if ((m = /^jmpr(\w*)$/.exec(mn))) { const f = flOf(m[1]); if (f >= 0) return { op: 0xE8 | f, len: 1 }; }
    if ((m = /^cd(\w*)$/.exec(mn))) { const f = flOf(m[1]); if (f >= 0) return { op: 0xF0 | f, len: 2, arg: args[0] }; }
    if ((m = /^cr(\w*)$/.exec(mn))) { const f = flOf(m[1]); if (f >= 0) return { op: 0xF8 | f, len: 1 }; }
    if ((m = /^ret(\w*)$/.exec(mn))) { const f = flOf(m[1]); if (f >= 0) return { op: 0x08 | f, len: 1 }; }
    throw new Error('unknown instruction "' + mn + '"');
  }
  function num(t, labels) {
    if (t === undefined) throw new Error('missing operand');
    let m;
    if ((m = /^0x([0-9a-f]+)$/i.exec(t))) return parseInt(m[1], 16) & 255;
    if ((m = /^([0-9a-f]+)h$/i.exec(t))) return parseInt(m[1], 16) & 255;
    if (/^-?\d+$/.test(t)) return (+t) & 255;
    const k = t.toLowerCase();
    if (k in labels) return labels[k];
    throw new Error('unknown label "' + t + '"');
  }
  function assemble(src) {
    const out = { bytes: {}, list: [], labels: {}, init: {}, errors: [], addrLine: {} };
    const items = []; let loc = 0;
    src.replace(/\r/g, '').split('\n').forEach((raw, ln) => {
      const cm = /(;|\/\/)(.*)$/.exec(raw);
      const comment = cm ? cm[2].trim() : '';
      let s = (cm ? raw.slice(0, cm.index) : raw).trim();
      let label = null; const lm = /^([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(s);
      if (lm && !/^\.data/i.test(s)) { label = lm[1]; s = lm[2].trim(); out.labels[label.toLowerCase()] = loc; }
      if (!s) { if (label || comment) items.push({ kind: 'note', label, comment, addr: loc, ln }); return; }
      if (s[0] === '.') {
        const em = /^\.equ\s+([A-Za-z_]\w*)\s*[ ,=]\s*(\S+)/i.exec(s);
        if (em) { try { out.labels[em[1].toLowerCase()] = num(em[2], out.labels); } catch (e) { out.errors.push('line ' + (ln + 1) + ': ' + e.message); } return; }
        items.push({ kind: 'dir', s, ln, label, addr: loc }); const om = /^\.org\s+(\S+)/i.exec(s); if (om) { try { loc = num(om[1], out.labels); } catch (e) { } } return;
      }
      const tok = s.split(/[\s,]+/).filter(Boolean);
      try {
        const enc = encode(tok[0].toLowerCase(), tok.slice(1));
        items.push({ kind: 'ins', label, comment, addr: loc, enc, src: s, ln }); loc += enc.len;
      } catch (e) { out.errors.push('line ' + (ln + 1) + ': ' + e.message); }
    });
    items.forEach(it => {
      if (it.kind === 'dir') {
        const s = it.s; let m;
        try {
          if ((m = /^\.data\s+(\S+?)\s*:\s*(.*)$/i.exec(s))) {
            let a = num(m[1], out.labels);
            m[2].split(/[\s,]+/).filter(Boolean).forEach(v => { out.bytes[a] = num(v, out.labels); a = (a + 1) & 255; });
          } else if ((m = /^\.(set|flag)\s+(.*)$/i.exec(s))) {
            m[2].split(/[\s,]+/).filter(Boolean).forEach(p => { const [k, v] = p.split('='); let key = k.toLowerCase(); if (m[1].toLowerCase() === 'flag') key = key.toUpperCase(); out.init[key] = num(v, out.labels); });
          }
        } catch (e) { out.errors.push('line ' + (it.ln + 1) + ': ' + e.message); }
        return;
      }
      if (it.kind === 'ins') {
        out.bytes[it.addr] = it.enc.op;
        if (it.enc.len === 2) { try { out.bytes[(it.addr + 1) & 255] = num(it.enc.arg, out.labels); } catch (e) { out.errors.push('line ' + (it.ln + 1) + ': ' + e.message); } }
        out.addrLine[it.addr] = out.list.length;
      }
      out.list.push(it);
    });
    return out;
  }

  window.SP8 = { FL, FLTEST, decode, micro, FETCH, ROMSTART, ROMROWS, ROMORDER, alu, Machine, assemble, pop8 };
})();
