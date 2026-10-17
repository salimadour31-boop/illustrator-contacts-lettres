// Document Illustrator simulé (sous-ensemble du DOM utilisé par le script) avec un moteur de
// composition simplifié : avances, crénage (deux conventions possibles), crénage automatique
// remplacé par le crénage manuel, arabe de droite à gauche avec traits de liaison, signes,
// rotation / échelle, texte sur cercle. Rien de tout cela n'est Illustrator : c'est un banc d'essai.
// Simulated Illustrator document (subset of the DOM used by the script) with a toy layout engine.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const KAPPA = 0.5522847498;

// ---- Police simulée (unités : 1/1000 em, y vers le haut depuis la ligne de base) ----
function R(x0, y0, x1, y1) { return { t: 'rect', x0, y0, x1, y1 }; }
function C(cx, cy, r, hole) { return { t: 'circle', cx, cy, r, hole: !!hole }; }
const G = {
  'H': { adv: 700, parts: [R(80, 0, 180, 700), R(520, 0, 620, 700), R(180, 320, 520, 400)] },
  'o': { adv: 560, parts: [C(280, 250, 230), C(280, 250, 150, true)] },
  'f': { adv: 320, parts: [R(60, 0, 160, 700), R(60, 620, 420, 700)] },
  ')': { adv: 300, parts: [R(80, -150, 160, 720)] },
  'T': { adv: 600, parts: [R(0, 620, 600, 700), R(260, 0, 340, 620)] },
  'A': { adv: 640, parts: [R(20, 0, 620, 600)] },
  'V': { adv: 640, parts: [R(20, 0, 620, 600)] },
  'i': { adv: 260, parts: [R(80, 0, 180, 480), R(80, 560, 180, 660)] },
  'n': { adv: 560, parts: [R(60, 0, 160, 480), R(400, 0, 500, 480), R(60, 400, 500, 480)] },
  'I': { adv: 300, parts: [R(100, 0, 200, 700)] },
  'u': { adv: 560, parts: [R(60, 0, 160, 480), R(400, 0, 500, 480), R(60, 0, 500, 80)] },
  ' ': { adv: 250, parts: [] },
  // arabe / Arabic
  '\u0628': { adv: 600, parts: [R(100, 0, 500, 120), R(260, -200, 340, -120)], ar: true },          // ب
  '\u0631': { adv: 400, parts: [R(150, 0, 350, 300), R(-300, -250, 200, -150)], ar: true },          // ر (queue / tail)
  '\u0644': { adv: 300, parts: [R(100, 0, 180, 900), R(100, 800, 420, 900)], ar: true },             // ل (crochet / hook)
  '\u0627': { adv: 250, parts: [R(90, 0, 160, 750)], ar: true },                                     // ا
  '\u0646': { adv: 500, parts: [R(60, -100, 440, 200), R(220, 300, 300, 380)], ar: true }             // ن
};
const MARKS = { '\u064E': { w: 500, y0: 760, y1: 830 }, '\u0651': { w: 260, y0: 650, y1: 720 }, '\u0650': { w: 200, y0: -330, y1: -270 } };
const JOIN_D = new Set(['\u0628', '\u0644', '\u0646']);
const JOIN_R = new Set(['\u0631', '\u0627']);
const AUTO = { 'AV': -100 };

class Color { constructor(t) { this.typename = t; } }
class CMYKColor extends Color { constructor() { super('CMYKColor'); this.cyan = 0; this.magenta = 0; this.yellow = 0; this.black = 0; } }
class RGBColor extends Color { constructor() { super('RGBColor'); this.red = 0; this.green = 0; this.blue = 0; } }
class NoColor extends Color { constructor() { super('NoColor'); } }

function cloneColor(c) { if (!c) return c; const o = Object.create(Object.getPrototypeOf(c)); Object.assign(o, c); return o; }

