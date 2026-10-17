// Tests sur document Illustrator simulé (test/mock.js) — ce n'est PAS Illustrator.
// Tests on a simulated Illustrator document (test/mock.js) — this is NOT Illustrator.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeEnv, refGap, CMYKColor, NoColor } = require('./mock');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ContactsLettres.jsx'), 'utf8');

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('ÉCHEC / FAIL:', msg); } if (process.env.VERBOSE) console.log((c ? 'ok   ' : 'FAIL ') + msg); }

// ---- ScriptUI simulé / simulated ScriptUI ----
function makeWindowClass(env) {
  class Ctl {
    constructor(type, text, props, parent) {
      this.type = type; this.text = text === undefined ? '' : (Array.isArray(text) ? '' : String(text)); this.props = props || {}; this.children = []; this.parent = parent;
      this.value = false; this.enabled = true; this._sel = null; this.items = Array.isArray(text) ? text.map((t, i) => ({ text: t, index: i })) : [];
      if (type === 'item') this.subItems = Array.from({ length: 4 }, () => ({ text: '' }));
      this.subItems = this.subItems || [];
    }
    add(type, bounds, text, props) {
      if (typeof bounds === 'string' && type !== 'item') { props = text; text = bounds; }
      if (type === 'item') { const it = new Ctl('item', bounds, {}, this); this.items.push(it); this.children.push(it); return it; }
      const c = new Ctl(type, text, props, this); this.children.push(c); env.ctls.push(c); return c;
    }
    get selection() { return this._sel; }
    set selection(v) { if (typeof v === 'number') this._sel = v >= 0 && v < this.items.length ? this.items[v] : null; else this._sel = v; }
    close(v) { this.closed = v; }
  }
  class Window extends Ctl {
    constructor(type, title) { super('window', title); this.title = title; env.ctls = []; }
    show() { env.windows.push(this); const f = env.onShow.shift(); if (f) f(this, env.ctls.slice()); return this.closed; }
  }
  return Window;
}
function find(ctls, type, text) { return ctls.find(c => c.type === type && c.text === text); }

function load(opts) {
  const env = makeEnv(opts);
  env.ctls = []; env.windows = []; env.onShow = [];
  const ctx = Object.assign({}, env.globals);
  ctx.Window = makeWindowClass(env);
  ctx.__CONTACTS_LETTRES_TEST__ = {};
  ctx.$ = { locale: env.globals.$.locale, global: ctx };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ContactsLettres.jsx' });
  const T = ctx.__CONTACTS_LETTRES_TEST__;
  env.T = T; env.ctx = ctx;
  return env;
}
function opts(env, o) { return env.T.buildOpts(Object.assign({}, env.T.DEFAULTS, { scope: 'doc' }, o || {}), env.doc); }
const sizeOf = (tf, k) => tf._chars[k].a.size;

// 1. f) — deux conventions de crénage / both kerning conventions
for (const conv of ['after', 'before']) {
  const env = load({ conv });
  const tf = env.doc.addText('f)', { size: 20 });
  ok(refGap(tf, 0, 1) < 0.01, conv + ' : f) se chevauchent au départ');
  let R = env.T.run(env.doc, opts(env), false);
  ok(R.analysed === 1 && R.issues.length === 1 && R.issues[0].kind === 'lettres' && R.issues[0].overlap && R.issues[0].kernable, conv + ' : f) trouvé');
  ok(R.issues[0].dVis < -0.3 && R.issues[0].dVis > -0.5, conv + ' : profondeur ≈ −0,4 pt (' + R.issues[0].dVis + ')');
  ok(tf._chars[0].k === 0 && tf._chars[1].k === 0, conv + ' : Analyser ne modifie rien');
  R = env.T.run(env.doc, opts(env), true);
  const g = refGap(tf, 0, 1);
  ok(R.fixed.length === 1 && R.issues.length === 0, conv + ' : corrigé (' + R.fixed.length + '/' + R.issues.length + ')');
  ok(g >= 0.03 - 0.005 && g < 0.03 + 0.25, conv + ' : écart final juste suffisant (' + g.toFixed(3) + ' pt)');
  const kc = conv === 'after' ? 0 : 1;
  ok(tf._chars[kc].k > 0 && tf._chars[1 - kc].k === 0, conv + ' : crénage posé sur le bon caractère');
  ok(tf._tags.length === 1 && tf._tags[0].name === 'ContactsLettresKern', conv + ' : étiquette d\'origine');
  ok(!env.doc._layers.some(l => l.name === '__ContactsLettres_tmp__'), conv + ' : calque temporaire supprimé');
  // relance : rien à faire / rerun: nothing to do
  const k1 = tf._chars[kc].k;
  R = env.T.run(env.doc, opts(env), true);
  ok(R.found === 0 && R.fixed.length === 0 && tf._chars[kc].k === k1, conv + ' : second passage sans effet');
  // Rétablir / restore
  const rr = env.T.restoreFrames([tf]);
  ok(rr.done === 1 && tf._chars[kc].k === 0 && tf._tags.length === 0, conv + ' : crénage d\'origine rétabli');
}

