// Tests des fonctions pures (extraites entre @@CORE-BEGIN et @@CORE-END)
// Tests of the pure functions (extracted between @@CORE-BEGIN and @@CORE-END)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'ContactsLettres.jsx'), 'utf8');
const core = src.substring(src.indexOf('// @@CORE-BEGIN'), src.indexOf('// @@CORE-END'));
const CL = new Function(core + '\nreturn CL;')();

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('ÉCHEC / FAIL:', msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ` (${a} vs ${b})`); }
const cp = s => Array.from(s).map(c => c.codePointAt(0));

// --- Unicode ---
ok(CL.isMark(0x064E) && CL.isMark(0x0651) && CL.isMark(0x0301) && !CL.isMark(0x0628), 'isMark');
ok(CL.joiningType(0x0628) === 'D' && CL.joiningType(0x0631) === 'R' && CL.joiningType(0x0627) === 'R' && CL.joiningType(0x0621) === 'U', 'joining types ب ر ا ء');
ok(CL.joiningType(0x0644) === 'D' && CL.joiningType(0x0648) === 'R' && CL.joiningType(0x0629) === 'R' && CL.joiningType(0x0649) === 'D', 'joining ل و ة ى');
ok(CL.joiningType(0x0640) === 'C' && CL.joiningType(0x064E) === 'T' && CL.joiningType(0xFEB3) === 'P', 'joining ـ َ presentation');
let c = cp('بب'); ok(CL.areJoined(c, 0, 1), 'بب liées');
c = cp('رب'); ok(!CL.areJoined(c, 0, 1), 'رب non liées');
c = cp('بَب'); ok(CL.areJoined(c, 0, 2), 'ب + fatha + ب liées (signe transparent)');
c = cp('ب ب'); ok(!CL.areJoined(c, 0, 2), 'espace coupe la liaison');
c = cp('ب\u200Cب'); ok(!CL.areJoined(c, 0, 2), 'ZWNJ coupe la liaison');
c = cp('بـب'); ok(CL.areJoined(c, 0, 2), 'tatwil garde la liaison');
c = cp('لا'); ok(CL.areJoined(c, 0, 1), 'lam-alef liées');
ok(JSON.stringify(CL.clusterBases(cp('aَّb'))) === '[0,0,0,3]', 'clusterBases');

// --- candidatePairs ---
const all = { latin: true, arabic: true, marks: true, stacked: true, window: 1 };
let s = cp('f) ab'); let hs = s.map(x => x !== 32);
let pr = CL.candidatePairs(s, hs, all);
ok(pr.length === 3 && pr[0].i === 0 && pr[0].j === 1 && pr[0].adjacent && pr[2].i === 3 && pr[2].j === 4, 'paires latines voisines');
ok(pr[1].i === 1 && pr[1].j === 3 && !pr[1].adjacent, 'paire à travers une espace');
pr = CL.candidatePairs(s, hs, Object.assign({}, all, { window: 2 }));
ok(pr.length === 5, 'fenêtre 2 (' + pr.length + ')');
s = cp('بَّب'); hs = s.map(() => true);
pr = CL.candidatePairs(s, hs, all);
ok(pr.some(p => p.kind === 'empiles' && p.i === 1 && p.j === 2), 'signes empilés');
ok(!pr.some(p => p.i === 0 && (p.j === 1 || p.j === 2)), 'signe sur sa propre lettre ignoré');
ok(!pr.some(p => p.i === 0 && p.j === 3), 'lettres liées ignorées');
ok(pr.some(p => p.kind === 'signe' && p.i === 1 && p.j === 3), 'signe contre lettre voisine');
s = cp('رب'); pr = CL.candidatePairs(s, [true, true], all);
ok(pr.length === 1 && pr[0].kind === 'arabe', 'رب : paire arabe');
pr = CL.candidatePairs(cp('ab\rcd'), [true, true, false, true, true], all);
ok(!pr.some(p => p.i === 1 && p.j === 3), 'pas de paire à travers un retour');
pr = CL.candidatePairs(cp('ab'), [true, true], Object.assign({}, all, { latin: false }));
ok(pr.length === 0, 'filtre latin');