class Char {
  constructor(ch, a) {
    this.ch = ch;
    this.a = Object.assign({ size: 20, font: 'MockSans', style: 'Regular', fill: new CMYKColor(), stroke: new NoColor(), sw: 0, underline: false, strike: false, kerningMethod: 'AUTO', tracking: 0 }, a || {});
    this.k = 0; this.manual = false;
  }
  clone() { const c = new Char(this.ch, Object.assign({}, this.a)); c.a.fill = cloneColor(this.a.fill); c.a.stroke = cloneColor(this.a.stroke); c.k = this.k; c.manual = this.manual; return c; }
}

function charView(ch, env) {
  const ca = {};
  Object.defineProperties(ca, {
    size: { get: () => ch.a.size, set: v => { ch.a.size = v; } },
    fillColor: { get: () => ch.a.fill, set: v => { ch.a.fill = cloneColor(v); } },
    strokeColor: { get: () => ch.a.stroke, set: v => { ch.a.stroke = cloneColor(v); } },
    strokeWeight: { get: () => ch.a.sw, set: v => { ch.a.sw = v; } },
    underline: { get: () => ch.a.underline, set: v => { ch.a.underline = v; } },
    strikeThrough: { get: () => ch.a.strike, set: v => { ch.a.strike = v; } },
    kerningMethod: { get: () => ch.a.kerningMethod, set: v => { ch.a.kerningMethod = v; } },
    tracking: { get: () => ch.a.tracking, set: v => { ch.a.tracking = v; } },
    textFont: { get: () => ({ name: ch.a.font + '-' + ch.a.style, style: ch.a.style }) }
  });
  const v = { characterAttributes: ca };
  Object.defineProperties(v, {
    kerning: { get: () => ch.k, set: x => { env.stats.kernWrites++; ch.k = x; ch.manual = true; } },
    contents: { get: () => ch.ch }
  });
  return v;
}

function rangeView(tf, env) {
  const chars = tf._chars;
  const arr = new Proxy({}, {
    get: (t, p) => {
      if (p === 'length') return chars.length;
      if (typeof p === 'string' && /^\d+$/.test(p)) { env.stats.charAccess++; return chars[+p] ? charView(chars[+p], env) : undefined; }
      return undefined;
    }
  });
  const ca = new Proxy({}, {
    set: (t, p, v) => { for (const c of chars) { const cv = charView(c, env).characterAttributes; cv[p] = v; } return true; },
    get: (t, p) => (chars.length ? charView(chars[0], env).characterAttributes[p] : undefined)
  });
  return { characters: arr, characterAttributes: ca, get length() { return chars.length; } };
}

function collection(list, extra) {
  return new Proxy(extra || {}, {
    get: (t, p) => {
      if (p === 'length') return list.length;
      if (typeof p === 'string' && /^\d+$/.test(p)) return list[+p];
      return t[p];
    }
  });
}

let UID = 0;
class Item {
  constructor(typename, parent) { this.typename = typename; this.parent = parent; this.locked = false; this.hidden = false; this.selected = false; this.name = ''; this.uid = ++UID; }
  get layer() { let p = this.parent; while (p && p.typename !== 'Layer') p = p.parent; return p; }
  remove() { const kids = this.parent._items; const i = kids.indexOf(this); if (i >= 0) kids.splice(i, 1); this.removed = true; }
}

class PathItem extends Item {
  constructor(parent, pts, fill) { super('PathItem', parent); this._pts = pts; this.fillColor = fill; this.closed = true; this.filled = true; this.stroked = false; }
  get pathPoints() { return collection(this._pts.map(p => ({ anchor: [p[0], p[1]], leftDirection: [p[2], p[3]], rightDirection: [p[4], p[5]] }))); }
  get geometricBounds() { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of this._pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return [x0, y1, x1, y0]; }
}
class CompoundPathItem extends Item {
  constructor(parent) { super('CompoundPathItem', parent); this._items = []; }
  get pathItems() { return collection(this._items); }
  get geometricBounds() { let b = null; for (const p of this._items) { const g = p.geometricBounds; b = b ? [Math.min(b[0], g[0]), Math.max(b[1], g[1]), Math.max(b[2], g[2]), Math.min(b[3], g[3])] : g; } return b; }
}
class GroupItem extends Item {
  constructor(parent) { super('GroupItem', parent); this._items = []; }
  get pageItems() { return collection(this._items); }
}