// 2. Texte sain / clean text
{
  const env = load();
  env.doc.addText('HH oo in', { size: 24 });
  const R = env.T.run(env.doc, opts(env), false);
  ok(R.found === 0 && R.issues.length === 0, 'texte sans contact : rien signalé');
  ok(!env.doc._layers.some(l => l.name.indexOf('Contacts lettres') === 0), 'pas de calque de repères sans problème');
}

// 3. Crénage automatique remplacé (AV -100) / auto kerning dropped by manual kerning
{
  const env = load();
  const tf = env.doc.addText('AV', { size: 50 });
  ok(refGap(tf, 0, 1) < 0.01, 'AV se chevauche (crénage auto)');
  const R = env.T.run(env.doc, opts(env), true);
  const g = refGap(tf, 0, 1);
  ok(R.issues.length === 0 && R.fixed.length === 1, 'AV corrigé');
  ok(g >= 0.075 - 0.01 && g < 0.075 + 0.3, 'AV : pas de sur-correction malgré la perte du crénage auto (' + g.toFixed(3) + ' pt, crénage ' + tf._chars[0].k + ')');
}

// 4. Arabe / Arabic
{
  const env = load();
  const t1 = env.doc.addText('\u0628\u0628', { size: 30 }, { rtl: true, anchor: [500, 800] });
  ok(refGap(t1, 0, 1) < 0.01, 'بب : les traits de liaison se touchent (normal)');
  const t2 = env.doc.addText('\u0631\u0628', { size: 30 }, { rtl: true, anchor: [500, 700] });
  ok(refGap(t2, 0, 1) < 0.01, 'رب : la queue du ر touche le point du ب');
  const t3 = env.doc.addText('\u0628\u0651\u064E', { size: 30 }, { rtl: true, anchor: [500, 600] });
  const t4 = env.doc.addText('\u0628\u064E\u0644', { size: 30 }, { rtl: true, anchor: [500, 500] });
  let R = env.T.run(env.doc, opts(env), false);
  const by = tf => R.issues.filter(i => i.tf === tf);
  ok(by(t1).length === 0, 'بب : lettres liées jamais signalées');
  ok(by(t2).length === 1 && by(t2)[0].kind === 'arabe' && by(t2)[0].kernable, 'رب : contact signalé et corrigeable');
  ok(by(t3).length === 1 && by(t3)[0].kind === 'empiles' && !by(t3)[0].kernable, 'بَّ : signes empilés signalés, non corrigeables');
  ok(by(t4).length === 1 && by(t4)[0].kind === 'signe' && by(t4)[0].reason === 'lie', 'بَل : fatha contre ل, frontière liée');
  R = env.T.run(env.doc, opts(env), true);
  ok(refGap(t2, 0, 1) >= 0.045 - 0.005, 'رب corrigé (' + refGap(t2, 0, 1).toFixed(3) + ')');
  ok(t1._chars.every(c => c.k === 0) && t3._chars.every(c => c.k === 0) && t4._chars.every(c => c.k === 0), 'aucun crénage entre lettres liées ou sur signes empilés');
  ok(R.issues.length === 2, 'restent les 2 cas non corrigeables (' + R.issues.length + ')');
  const ly = env.doc._layers.find(l => l.name.indexOf('Contacts lettres') === 0);
  ok(ly && ly.printable === false && ly.locked === true, 'calque de repères non imprimable et verrouillé');
  const ell = ly._items.filter(i => i.ellipse), labels = ly._items.filter(i => i.typename === 'TextFrame');
  ok(ell.length === 3 && labels.length === 2, 'repères : 2 restants + 1 corrigé (' + ell.length + ', ' + labels.length + ')');
  ok(ell.filter(e => e.strokeColor.cyan === 80).length === 2 && ell.filter(e => e.strokeColor.cyan === 70).length === 1, 'couleurs : bleu (non corrigeable) et vert (corrigé)');
}