// --- kernBoundary ---
s = cp('ab'); let base = CL.clusterBases(s);
ok(CL.kernBoundary(s, base, 0, 1, 'after').idx === 0 && CL.kernBoundary(s, base, 0, 1, 'before').idx === 1, 'kernBoundary after/before');
s = cp('a b'); base = CL.clusterBases(s);
ok(CL.kernBoundary(s, base, 0, 2, 'after').idx === 1 && CL.kernBoundary(s, base, 0, 2, 'before').idx === 2, 'kernBoundary à travers espace');
s = cp('بَل'); base = CL.clusterBases(s);
ok(CL.kernBoundary(s, base, 1, 2, 'after').idx === -1 && CL.kernBoundary(s, base, 1, 2, 'after').reason === 'lie', 'frontière liée non crénable');
s = cp('رَب'); base = CL.clusterBases(s);
ok(CL.kernBoundary(s, base, 1, 2, 'after').idx === 1, 'signe de ر contre ب : crénage après le signe');
s = cp('بَّ'); base = CL.clusterBases(s);
ok(CL.kernBoundary(s, base, 1, 2, 'after').reason === 'empiles', 'empilés non crénables');

// --- couleurs-codes ---
let rt = true;
for (let i = 0; i < 200000; i += 37) { if (CL.decodeIndex(CL.encodeIndex(i, 'cmyk'), 'cmyk') !== i || CL.decodeIndex(CL.encodeIndex(i, 'rgb'), 'rgb') !== i) rt = false; }
ok(rt, 'encode/decode aller-retour');
ok(CL.decodeIndex([5.0000001, 2.9999, 0, 0], 'cmyk') === 304, 'décodage arrondi');
ok(CL.decodeIndex([5, 3, 0, 100], 'cmyk') === -1, 'noir = couleur étrangère');

// --- géométrie ---
function rectRing(x0, y0, x1, y1) { return [x0, y0, x1, y0, x1, y1, x0, y1]; }
function circlePts(cx, cy, r, rev) {
  const k = 0.5522847498 * r;
  let p = [[cx + r, cy, cx + r, cy - k, cx + r, cy + k], [cx, cy + r, cx + k, cy + r, cx - k, cy + r], [cx - r, cy, cx - r, cy + k, cx - r, cy - k], [cx, cy - r, cx - k, cy - r, cx + k, cy - r]];
  if (rev) p = p.reverse().map(q => [q[0], q[1], q[4], q[5], q[2], q[3]]);
  return p;
}
const flat = CL.flattenRing(circlePts(0, 0, 100), true, 0.05);
let maxErr = 0; for (let i = 0; i < flat.length; i += 2) maxErr = Math.max(maxErr, Math.abs(Math.hypot(flat[i], flat[i + 1]) - 100));
ok(maxErr < 0.06, 'aplatissement cercle : sommets sur le cercle (' + maxErr.toFixed(4) + ')');
// erreur de corde / chord error
let chordErr = 0; for (let i = 0; i < flat.length; i += 2) { const j = (i + 2) % flat.length; const mx = (flat[i] + flat[j]) / 2, my = (flat[i + 1] + flat[j + 1]) / 2; chordErr = Math.max(chordErr, 100 - Math.hypot(mx, my)); }
ok(chordErr <= 0.05 + 0.03, 'aplatissement : flèche ≤ tolérance (' + chordErr.toFixed(4) + ')');

const straight = CL.flattenRing([[0, 0, 0, 0, 0, 0], [10, 0, 10, 0, 10, 0], [10, 10, 10, 10, 10, 10]], true, 0.01);
ok(straight.length === 6, 'segments droits : un seul segment chacun (' + straight.length / 2 + ' points)');
const coll = CL.flattenRing([[0, 0, 0, 0, 3, 0], [10, 0, 7, 0, 10, 0]], false, 0.01);
ok(coll.length === 4, 'poignées alignées sur la corde : segment droit');
const A = CL.makeShape([rectRing(0, 0, 10, 10)]);
const B = CL.makeShape([rectRing(13, 0, 20, 10)]);
let d = CL.shapeDistance(A, B, 0, 0, 100);
near(d.d, 3, 1e-9, 'distance rectangles');
d = CL.shapeDistance(A, B, -4, 0, 100); ok(d.overlap, 'chevauchement après décalage');
d = CL.shapeDistance(A, B, -3, 0, 100); near(d.d, 0, 1e-9, 'contact exact = 0');
const ring = CL.makeShape([CL.flattenRing(circlePts(0, 0, 50), true, 0.01), CL.flattenRing(circlePts(0, 0, 30, true), true, 0.01)]);
const dot = CL.makeShape([rectRing(-5, -5, 5, 5)]);
d = CL.shapeDistance(ring, dot, 0, 0, 100);
ok(!d.overlap && Math.abs(d.d - (30 - 5 * Math.SQRT2)) < 0.05, 'point dans le trou du o : pas de chevauchement (' + d.d + ')');
d = CL.shapeDistance(ring, dot, 40, 0, 100); ok(d.overlap, 'carré dans la couronne = chevauchement (contenu)');
ok(CL.inside(ring, 0, 0, 40, 0) && !CL.inside(ring, 0, 0, 0, 0), 'enroulement non nul avec trou');