class TextFrame extends Item {
  constructor(parent, env, text, attrs, opt) {
    super('TextFrame', parent);
    this.env = env; opt = opt || {};
    this._chars = Array.from(text).map(ch => new Char(ch, attrs));
    this.anchor = opt.anchor || [100, 500];
    this.angle = opt.angle || 0; this.scale = opt.scale || 1;
    this.kind = opt.path ? 'PATHTEXT' : (opt.area ? 'AREATEXT' : 'POINTTEXT');
    this.circle = opt.path || null;
    this.rtl = !!opt.rtl;
    this.note = ''; this.orientation = 'HORIZONTAL'; this.nextFrame = null; this.previousFrame = null;
    this._tags = [];
  }
  get contents() { return this._chars.map(c => c.ch).join(''); }
  set contents(s) { this._chars = Array.from(s).map(ch => new Char(ch)); }
  get textRange() { return rangeView(this, this.env); }
  get characters() { return this.textRange.characters; }
  get matrix() { const c = Math.cos(this.angle) * this.scale, s = Math.sin(this.angle) * this.scale; return { mValueA: c, mValueB: s, mValueC: -s, mValueD: c, mValueTX: this.anchor[0], mValueTY: this.anchor[1] }; }
  get lines() { return { length: 1 }; }
  get tags() { const self = this; return collection(this._tags, { add() { const t = { name: '', value: '', remove() { self._tags.splice(self._tags.indexOf(t), 1); } }; self._tags.push(t); return t; } }); }
  get visibleBounds() { const g = this.layoutGlyphs(); let b = [this.anchor[0], this.anchor[1] + 10, this.anchor[0] + 10, this.anchor[1]]; for (const gl of g) for (const r of gl.rings) for (const p of r) { b[0] = Math.min(b[0], p[0]); b[2] = Math.max(b[2], p[0]); b[1] = Math.max(b[1], p[1]); b[3] = Math.min(b[3], p[1]); } return b; }
  get geometricBounds() { return this.visibleBounds; }
  duplicate(layer) {
    const d = new TextFrame(layer || this.parent, this.env, '', {}, {});
    d._chars = this._chars.map(c => c.clone());
    Object.assign(d, { anchor: this.anchor.slice(), angle: this.angle, scale: this.scale, kind: this.kind, circle: this.circle, rtl: this.rtl, note: this.note });
    (layer || this.parent)._items.push(d);
    return d;
  }
  // Composition simplifiée -> glyphes en coordonnées du document
  layoutGlyphs() {
    const env = this.env, ch = this._chars, n = ch.length, out = [];
    const conv = env.conv;
    let pen = 0, lastBase = null;
    const toDoc = (x, y) => {
      if (this.circle) {
        const { cx, cy, r } = this.circle; const phi = x / r;
        const bx = cx + r * Math.sin(phi), by = cy - r * Math.cos(phi);
        const tx = Math.cos(phi), ty = Math.sin(phi), nx = -Math.sin(phi), ny = Math.cos(phi);
        return [bx + 0 * tx + y * nx, by + y * ny];
      }
      const c = Math.cos(this.angle) * this.scale, s = Math.sin(this.angle) * this.scale;
      return [this.anchor[0] + c * x - s * y, this.anchor[1] + s * x + c * y];
    };
    const toDocCircle = (x, y, ox) => { // pour le texte sur cercle : x local autour de l'origine du glyphe
      const { cx, cy, r } = this.circle; const phi = ox / r;
      const bx = cx + r * Math.sin(phi), by = cy - r * Math.cos(phi);
      const tx = Math.cos(phi), ty = Math.sin(phi), nx = -Math.sin(phi), ny = Math.cos(phi);
      return [bx + x * tx + y * nx, by + x * ty + y * ny];
    };
    let stack = 0;
    for (let k = 0; k < n; k++) {
      const c = ch[k], sz = c.a.size / 1000;
      const mk = MARKS[c.ch];
      if (mk) {
        if (lastBase) {
          const cxL = lastBase.cx, off = stack > 0 ? stack * env.markStack - 110 : 0;
          const parts = [R(cxL - mk.w / 2, mk.y0 + off, cxL + mk.w / 2, mk.y1 + off)];
          out.push(this._glyph(k, parts, lastBase.origin, lastBase.sz, toDoc, toDocCircle));
          if (mk.y0 > 0) stack++;
        }
        continue;
      }
      const g = G[c.ch] || G['H'];
      if (c.ch === '\r') { continue; }
      let parts = g.parts.slice();
      if (c.a.font === 'MockScript' && !g.ar && c.ch !== ' ') parts.push(R(-80, 0, g.adv + 80, 40));
      // liaisons arabes / Arabic joins
      if (g.ar) {
        const prev = prevBase(ch, k), next = nextBase(ch, k);
        const joinsPrev = prev && JOIN_D.has(prev.ch) && (JOIN_D.has(c.ch) || JOIN_R.has(c.ch));
        const joinsNext = next && JOIN_D.has(c.ch) && (JOIN_D.has(next.ch) || JOIN_R.has(next.ch));
        if (joinsPrev) parts.push(R(g.adv - 100, 0, g.adv + 60, 60));
        if (joinsNext) parts.push(R(-60, 0, 100, 60));
      }
      let origin;
      if (this.rtl) { pen -= g.adv * sz; origin = pen; } else { origin = pen; }
      stack = 0;
      if (g.parts.length || parts.length) out.push(this._glyph(k, parts, origin, sz, toDoc, toDocCircle));
      lastBase = { cx: g.adv / 2, origin, sz };
      // avance + crénage / advance + kerning
      let kern = 0;
      const nb = nextBaseIndex(ch, k);
      if (nb >= 0) {
        const kc = conv === 'after' ? lastClusterIndex(ch, k) : nb;
        const kk = ch[kc];
        kern += kk.k * kk.a.size / 1000;
        const pairKey = c.ch + ch[nb].ch;
        if (AUTO[pairKey] && kk.a.kerningMethod === 'AUTO' && !kk.manual) kern += AUTO[pairKey] * c.a.size / 1000;
      }
      kern += (c.a.tracking || 0) * c.a.size / 1000;
      if (this.rtl) pen -= kern; else pen += g.adv * sz + kern;
    }
    return out;
  }
  _glyph(k, parts, origin, sz, toDoc, toDocCircle) {
    const rings = [];
    for (const p of parts) {
      let pts;
      if (p.t === 'rect') pts = [[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]].map(q => [q[0], q[1], q[0], q[1], q[0], q[1]]);
      else {
        const r = p.r, kk = KAPPA * r, cx = p.cx, cy = p.cy;
        pts = [[cx + r, cy, cx + r, cy - kk, cx + r, cy + kk], [cx, cy + r, cx + kk, cy + r, cx - kk, cy + r], [cx - r, cy, cx - r, cy + kk, cx - r, cy - kk], [cx, cy - r, cx - kk, cy - r, cx + kk, cy - r]];
        if (p.hole) pts = pts.reverse().map(q => [q[0], q[1], q[4], q[5], q[2], q[3]]);
      }
      const tr = (x, y) => this.circle ? toDocCircle(x * sz, y * sz, origin + 0) : toDoc(origin + x * sz, y * sz);
      rings.push(pts.map(q => { const a = tr(q[0], q[1]), l = tr(q[2], q[3]), rr = tr(q[4], q[5]); return [a[0], a[1], l[0], l[1], rr[0], rr[1]]; }));
    }
    return { k, rings };
  }
  createOutline() {
    const grp = new GroupItem(this.parent);
    for (const gl of this.layoutGlyphs()) {
      const cpi = new CompoundPathItem(grp);
      const fill = cloneColor(this._chars[gl.k].a.fill);
      for (const r of gl.rings) cpi._items.push(new PathItem(cpi, r, fill));
      grp._items.push(cpi);
    }
    if (this.extraAppearance) { const cpi = new CompoundPathItem(grp); cpi._items.push(new PathItem(cpi, [[0, 0, 0, 0, 0, 0], [1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1]], new CMYKColor())); grp._items.push(cpi); }
    this.parent._items.push(grp);
    this.remove();
    this.env.stats.outlines++;
    return grp;
  }
  set position(p) { this.anchor = [p[0], p[1]]; }
  get position() { return this.anchor; }
}
function prevBase(ch, k) { for (let j = k - 1; j >= 0; j--) { if (MARKS[ch[j].ch]) continue; return ch[j]; } return null; }
function nextBase(ch, k) { for (let j = k + 1; j < ch.length; j++) { if (MARKS[ch[j].ch]) continue; return ch[j]; } return null; }
function nextBaseIndex(ch, k) { for (let j = k + 1; j < ch.length; j++) { if (MARKS[ch[j].ch]) continue; return j; } return -1; }
function lastClusterIndex(ch, k) { let j = k; while (j + 1 < ch.length && MARKS[ch[j + 1].ch]) j++; return j; }