// 5. Police cursive liée / connected script font
{
  const env = load();
  env.doc.addText('Hinuniu', { size: 20, font: 'MockScript' });
  let R = env.T.run(env.doc, opts(env), false);
  ok(R.cursive === 1 && R.issues.length === 0, 'police cursive détectée et ignorée');
  R = env.T.run(env.doc, opts(env, { skipCursive: false }), false);
  ok(R.issues.length >= 5, 'sans la détection : contacts signalés (' + R.issues.length + ')');
}

// 5b. Titre très serré (approche négative) : jamais pris pour une cursive / tight tracking is not cursive
{
  const env = load();
  const tf = env.doc.addText('HHHHHH', { size: 20, tracking: -200 });
  let R = env.T.run(env.doc, opts(env), false);
  ok(R.cursive === 0 && R.issues.length === 5, 'approche −200 : 5 contacts signalés (' + R.issues.length + ')');
  R = env.T.run(env.doc, opts(env), true);
  let mn = Infinity; for (let k = 0; k < 5; k++) mn = Math.min(mn, refGap(tf, k, k + 1));
  ok(R.issues.length === 0 && mn >= 0.025 && mn < 0.3, 'approche −200 corrigée par crénage (' + mn.toFixed(3) + ')');
}

// 6. Polices ignorées, filtres / ignored fonts, filters
{
  const env = load();
  env.doc.addText('f)', { size: 20 });
  ok(env.T.run(env.doc, opts(env, { fontsIgnore: 'zzz, mocksans' }), false).issues.length === 0, 'police ignorée par la liste');
  ok(env.T.run(env.doc, opts(env, { latin: false }), false).issues.length === 0, 'contrôle latin désactivé');
}

// 7. Texte tourné et agrandi / rotated and scaled text
{
  const env = load();
  const tf = env.doc.addText('Tf)', { size: 18 }, { angle: 30 * Math.PI / 180, scale: 1.5 });
  const R = env.T.run(env.doc, opts(env), true);
  const g = refGap(tf, 1, 2);
  ok(R.issues.length === 0 && g >= 0.0015 * 18 * 1.5 - 0.01 && g < 0.6, 'texte tourné 30° ×1,5 corrigé (' + g.toFixed(3) + ')');
}

// 8. mm (découpe vinyle) et % du corps / mm (vinyl cutting) and % of size
{
  const env = load();
  const tf = env.doc.addText('III', { size: 3 });
  const gap0 = refGap(tf, 0, 1);
  let R = env.T.run(env.doc, opts(env, { value: 0.3, unit: 'mm' }), false);
  ok(R.issues.length === 2 && !R.issues[0].overlap, 'III à 3 pt : 2 paires trop proches pour 0,3 mm (' + (gap0 * 25.4 / 72).toFixed(3) + ' mm)');
  R = env.T.run(env.doc, opts(env, { value: 0.3, unit: 'mm' }), true);
  const g1 = refGap(tf, 0, 1) * 25.4 / 72, g2 = refGap(tf, 1, 2) * 25.4 / 72;
  ok(R.issues.length === 0 && g1 >= 0.299 && g2 >= 0.299 && g1 < 0.33, 'écarts portés à 0,3 mm (' + g1.toFixed(3) + ', ' + g2.toFixed(3) + ')');
  const env2 = load();
  const t2 = env2.doc.addText('HH', { size: 10 });   // écart 1,6 pt = 16 % du corps
  ok(env2.T.run(env2.doc, opts(env2, { value: 15, unit: 'pct' }), false).issues.length === 0, '15 % : écart de 16 % accepté');
  ok(env2.T.run(env2.doc, opts(env2, { value: 20, unit: 'pct' }), false).issues.length === 1, '20 % : écart de 16 % signalé');
}