// Diagonale : écart euclidien vs horizontal
const tri = CL.makeShape([[0, 0, 10, 0, 0, 10]]);
const sq = CL.makeShape([rectRing(8, 8, 12, 12)]);
d = CL.shapeDistance(tri, sq, 0, 0, 100);
near(d.d, 6 / Math.SQRT2, 1e-9, 'distance diagonale');

// refineShift : propriété sur formes aléatoires / property on random shapes
function randPoly(cx, cy, r, n, rnd) {
  const pts = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; const rr = r * (0.4 + 0.6 * rnd()); pts.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } return pts;
}
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let worst = 0, cnt = 0, bad = 0;
for (let t = 0; t < 600; t++) {
  const P = CL.makeShape([randPoly(0, 0, 10, 5 + Math.floor(rnd() * 12), rnd)]);
  const Q = CL.makeShape([randPoly(10 + rnd() * 10 - 6, rnd() * 8 - 4, 10, 5 + Math.floor(rnd() * 12), rnd)]);
  const ang = (rnd() - 0.5) * 0.6, ux = Math.cos(ang), uy = Math.sin(ang);
  const g = rnd() < 0.3 ? 0 : rnd() * 3;
  const sft = CL.refineShift(P, Q, ux, uy, g, 0.03, 1e-6);
  if (sft === -Infinity) continue;
  cnt++;
  const r1 = CL.shapeDistance(P, Q, sft * ux, sft * uy, g + 5);
  const dd = r1.overlap ? -1 : r1.d;
  if (dd < g - 1e-4) bad++;
  // minimalité : un peu moins de décalage => écart insuffisant
  const r2 = CL.shapeDistance(P, Q, (sft - 0.01) * ux, (sft - 0.01) * uy, g + 5);
  const d2 = r2.overlap ? -1 : r2.d;
  if (!(d2 < g + 1e-6)) bad++;
  worst = Math.max(worst, Math.abs(dd - g));
}
ok(bad === 0 && cnt > 400, `refineShift sur ${cnt} paires aléatoires : écart atteint et minimal (échecs ${bad}, écart max ${worst.toFixed(5)})`);

// clearanceShift est une borne haute / is an upper bound
let ub = true;
for (let t = 0; t < 300; t++) {
  const P = CL.makeShape([randPoly(0, 0, 10, 8, rnd)]), Q = CL.makeShape([randPoly(12, 0, 10, 8, rnd)]);
  const g = rnd() * 2, s0 = CL.clearanceShift(P, Q, 1, 0, g, 0.05), s1 = CL.refineShift(P, Q, 1, 0, g, 0.05, 1e-6);
  if (s0 !== -Infinity && s1 > s0 + 0.06) ub = false;
}
ok(ub, 'clearanceShift ≥ décalage exact (borne prudente)');

// distance comparée à une recherche brute / vs brute force
let bf = true;
for (let t = 0; t < 150; t++) {
  const p1 = randPoly(0, 0, 10, 7, rnd), p2 = randPoly(25 + rnd() * 5, rnd() * 10 - 5, 10, 7, rnd);
  const P = CL.makeShape([p1]), Q = CL.makeShape([p2]);
  const r = CL.shapeDistance(P, Q, 0, 0, 100);
  // brute : points échantillonnés sur les arêtes
  const samp = (pp) => { const o = []; const m = pp.length / 2; for (let i = 0; i < m; i++) { const j = (i + 1) % m; for (let s = 0; s <= 50; s++) { o.push([pp[2 * i] + (pp[2 * j] - pp[2 * i]) * s / 50, pp[2 * i + 1] + (pp[2 * j + 1] - pp[2 * i + 1]) * s / 50]); } } return o; };
  const a = samp(p1), b = samp(p2); let m = Infinity;
  for (const x of a) for (const y of b) m = Math.min(m, Math.hypot(x[0] - y[0], x[1] - y[1]));
  if (!r.overlap && (r.d > m + 1e-9 || r.d < m - 0.5)) bf = false;
}
ok(bf, 'distance exacte cohérente avec la recherche brute');