class Layer extends Item {
  constructor(parent, env, name) { super('Layer', parent); this.env = env; this.name = name || 'Calque'; this.visible = true; this.printable = true; this._items = []; }
  get textFrames() { const self = this; return collection(this._items.filter(i => i.typename === 'TextFrame'), { add() { const t = new TextFrame(self, self.env, '', {}, { anchor: [0, 0] }); self._items.push(t); return t; } }); }
  get pathItems() { const self = this; return collection(this._items.filter(i => i.typename === 'PathItem'), { ellipse(top, left, w, h) { const p = new PathItem(self, [[left, top - h / 2, 0, 0, 0, 0]], null); p.ellipse = { top, left, w, h }; self._items.push(p); return p; } }); }
  get pageItems() { return collection(this._items); }
  remove() { const kids = this.parent._layers; kids.splice(kids.indexOf(this), 1); }
}

class Doc {
  constructor(env, cs) {
    this.env = env; this.typename = 'Document'; this.name = 'essai.ai';
    this.documentColorSpace = cs || 'CMYK'; this._layers = []; this._sel = []; this.scaleFactor = undefined;
    this.addLayer('Calque 1');
    this.activeLayer = this._layers[0];
    const self = this;
    this.artboards = collection([{ artboardRect: [0, 1000, 1000, 0] }], { getActiveArtboardIndex: () => 0 });
  }
  addLayer(name) { const l = new Layer(this, this.env, name); this._layers.unshift(l); return l; }
  get layers() { const self = this; return collection(this._layers, { add() { const l = self.addLayer('Calque'); self.activeLayer = l; return l; } }); }
  get textFrames() { const out = []; const walk = it => { for (const c of it._items || []) { if (c.typename === 'TextFrame') out.push(c); if (c.typename === 'GroupItem') walk(c); } }; for (const l of this._layers) walk(l); return collection(out); }
  get selection() { return this._sel; }
  set selection(v) { this._sel = v ? v : []; if (!v) { const tfs = this.textFrames; for (let i = 0; i < tfs.length; i++) tfs[i].selected = false; } }
  addText(text, attrs, opt, layer) { const l = layer || this._layers[this._layers.length - 1]; const t = new TextFrame(l, this.env, text, attrs, opt); l._items.push(t); return t; }
}