// 9. Contours des caractères / character strokes
{
  const env = load();
  const st = new CMYKColor(); st.black = 100;
  const tf = env.doc.addText('IH', { size: 10, stroke: st, sw: 2 });
  const R = env.T.run(env.doc, opts(env), true);   // remplissages à 1,8 pt, contours de 1 pt de chaque côté
  const g = refGap(tf, 0, 1) - 2;
  ok(R.found === 1 && R.issues.length === 0 && g >= 0.015 - 0.005 && g < 0.25, 'contour pris en compte (écart visible ' + g.toFixed(3) + ' pt)');
}

// 10. Texte sur cercle (badge) / text on a circle
{
  const env = load();
  const tf = env.doc.addText('HHHHHH', { size: 20 }, { path: { cx: 500, cy: 500, r: 45 } });
  let R = env.T.run(env.doc, opts(env), false);
  ok(R.issues.length === 5, 'texte sur cercle : sommets des lettres qui se touchent (' + R.issues.length + ')');
  R = env.T.run(env.doc, opts(env), true);
  let mn = Infinity; for (let k = 0; k < 5; k++) mn = Math.min(mn, refGap(tf, k, k + 1));
  ok(R.issues.length === 0 && mn >= 0.025, 'texte sur cercle corrigé (écart min ' + mn.toFixed(3) + ')');
}

// 11. Exclusions / skipped texts
{
  const env = load();
  const locked = env.doc.addLayer('verrouillé'); locked.locked = true;
  env.doc.addText('f)', {}, {}, locked);
  const h = env.doc.addText('f)'); h.hidden = true;
  const th = env.doc.addText('f)'); th.nextFrame = {};
  const nt = env.doc.addText('f)'); nt.note = 'ok #contacts-ok';
  env.doc.addText('f) f) f) f)');
  const R = env.T.run(env.doc, opts(env, { maxChars: 5 }), false);
  ok(R.analysed === 0 && R.skipped.locked === 2 && R.skipped.thread === 1 && R.skipped.note === 1 && R.skipped['long'] === 1, 'textes ignorés comptés : ' + JSON.stringify(R.skipped));
}

// 12. Portée sélection, groupes / selection scope, groups
{
  const env = load();
  const a = env.doc.addText('f)'), b = env.doc.addText('f)');
  env.doc.selection = [a];
  let R = env.T.run(env.doc, opts(env, { scope: 'sel' }), false);
  ok(R.frames === 1 && R.issues.length === 1 && R.issues[0].tf === a, 'portée sélection');
  ok(env.T.selectFrames(env.doc, R) === 1 && a.selected && !b.selected, 'sélection des textes à corriger');
  ok(/ContactsLettres/.test(env.T.reportText(R)) && env.T.reportText(R).split('\n').length >= 5, 'rapport texte');
}

// 13. Document RVB, apparence supplémentaire ignorée / RGB document, extra appearance ignored
{
  const env = load({ cs: 'RGB' });
  const tf = env.doc.addText('f)', { size: 20 });
  tf.extraAppearance = true;
  const R = env.T.run(env.doc, opts(env), true);
  ok(R.issues.length === 0 && R.fixed.length === 1 && refGap(tf, 0, 1) > 0.02, 'document RVB corrigé');
}

// 14. Étiquette : l'origine la plus ancienne est gardée / oldest original kept
{
  const env = load();
  const tf = env.doc.addText('f)', { size: 20 });
  tf._chars[0].k = -30; tf._chars[0].manual = true;
  env.T.run(env.doc, opts(env), true);
  const k1 = tf._chars[0].k;
  env.T.run(env.doc, opts(env, { value: 0.5, unit: 'mm' }), true);
  ok(tf._chars[0].k > k1, 'deuxième correction plus large');
  env.T.restoreFrames([tf]);
  ok(tf._chars[0].k === -30, 'Rétablir revient au crénage manuel d\'origine (−30)');
  // texte modifié depuis : ignoré / text edited since: skipped
  env.T.run(env.doc, opts(env), true);
  tf._chars.push(new (tf._chars[0].constructor)('o'));
  const rr = env.T.restoreFrames([tf]);
  ok(rr.done === 0 && rr.skipped === 1, 'texte modifié depuis : pas de rétablissement');
}