// --- nextKerning ---
let st = { k0: 0, k: 0, kPrev: null, sPrev: null };
let r = CL.nextKerning(st, 1.2, 0.1, 300, 1, 0.005); ok(r.k === 13, 'crénage estimé (' + r.k + ')');
r = CL.nextKerning({ k0: 0, k: 0, kPrev: null, sPrev: null }, 100, 0.1, 300, 1, 0.005); ok(r.k === 300 && r.capped, 'plafond');
r = CL.nextKerning({ k0: 0, k: 40, kPrev: 0, sPrev: 1 }, -2, 0.1, 300, 2, 0.005); ok(r.k === 21 && !r.capped, 'réduction d\'un excès (' + r.k + ')');
r = CL.nextKerning({ k0: 10, k: 12, kPrev: 10, sPrev: 0.5 }, -5, 0.1, 300, 2, 0.005); ok(r.k === 10, 'jamais sous k0');
r = CL.nextKerning({ k0: 0, k: 61, kPrev: 0, sPrev: 3.05, kFloor: -100 }, -4.97, 0.05, 300, 2, 0.0025); ok(r.k >= -39 && r.k <= -37, 'plancher du crénage auto (' + r.k + ')');
ok(CL.kerningFloor(0, 0, 61, 3.05, -5, 0.05) === -100, 'crénage auto retrouvé : −100');
ok(CL.kerningFloor(0, 0, 61, 3.05, -0.0, 0.05) === 0, 'pas de crénage auto');
r = CL.nextKerning({ k0: 0, k: 10, kPrev: 0, sPrev: 1 }, 0.5, 0.1, 300, 3, 0.005); ok(r.k === 20 || r.k === 21, 'pente observée (' + r.k + ')');
r = CL.nextKerning({ k0: 0, k: 0, kPrev: null, sPrev: null }, -Infinity, 0.1, 300, 1, 0.005); ok(r.k === 0, 'aucune contrainte');

// --- étiquette ---
const tg = CL.encodeTag(42, { 3: 0, 17: -25 });
const dt = CL.decodeTag(tg);
ok(dt.n === 42 && dt.map[3] === 0 && dt.map[17] === -25, 'étiquette aller-retour');
ok(CL.decodeTag('xx') === null && CL.decodeTag('') === null, 'étiquette invalide');

// --- divers ---
near(CL.toPt(25.4, 'mm'), 72, 1e-9, 'mm -> pt');
ok(CL.parseNum('0,3') === 0.3 && isNaN(CL.parseNum('abc')), 'parseNum');
ok(CL.fmt(-0.123, 2, 'fr') === '\u22120,12' && CL.fmt(0.001, 2, 'fr') === '0,00', 'fmt');
ok(CL.isItalicRoman('Italic', 'Regular') && !CL.isItalicRoman('Bold', 'Regular') && !CL.isItalicRoman('Italic', 'Bold Italic'), 'italique / romain');
ok(CL.fontExcluded('Pacifico-Regular', 'brush, pacif') && !CL.fontExcluded('Arial', 'brush'), 'polices exclues');
ok(CL.isCursive(10, 8) && !CL.isCursive(10, 2) && !CL.isCursive(3, 3), 'cursive');
ok(!CL.isCursive(10, 10, false, true, false) && !CL.isCursive(10, 10, false, false, true) && CL.isCursive(10, 5, true, true, true), 'cursive : texte curviligne / approche négative / nom de police');
ok(CL.CURSIVE_RE.test('Pacifico-Regular') && CL.CURSIVE_RE.test('BrushScriptMT') && !CL.CURSIVE_RE.test('Montserrat-Bold') && !CL.CURSIVE_RE.test('Cairo-Regular'), 'noms de polices cursives');
const ser = CL.serialize({ a: 1, b: true, c: 'x,y' });
const de = CL.deserialize(ser, { a: 0, b: false, c: '', d: 5 });
ok(de.a === 1 && de.b === true && de.c === 'x,y' && de.d === 5, 'réglages aller-retour');

console.log(`core: ${pass} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