function makeEnv(opts) {
  opts = opts || {};
  const env = { conv: opts.conv || 'after', markStack: opts.markStack || 40, alerts: [], confirms: 0, stats: { kernWrites: 0, outlines: 0, charAccess: 0 } };
  const doc = new Doc(env, opts.cs);
  env.doc = doc;
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-'));
  class File {
    constructor(p) { this.fsName = p; this.name = path.basename(p); this.encoding = 'UTF-8'; this._mode = null; this._buf = ''; }
    get exists() { return fs.existsSync(this.fsName); }
    open(m) { this._mode = m; this._buf = ''; return true; }
    read() { return fs.readFileSync(this.fsName, 'utf8'); }
    write(s) { this._buf += s; }
    close() { if (this._mode === 'w') fs.writeFileSync(this.fsName, this._buf); }
    static saveDialog() { return new File(path.join(tmpdir, 'rapport')); }
  }
  const g = {
    app: { documents: { length: 1 }, activeDocument: doc },
    $: { locale: opts.locale || 'fr_FR', global: globalThis },
    alert: (m) => env.alerts.push(String(m)),
    confirm: () => { env.confirms++; return true; },
    CMYKColor, RGBColor, NoColor, File, Folder: { userData: { fsName: tmpdir } },
    ElementPlacement: { PLACEATEND: 'PLACEATEND', PLACEATBEGINNING: 'PLACEATBEGINNING' },
    TextType: { POINTTEXT: 'POINTTEXT', AREATEXT: 'AREATEXT', PATHTEXT: 'PATHTEXT' },
    TextOrientation: { HORIZONTAL: 'HORIZONTAL', VERTICAL: 'VERTICAL' },
    AutoKernType: { AUTO: 'AUTO', OPTICAL: 'OPTICAL', NOAUTOKERN: 'NOAUTOKERN' },
    DocumentColorSpace: { CMYK: 'CMYK', RGB: 'RGB' }
  };
  env.globals = g; env.tmpdir = tmpdir;
  return env;
}