// 15. Programme principal avec dialogues simulés / main program with simulated dialogs
{
  const env = load();
  const tf = env.doc.addText('f)', { size: 20 });
  env.doc.selection = [tf];
  env.onShow.push((w, c) => { find(c, 'radiobutton', 'Document').value = true; find(c, 'radiobutton', 'Sélection').value = false; find(c, 'button', 'Analyser').onClick(); });
  env.onShow.push((w, c) => { ok(c.some(x => x.type === 'listbox' && x.items.length === 1), 'dialogue résultat : 1 ligne'); find(c, 'button', 'Corriger maintenant').onClick(); });
  env.onShow.push((w, c) => { const lb = c.find(x => x.type === 'listbox'); ok(lb && /corrigé/.test(lb.items[0].subItems[3].text), 'dialogue résultat après correction'); find(c, 'button', 'Fermer').onClick(); });
  env.T.main();
  ok(env.windows.length === 3 && refGap(tf, 0, 1) > 0.02 && env.confirms === 1, 'parcours complet Analyser → Corriger maintenant');
  ok(fs.existsSync(path.join(env.tmpdir, 'ContactsLettres.cfg')) && /scope=doc/.test(fs.readFileSync(path.join(env.tmpdir, 'ContactsLettres.cfg'), 'utf8')), 'réglages mémorisés');
  // préréglage -> champs / preset -> fields
  env.onShow.push((w, c) => {
    const dd = c.find(x => x.type === 'dropdownlist' && x.items.length === 6);
    dd.selection = 2; dd.onChange();
    const e = c.find(x => x.type === 'edittext' && x.characters === 7);
    ok(e.text === '0,30' && c.find(x => x.type === 'dropdownlist' && x.items.length === 3).selection.index === 1, 'préréglage vinyle : 0,30 mm');
    e.text = 'abc'; find(c, 'button', 'Analyser').onClick();
    ok(env.alerts.some(a => /Valeur incorrecte/.test(a)), 'valeur incorrecte refusée');
    find(c, 'button', 'Fermer').onClick();
  });
  env.T.main();
  // rien de sélectionné / nothing selected
  env.doc.selection = [];
  env.onShow.push((w, c) => { find(c, 'radiobutton', 'Sélection').value = true; find(c, 'radiobutton', 'Document').value = false; find(c, 'button', 'Analyser').onClick(); });
  env.T.main();
  ok(/Rien n'est sélectionné/.test(env.alerts[env.alerts.length - 1]), 'message si rien n\'est sélectionné');
  // Effacer les repères / clear markers
  env.onShow.push((w, c) => { find(c, 'button', 'Effacer les repères').onClick(); });
  env.T.main();
  ok(/Rep[èe]res effac|Aucun calque/.test(env.alerts[env.alerts.length - 1]), 'Effacer les repères');
  // pas de document / no document
  env.ctx.app.documents = { length: 0 };
  env.T.main();
  ok(/Aucun document/.test(env.alerts[env.alerts.length - 1]), 'message sans document');
}

// 16. Interface anglaise / English UI
{
  const env = load({ locale: 'en_US' });
  ok(env.T.L.bAnalyse === 'Analyse' && env.T.L.presets.length === 6, 'interface anglaise');
}

// 17. Performance simulée / simulated cost : un paragraphe de 400 caractères
{
  const env = load();
  const txt = ('Tif) inu HHoo ').repeat(28);
  env.doc.addText(txt, { size: 12 });
  const t0 = Date.now();
  const R = env.T.run(env.doc, opts(env), true);
  ok(R.issues.length === 0 && R.fixed.length >= 28, 'paragraphe de ' + txt.length + ' caractères : ' + R.fixed.length + ' paires corrigées en ' + (Date.now() - t0) + ' ms (node), ' + env.stats.outlines + ' vectorisations');
}

console.log(`dom: ${pass} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