// Mesure de référence indépendante : distance minimale réelle entre deux caractères (échantillonnage dense)
// Independent reference measure: true min distance between two characters (dense sampling)
function refGap(tf, i, j) {
  const gl = tf.layoutGlyphs(); const a = gl.filter(g => g.k === i), b = gl.filter(g => g.k === j);
  const samp = (gs) => { const o = []; for (const g of gs) for (const r of g.rings) { for (let q = 0; q < r.length; q++) { const p = r[q], n = r[(q + 1) % r.length]; for (let s = 0; s < 60; s++) { const t = s / 60, mt = 1 - t; const x = mt * mt * mt * p[0] + 3 * mt * mt * t * p[4] + 3 * mt * t * t * n[2] + t * t * t * n[0]; const y = mt * mt * mt * p[1] + 3 * mt * mt * t * p[5] + 3 * mt * t * t * n[3] + t * t * t * n[1]; o.push([x, y]); } } } return o; };
  const A = samp(a), B = samp(b); let m = Infinity;
  // chevauchement : un point échantillonné de l'un dans un anneau échantillonné de l'autre
  const ringsOf = (gs) => { const o = []; for (const g of gs) for (const r of g.rings) { const poly = []; for (let q = 0; q < r.length; q++) { const p = r[q], n = r[(q + 1) % r.length]; for (let s = 0; s < 60; s++) { const t = s / 60, mt = 1 - t; poly.push([mt * mt * mt * p[0] + 3 * mt * mt * t * p[4] + 3 * mt * t * t * n[2] + t * t * t * n[0], mt * mt * mt * p[1] + 3 * mt * mt * t * p[5] + 3 * mt * t * t * n[3] + t * t * t * n[1]]); } } o.push(poly); } return o; };
  const inside = (pt, polys) => { let w = 0; for (const poly of polys) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a1 = poly[i], b1 = poly[j]; if ((a1[1] > pt[1]) !== (b1[1] > pt[1]) && pt[0] < (b1[0] - a1[0]) * (pt[1] - a1[1]) / (b1[1] - a1[1]) + a1[0]) c = !c; } if (c) w++; } return w % 2 === 1; };
  const RA = ringsOf(a), RB = ringsOf(b);
  for (const p of A) if (inside(p, RB)) return -1;
  for (const q of B) if (inside(q, RA)) return -1;
  for (const p of A) for (const q of B) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < m) m = d; }
  return m;
}

module.exports = { makeEnv, refGap, CMYKColor, NoColor };
