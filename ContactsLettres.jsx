//@target illustrator
/*
 * ContactsLettres.jsx — v1.0.0 (2026-10-17)
 * Copyright (c) 2026 Amirouche Amwanes — Licence MIT (voir LICENSE / see LICENSE)
 * https://github.com/salimadour31-boop/illustrator-contacts-lettres
 *
 * FR : Trouve dans les textes vivants les lettres qui se touchent, se chevauchent ou sont
 *      trop proches À L'INTÉRIEUR d'une ligne (crénage ou approche trop serrés, italique
 *      contre romain, f) f? l’, queues de ر و ن contre le mot suivant, signes arabes qui
 *      heurtent la lettre voisine ou s'empilent), en mesurant la forme réelle des lettres
 *      sur une copie vectorisée temporaire. Corrige ensuite par crénage la seule paire
 *      concernée jusqu'à l'écart voulu (contact, % du corps, ou mm pour la découpe vinyle /
 *      laser), sans jamais séparer deux lettres arabes liées. Repères sur calque non
 *      imprimable, rapport .txt, Rétablir le crénage d'origine.
 * EN : Finds letters that touch, overlap or sit too close WITHIN a line of live text,
 *      measured on the real glyph outlines of a temporary outlined copy, then fixes them by
 *      kerning only the offending pair up to the wanted gap; never separates joined
 *      Arabic letters. Non-printing markers, .txt report, restore original kerning.
 *
 * Code 100 % original. Aucun appel réseau, aucune collecte de données.
 * 100 % original code. No network calls, no data collection.
 * Non testé dans Illustrator (syntaxe et logique vérifiées hors Illustrator).
 * Not tested inside Illustrator (syntax and logic checked outside Illustrator).
 * Travaillez sur une copie du fichier / work on a copy of your file.
 */

(function () {

    // =====================================================================
    // @@CORE-BEGIN — fonctions pures, testables hors Illustrator
    //               pure functions, testable outside Illustrator
    // =====================================================================
    var CL = {};
    CL.VERSION = '1.0.0';
    CL.TAG = 'ContactsLettresKern';                 // étiquette du crénage d'origine / original-kerning tag
    CL.MARK_LAYER = 'Contacts lettres \u2013 rep\u00E8res';
    CL.TMP_LAYER = '__ContactsLettres_tmp__';

    // ---------------------------------------------------------------------
    // Unicode : signes (diacritiques), arabe, liaisons
    // Unicode: marks (diacritics), Arabic, joining
    // ---------------------------------------------------------------------
    function inRanges(c, R) {
        for (var k = 0; k < R.length; k += 2) {
            if (c >= R[k] && c <= R[k + 1]) { return true; }
        }
        return false;
    }

    // Signes combinants (latin, hébreu, arabe, tifinagh) / combining marks
    var MARKS = [0x0300, 0x036F, 0x0483, 0x0489, 0x0591, 0x05BD, 0x05BF, 0x05BF, 0x05C1, 0x05C2,
        0x05C4, 0x05C5, 0x05C7, 0x05C7, 0x0610, 0x061A, 0x064B, 0x065F, 0x0670, 0x0670,
        0x06D6, 0x06DC, 0x06DF, 0x06E4, 0x06E7, 0x06E8, 0x06EA, 0x06ED, 0x0898, 0x089F,
        0x08CA, 0x08E1, 0x08E3, 0x08FF, 0x1AB0, 0x1AFF, 0x1DC0, 0x1DFF, 0x20D0, 0x20FF,
        0x2D7F, 0x2D7F, 0xFE20, 0xFE2F];

    // Lettres arabes à liaison droite seulement (type R d'Unicode ArabicShaping.txt)
    // Right-joining Arabic letters (Unicode joining type R)
    var AR_R = [0x0622, 0x0625, 0x0627, 0x0627, 0x0629, 0x0629, 0x062F, 0x0632, 0x0648, 0x0648,
        0x0671, 0x0673, 0x0675, 0x0677, 0x0688, 0x0699, 0x06C0, 0x06C0, 0x06C3, 0x06CB,
        0x06CD, 0x06CD, 0x06CF, 0x06CF, 0x06D2, 0x06D3, 0x06D5, 0x06D5, 0x06EE, 0x06EF,
        0x0759, 0x075B, 0x076B, 0x076C, 0x0771, 0x0771, 0x0773, 0x0774, 0x0778, 0x0779,
        0x08AA, 0x08AC, 0x08AE, 0x08AE, 0x08B1, 0x08B2, 0x08B9, 0x08B9];

    // Lettres arabes à double liaison (type D) / dual-joining Arabic letters
    var AR_D = [0x0620, 0x0620, 0x0626, 0x0626, 0x0628, 0x0628, 0x062A, 0x062E, 0x0633, 0x063F,
        0x0641, 0x0647, 0x0649, 0x064A, 0x066E, 0x066F, 0x0678, 0x0687, 0x069A, 0x06BF,
        0x06C1, 0x06C2, 0x06CC, 0x06CC, 0x06CE, 0x06CE, 0x06D0, 0x06D1, 0x06FA, 0x06FC,
        0x06FF, 0x06FF, 0x0750, 0x077F, 0x08A0, 0x08A9, 0x08AF, 0x08B0, 0x08B3, 0x08B8,
        0x08BA, 0x08C8];

    CL.isMark = function (c) { return inRanges(c, MARKS); };

    CL.isArabic = function (c) {
        return (c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) ||
            (c >= 0x0870 && c <= 0x08FF) || (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF);
    };

    CL.isPresentation = function (c) {
        return (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF);
    };

    /**
     * Type de liaison : 'T' transparent (signe), 'C' provoque la liaison (tatwīl ـ, ZWJ),
     * 'R' liaison à droite, 'D' double, 'P' forme de présentation (déjà façonnée), 'U' aucune.
     * Joining type: T transparent, C join-causing, R right, D dual, P presentation form, U none.
     */
    CL.joiningType = function (c) {
        if (CL.isMark(c)) { return 'T'; }
        if (c === 0x0640 || c === 0x200D || c === 0x07FA) { return 'C'; }
        if (CL.isPresentation(c)) { return 'P'; }
        if (inRanges(c, AR_R)) { return 'R'; }
        if (inRanges(c, AR_D)) { return 'D'; }
        return 'U';
    };

    /** Fin de ligne / tabulation : on ne compare jamais au-delà. Line end / tab: never compared across. */
    CL.isBreak = function (c) {
        return c === 13 || c === 10 || c === 3 || c === 9 || c === 0x2028 || c === 0x2029;
    };

    /** Entre a et b (exclus) il n'y a que des signes ou des liants. Only marks/joiners between a and b. */
    CL.noSpaceBetween = function (cps, a, b) {
        for (var k = a + 1; k < b; k++) {
            var t = CL.joiningType(cps[k]);
            if (t !== 'T' && t !== 'C') { return false; }
        }
        return true;
    };

    /**
     * Les lettres a < b (ordre logique) sont-elles liées (contact voulu par l'écriture) ?
     * Are letters a < b (logical order) joined (contact intended by the script)?
     */
    CL.areJoined = function (cps, a, b) {
        if (!CL.noSpaceBetween(cps, a, b)) { return false; }
        var ja = CL.joiningType(cps[a]), jb = CL.joiningType(cps[b]);
        // Formes de présentation : liaison inconnue, on suppose liées (prudence, pas de fausse alerte)
        // Presentation forms: joining unknown, assume joined (cautious, no false alarm)
        if (ja === 'P' || jb === 'P') { return CL.isArabic(cps[a]) && CL.isArabic(cps[b]); }
        return (ja === 'D' || ja === 'C') && (jb === 'D' || jb === 'R' || jb === 'C');
    };

    /** Index de la lettre de base de chaque caractère (un signe appartient à la lettre qui le précède). */
    CL.clusterBases = function (cps) {
        var base = [], i;
        for (i = 0; i < cps.length; i++) {
            if (i > 0 && CL.isMark(cps[i]) && !CL.isBreak(cps[i - 1])) { base[i] = base[i - 1]; }
            else { base[i] = i; }
        }
        return base;
    };

    /**
     * Paires de caractères à mesurer. Pairs of characters to measure.
     * o.window : nombre de lettres suivantes comparées (1 = voisine immédiate, espaces ignorées)
     * o.latin / o.arabic / o.marks / o.stacked : familles de contrôles
     * Résultat / result : [{i, j, kind, adjacent}] ; kind = 'lettres' | 'arabe' | 'signe' | 'empiles'
     */
    CL.candidatePairs = function (cps, hasShape, o) {
        var n = cps.length, base = CL.clusterBases(cps), out = [], i, j, cnt, mi, mj, kind, adjacent;
        var win = o.window || 1, maxRaw = o.maxRaw || 12;
        for (i = 0; i < n; i++) {
            if (!hasShape[i]) { continue; }
            mi = CL.isMark(cps[i]);
            cnt = 0;
            for (j = i + 1; j < n && j <= i + maxRaw; j++) {
                if (CL.isBreak(cps[j])) { break; }
                mj = CL.isMark(cps[j]);
                if (!mj && hasShape[j]) {
                    cnt++;
                    if (cnt > win) { break; }
                }
                if (!hasShape[j]) { continue; }
                kind = null;
                adjacent = false;
                if (mj) {
                    if (base[j] === base[i]) { kind = mi ? 'empiles' : null; } // son propre signe : ignoré / own mark: skipped
                    else { kind = 'signe'; }
                } else if (mi) {
                    kind = 'signe';
                } else if (CL.isArabic(cps[i]) || CL.isArabic(cps[j])) {
                    if (CL.areJoined(cps, i, j)) { kind = null; } // lettres liées : contact normal / joined: normal contact
                    else { kind = 'arabe'; }
                } else {
                    kind = 'lettres';
                    adjacent = (cnt === 1) && CL.noSpaceBetween(cps, i, j);
                }
                if (kind === 'lettres' && !o.latin) { kind = null; }
                if (kind === 'arabe' && !o.arabic) { kind = null; }
                if (kind === 'signe' && !o.marks) { kind = null; }
                if (kind === 'empiles' && !o.stacked) { kind = null; }
                if (kind) { out.push({ i: i, j: j, kind: kind, adjacent: adjacent }); }
            }
        }
        return out;
    };

    /**
     * Caractère qui porte le crénage entre les deux grappes de la paire, ou -1 si impossible.
     * conv = 'after' : le crénage d'un caractère agit après lui ; 'before' : avant lui.
     * Character carrying the kerning between the pair's clusters, or -1 when impossible.
     */
    CL.kernBoundary = function (cps, base, i, j, conv) {
        var start = base[j];
        if (start <= base[i]) { return { idx: -1, reason: 'empiles' }; }
        var lb = base[start - 1];
        if (CL.isArabic(cps[lb]) && CL.isArabic(cps[start]) && CL.areJoined(cps, lb, start)) {
            return { idx: -1, reason: 'lie' };
        }
        return { idx: (conv === 'before') ? start : start - 1, reason: '' };
    };

    // Noms de polices cursives liées courantes / common connected-script font names
    CL.CURSIVE_RE = /script|brush|hand|cursive|callig|signature|pacifico|lobster|allura|satisfy|sacramento|vibes|kaushan|dancing|cookie|parisienne|yellowtail|courgette|tangerine|pinyon|bickham|zapfino|edwardian|vivaldi|kunstler|mistral|french script|palace|shelley|snell|coronet|corsiva/i;

    /**
     * Police cursive liée probable (contacts voulus) : la plupart des lettres voisines se touchent,
     * sans approche négative, hors texte curviligne ; ou nom de police cursive connu.
     * Probable connected script (intended contacts): most neighbours touch, no negative tracking,
     * not text on a path; or a known script font name.
     */
    CL.isCursive = function (adjacentPairs, touching, fontMatch, isPath, negTrack) {
        if (adjacentPairs < 5) { return false; }
        var ratio = touching / adjacentPairs;
        if (fontMatch) { return ratio >= 0.4; }
        return ratio >= 0.6 && !isPath && !negTrack;
    };

    // ---------------------------------------------------------------------
    // Couleurs-codes : chaque caractère de la copie reçoit une couleur unique
    // Code colours: every character of the copy gets a unique colour
    // ---------------------------------------------------------------------
    CL.encodeIndex = function (i, mode) {
        var v = i + 1;
        if (mode === 'cmyk') { return [v % 100, Math.floor(v / 100) % 100, Math.floor(v / 10000) % 100, 0]; }
        return [v % 256, Math.floor(v / 256) % 256, Math.floor(v / 65536) % 256];
    };

    CL.decodeIndex = function (a, mode) {
        if (!a) { return -1; }
        var v;
        if (mode === 'cmyk') {
            if (Math.round(a[3]) !== 0) { return -1; }
            v = Math.round(a[0]) + 100 * Math.round(a[1]) + 10000 * Math.round(a[2]);
        } else {
            v = Math.round(a[0]) + 256 * Math.round(a[1]) + 65536 * Math.round(a[2]);
        }
        return v - 1;
    };

    // ---------------------------------------------------------------------
    // Géométrie / geometry
    // ---------------------------------------------------------------------

    /**
     * Aplatit un tracé de Bézier. pts[k] = [ax, ay, lx, ly, rx, ry] (ancre, direction gauche, droite).
     * Flattens a Bézier path. Returns a flat array [x0, y0, x1, y1, ...] (closing point not repeated).
     */
    CL.flattenRing = function (pts, closed, tol) {
        var out = [], m = pts.length, k, last, p, q, n, s, t, mt, x, y, ddx1, ddy1, ddx2, ddy2, dd;
        if (m === 0) { return out; }
        last = closed ? m : m - 1;
        out.push(pts[0][0], pts[0][1]);
        for (k = 0; k < last; k++) {
            p = pts[k];
            q = pts[(k + 1) % m];
            var x0 = p[0], y0 = p[1], x1 = p[4], y1 = p[5], x2 = q[2], y2 = q[3], x3 = q[0], y3 = q[1];
            // Écart des poignées à la corde (0 = segment droit) / handle distance to the chord (0 = straight)
            ddx1 = x3 - x0; ddy1 = y3 - y0;
            ddx2 = Math.sqrt(ddx1 * ddx1 + ddy1 * ddy1);
            if (ddx2 > 1e-12) {
                dd = Math.max(Math.abs((x1 - x0) * ddy1 - (y1 - y0) * ddx1), Math.abs((x2 - x0) * ddy1 - (y2 - y0) * ddx1)) / ddx2;
            } else {
                dd = Math.max(Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)), Math.sqrt((x2 - x0) * (x2 - x0) + (y2 - y0) * (y2 - y0)));
            }
            ddy2 = 0;
            n = (dd < tol * 0.25) ? 1 : Math.ceil(Math.sqrt(dd / tol));
            if (n < 1) { n = 1; }
            if (n > 128) { n = 128; }
            for (s = 1; s <= n; s++) {
                t = s / n;
                mt = 1 - t;
                x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
                y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
                if (closed && k === m - 1 && s === n) { break; } // ne pas répéter le premier point
                out.push(x, y);
            }
        }
        return out;
    };

    /** Forme = anneaux aplatis -> arêtes orientées + boîte. Shape = flattened rings -> oriented edges + box. */
    CL.makeShape = function (rings) {
        var e = [], rs = [], bb = [Infinity, Infinity, -Infinity, -Infinity], r, k, m, ring, xa, ya, xb, yb;
        for (r = 0; r < rings.length; r++) {
            ring = rings[r];
            m = ring.length / 2;
            if (m < 2) { continue; }
            rs.push(e.length / 4);
            for (k = 0; k < m; k++) {
                xa = ring[2 * k]; ya = ring[2 * k + 1];
                xb = ring[2 * ((k + 1) % m)]; yb = ring[2 * ((k + 1) % m) + 1];
                e.push(xa, ya, xb, yb);
                if (xa < bb[0]) { bb[0] = xa; }
                if (ya < bb[1]) { bb[1] = ya; }
                if (xa > bb[2]) { bb[2] = xa; }
                if (ya > bb[3]) { bb[3] = ya; }
            }
        }
        return { e: e, rs: rs, bb: bb };
    };

    CL.mergeShapes = function (list) {
        var e = [], rs = [], bb = [Infinity, Infinity, -Infinity, -Infinity], a, k, off;
        for (a = 0; a < list.length; a++) {
            off = e.length / 4;
            for (k = 0; k < list[a].rs.length; k++) { rs.push(list[a].rs[k] + off); }
            for (k = 0; k < list[a].e.length; k++) { e.push(list[a].e[k]); }
            bb[0] = Math.min(bb[0], list[a].bb[0]); bb[1] = Math.min(bb[1], list[a].bb[1]);
            bb[2] = Math.max(bb[2], list[a].bb[2]); bb[3] = Math.max(bb[3], list[a].bb[3]);
        }
        return { e: e, rs: rs, bb: bb };
    };

    CL.bboxDist = function (a, b) {
        var dx = Math.max(0, Math.max(a[0] - b[2], b[0] - a[2]));
        var dy = Math.max(0, Math.max(a[1] - b[3], b[1] - a[3]));
        return Math.sqrt(dx * dx + dy * dy);
    };

    /** Nombre d'enroulement non nul : le point est-il dans la forme ? Nonzero winding point test. */
    CL.inside = function (S, dx, dy, px, py) {
        var e = S.e, w = 0, k, ax, ay, bx, by, cr;
        for (k = 0; k < e.length; k += 4) {
            ax = e[k] + dx; ay = e[k + 1] + dy; bx = e[k + 2] + dx; by = e[k + 3] + dy;
            if (ay <= py) {
                if (by > py) {
                    cr = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
                    if (cr > 0) { w++; }
                }
            } else if (by <= py) {
                cr = (bx - ax) * (py - ay) - (px - ax) * (by - ay);
                if (cr < 0) { w--; }
            }
        }
        return w !== 0;
    };

    function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }

    function ptSeg2(px, py, ax, ay, bx, by, out) {
        var vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, t = 0, qx, qy, dx, dy;
        if (L > 0) {
            t = ((px - ax) * vx + (py - ay) * vy) / L;
            if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
        }
        qx = ax + t * vx; qy = ay + t * vy;
        out[0] = qx; out[1] = qy;
        dx = px - qx; dy = py - qy;
        return dx * dx + dy * dy;
    }

    /** Arêtes de S (décalée de dx, dy) proches de la boîte bb (à cut près). Edges of S near box bb. */
    function edgesNear(S, dx, dy, bb, cut) {
        var e = S.e, out = [], k, ax, ay, bx, by;
        var x0 = bb[0] - cut, y0 = bb[1] - cut, x1 = bb[2] + cut, y1 = bb[3] + cut;
        for (k = 0; k < e.length; k += 4) {
            ax = e[k] + dx; ay = e[k + 1] + dy; bx = e[k + 2] + dx; by = e[k + 3] + dy;
            if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) { continue; }
            out.push(ax, ay, bx, by);
        }
        return out;
    }

    /**
     * Distance minimale entre les formes A et B (B décalée de dx, dy), ou chevauchement.
     * Minimum distance between shapes A and B (B shifted by dx, dy), or overlap.
     * Retour / returns {d, overlap, x, y} ; (x, y) = point du contact / contact point.
     */
    CL.shapeDistance = function (A, B, dx, dy, cutoff) {
        var bbB = [B.bb[0] + dx, B.bb[1] + dy, B.bb[2] + dx, B.bb[3] + dy];
        var bd = CL.bboxDist(A.bb, bbB);
        if (bd > cutoff) { return { d: bd, overlap: false, x: NaN, y: NaN, far: true }; }
        var ea = edgesNear(A, 0, 0, bbB, cutoff), eb = edgesNear(B, dx, dy, A.bb, cutoff);
        var best = Infinity, bx = NaN, by = NaN, p = [0, 0], i, j, d2, ax1, ay1, ax2, ay2, cx1, cy1, cx2, cy2, d1, d2b, d3, d4, t, b2;
        for (i = 0; i < ea.length; i += 4) {
            ax1 = ea[i]; ay1 = ea[i + 1]; ax2 = ea[i + 2]; ay2 = ea[i + 3];
            for (j = 0; j < eb.length; j += 4) {
                cx1 = eb[j]; cy1 = eb[j + 1]; cx2 = eb[j + 2]; cy2 = eb[j + 3];
                // tri rapide par boîtes / quick box reject
                if (best < Infinity) {
                    var gx = Math.max(0, Math.max(Math.min(ax1, ax2) - Math.max(cx1, cx2), Math.min(cx1, cx2) - Math.max(ax1, ax2)));
                    var gy = Math.max(0, Math.max(Math.min(ay1, ay2) - Math.max(cy1, cy2), Math.min(cy1, cy2) - Math.max(ay1, ay2)));
                    if (gx * gx + gy * gy >= best * best) { continue; }
                }
                d1 = orient(cx1, cy1, cx2, cy2, ax1, ay1); d2b = orient(cx1, cy1, cx2, cy2, ax2, ay2);
                d3 = orient(ax1, ay1, ax2, ay2, cx1, cy1); d4 = orient(ax1, ay1, ax2, ay2, cx2, cy2);
                if (((d1 > 0 && d2b < 0) || (d1 < 0 && d2b > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
                    t = d1 / (d1 - d2b);
                    return { d: 0, overlap: true, x: ax1 + t * (ax2 - ax1), y: ay1 + t * (ay2 - ay1) };
                }
                d2 = ptSeg2(ax1, ay1, cx1, cy1, cx2, cy2, p); b2 = d2;
                if (d2 < best * best) { best = Math.sqrt(d2); bx = (ax1 + p[0]) / 2; by = (ay1 + p[1]) / 2; }
                d2 = ptSeg2(ax2, ay2, cx1, cy1, cx2, cy2, p);
                if (d2 < best * best) { best = Math.sqrt(d2); bx = (ax2 + p[0]) / 2; by = (ay2 + p[1]) / 2; }
                d2 = ptSeg2(cx1, cy1, ax1, ay1, ax2, ay2, p);
                if (d2 < best * best) { best = Math.sqrt(d2); bx = (cx1 + p[0]) / 2; by = (cy1 + p[1]) / 2; }
                d2 = ptSeg2(cx2, cy2, ax1, ay1, ax2, ay2, p);
                if (d2 < best * best) { best = Math.sqrt(d2); bx = (cx2 + p[0]) / 2; by = (cy2 + p[1]) / 2; }
            }
        }
        // Une forme entièrement dans l'autre ? / one shape fully inside the other?
        var k, s, px, py;
        for (k = 0; k < B.rs.length; k++) {
            s = B.rs[k] * 4; px = B.e[s] + dx; py = B.e[s + 1] + dy;
            if (CL.inside(A, 0, 0, px, py)) { return { d: 0, overlap: true, x: px, y: py }; }
        }
        for (k = 0; k < A.rs.length; k++) {
            s = A.rs[k] * 4; px = A.e[s]; py = A.e[s + 1];
            if (CL.inside(B, dx, dy, px, py)) { return { d: 0, overlap: true, x: px, y: py }; }
        }
        if (best === Infinity) { return { d: Math.max(bd, cutoff), overlap: false, x: NaN, y: NaN, far: true }; }
        return { d: best, overlap: false, x: bx, y: by };
    };

    /**
     * Profil d'étendue par bandes horizontales dans le repère (u, v) : pour chaque bande, x' maximal
     * (wantMax) ou minimal de la forme. Extent profile per band in the (u, v) frame.
     */
    function extentProfile(S, dx, dy, ux, uy, y0, h, nb, wantMax) {
        var prof = [], e = S.e, k, ax, ay, bx, by, xa, ya, xb, yb, lo, hi, b, b0, b1, yb0, yb1, ta, tb, xs, xe, v;
        for (k = 0; k < nb; k++) { prof[k] = null; }
        for (k = 0; k < e.length; k += 4) {
            ax = e[k] + dx; ay = e[k + 1] + dy; bx = e[k + 2] + dx; by = e[k + 3] + dy;
            xa = ax * ux + ay * uy; ya = -ax * uy + ay * ux;
            xb = bx * ux + by * uy; yb = -bx * uy + by * ux;
            lo = Math.min(ya, yb); hi = Math.max(ya, yb);
            b0 = Math.floor((lo - y0) / h); b1 = Math.floor((hi - y0) / h);
            if (b1 < 0 || b0 >= nb) { continue; }
            if (b0 < 0) { b0 = 0; }
            if (b1 >= nb) { b1 = nb - 1; }
            for (b = b0; b <= b1; b++) {
                if (hi - lo < 1e-12) { xs = xa; xe = xb; }
                else {
                    yb0 = y0 + b * h; yb1 = yb0 + h;
                    ta = (Math.max(lo, yb0) - ya) / (yb - ya);
                    tb = (Math.min(hi, yb1) - ya) / (yb - ya);
                    xs = xa + ta * (xb - xa); xe = xa + tb * (xb - xa);
                }
                v = wantMax ? Math.max(xs, xe) : Math.min(xs, xe);
                if (prof[b] === null || (wantMax ? v > prof[b] : v < prof[b])) { prof[b] = v; }
            }
        }
        return prof;
    }

    function yRange(S, ux, uy) {
        var e = S.e, lo = Infinity, hi = -Infinity, k, y;
        for (k = 0; k < e.length; k += 4) {
            y = -e[k] * uy + e[k + 1] * ux;
            if (y < lo) { lo = y; }
            if (y > hi) { hi = y; }
        }
        return [lo, hi];
    }

    /**
     * Décalage de B le long de u (borne haute prudente) pour un écart >= g ; -Infinity si aucune contrainte.
     * Conservative upper bound of the shift of B along u giving a gap >= g; -Infinity if unconstrained.
     */
    CL.clearanceShift = function (A, B, ux, uy, g, h) {
        var ra = yRange(A, ux, uy), rb = yRange(B, ux, uy);
        var y0 = Math.max(ra[0], rb[0]) - g - h, y1 = Math.min(ra[1], rb[1]) + g + h;
        if (y1 <= y0) { return -Infinity; }
        var nb = Math.ceil((y1 - y0) / h);
        if (nb > 3000) { h = (y1 - y0) / 3000; nb = 3000; }
        var R = extentProfile(A, 0, 0, ux, uy, y0, h, nb, true);
        var L = extentProfile(B, 0, 0, ux, uy, y0, h, nb, false);
        var M = Math.ceil(g / h) + 1, s = -Infinity, ka, m, kb, dyMin, ext, v;
        for (ka = 0; ka < nb; ka++) {
            if (R[ka] === null) { continue; }
            for (m = -M; m <= M; m++) {
                kb = ka + m;
                if (kb < 0 || kb >= nb || L[kb] === null) { continue; }
                dyMin = Math.max(0, (Math.abs(m) - 1) * h);
                if (dyMin > g) { continue; }
                ext = (g > 0) ? Math.sqrt(g * g - dyMin * dyMin) : 0;
                v = R[ka] + ext - L[kb];
                if (v > s) { s = v; }
            }
        }
        return s;
    };

    /**
     * Décalage exact (bissection sur la distance réelle) pour obtenir l'écart g ; négatif = marge disponible.
     * Exact shift (bisection on the true distance) giving gap g; negative = spare room.
     */
    CL.refineShift = function (A, B, ux, uy, g, h, eps) {
        var s0 = CL.clearanceShift(A, B, ux, uy, g, h);
        if (s0 === -Infinity) { return -Infinity; }
        var f = function (s) {
            var r = CL.shapeDistance(A, B, s * ux, s * uy, g + 1);
            return r.overlap ? -1 : r.d;
        };
        var hi = s0 + h, lo, guard = 0, step = Math.max(h, g) * 2 + 8 * h, mid, k;
        while (f(hi) < g - eps && guard < 40) { hi += step; step *= 2; guard++; }
        lo = s0 - 8 * h - g;
        guard = 0; step = Math.max(h, g) * 2 + 8 * h;
        while (f(lo) >= g - eps && guard < 40) { hi = lo; lo -= step; step *= 2; guard++; }
        for (k = 0; k < 40 && hi - lo > eps; k++) {
            mid = (lo + hi) / 2;
            if (f(mid) >= g - eps) { hi = mid; } else { lo = mid; }
        }
        return hi;
    };

    // ---------------------------------------------------------------------
    // Crénage / kerning
    // ---------------------------------------------------------------------

    /**
     * Valeur de crénage suivante pour une frontière. Next kerning value for a boundary.
     * st = {k0, k, kPrev, sPrev} ; sNeed = décalage encore nécessaire (négatif = marge) ;
     * slope = déplacement par unité de crénage (1/1000 em) ; maxDelta = plafond au-dessus de k0.
     */
    CL.nextKerning = function (st, sNeed, slope, maxDelta, pass, eps) {
        var sl = slope, obs, delta = 0, k, capped = false;
        // Plancher = crénage qui reproduit l'espacement d'origine (crénage auto compris)
        // Floor = kerning reproducing the original spacing (auto kerning included)
        var floor = (st.kFloor !== undefined && st.kFloor !== null) ? st.kFloor : st.k0;
        if (pass >= 3 && st.kPrev !== null && st.k !== st.kPrev && st.sPrev !== null) {
            obs = (st.sPrev - sNeed) / (st.k - st.kPrev);
            if (obs > 0.25 * slope && obs < 4 * slope) { sl = obs; }
        }
        if (sNeed === -Infinity) { delta = 0; }
        else if (sNeed > eps) { delta = Math.max(1, Math.ceil(sNeed / sl + 0.25)); }
        else if (sNeed < -1.5 * sl && st.k > floor) {
            delta = -Math.floor(-sNeed / sl - 0.5);
            if (st.k + delta < floor) { delta = floor - st.k; }
        }
        k = st.k + delta;
        if (k > floor + maxDelta) { k = floor + maxDelta; capped = true; }
        return { k: k, capped: capped };
    };

    /**
     * Après le premier changement : écart entre le décalage prévu et le décalage mesuré = crénage
     * automatique (métrique / optique) perdu en passant au crénage manuel. Renvoie le plancher.
     * After the first change: predicted minus measured shift = auto kerning lost when switching to
     * manual kerning. Returns the floor (kerning value reproducing the original spacing).
     */
    CL.kerningFloor = function (k0, kPrev, k, sPrev, sNow, slope) {
        if (sNow === -Infinity || sPrev === null || kPrev === null) { return k0; }
        var predicted = sPrev - slope * (k - kPrev), delta = predicted - sNow;
        if (Math.abs(delta) <= 0.5 * slope) { return k0; }
        return Math.round(k0 - delta / slope);
    };

    /** Étiquette de crénage d'origine : "v1|n=longueur|idx:k0;idx:k0". Original-kerning tag. */
    CL.encodeTag = function (n, map) {
        var parts = [], key;
        for (key in map) { if (map.hasOwnProperty(key)) { parts.push(key + ':' + map[key]); } }
        return 'v1|n=' + n + '|' + parts.join(';');
    };

    CL.decodeTag = function (s) {
        var r = { n: -1, map: {} };
        if (!s) { return null; }
        var p = String(s).split('|'), k, kv;
        if (p.length < 3 || p[0] !== 'v1') { return null; }
        r.n = parseInt(p[1].replace('n=', ''), 10);
        if (p[2]) {
            kv = p[2].split(';');
            for (k = 0; k < kv.length; k++) {
                var a = kv[k].split(':');
                if (a.length === 2 && !isNaN(parseInt(a[0], 10))) { r.map[parseInt(a[0], 10)] = parseFloat(a[1]); }
            }
        }
        return r;
    };

    // ---------------------------------------------------------------------
    // Unités, nombres / units, numbers
    // ---------------------------------------------------------------------
    CL.parseNum = function (s) {
        var v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
        return isNaN(v) ? NaN : v;
    };

    CL.toPt = function (v, unit) {
        if (unit === 'mm') { return v * 72 / 25.4; }
        return v;
    };

    CL.fromPt = function (v, unit) {
        if (unit === 'mm') { return v * 25.4 / 72; }
        return v;
    };

    CL.fmt = function (v, dec, lang) {
        var s = (Math.abs(v) < Math.pow(10, -dec) / 2) ? (0).toFixed(dec) : v.toFixed(dec);
        if (lang === 'fr') { s = s.replace('.', ','); }
        return s.replace('-', '\u2212');
    };

    /** Italique contre romain ? Italic next to upright? */
    CL.isItalicRoman = function (styleA, styleB) {
        var re = /italic|oblique|slant|kursiv|corsiv|cursiva|inclin/i;
        return String(styleA) !== String(styleB) && (re.test(String(styleA)) !== re.test(String(styleB)));
    };

    /** Police exclue ? font excluded by the user's list (fragments separated by commas) */
    CL.fontExcluded = function (name, list) {
        if (!list) { return false; }
        var parts = String(list).split(','), k, f, n = String(name).toLowerCase();
        for (k = 0; k < parts.length; k++) {
            f = parts[k].replace(/^\s+|\s+$/g, '').toLowerCase();
            if (f && n.indexOf(f) >= 0) { return true; }
        }
        return false;
    };

    /** Réglages <-> texte (pas de JSON en ExtendScript) / settings <-> text (no JSON in ExtendScript) */
    CL.serialize = function (o) {
        var lines = [], k;
        for (k in o) { if (o.hasOwnProperty(k)) { lines.push(k + '=' + String(o[k]).replace(/[\r\n]/g, ' ')); } }
        return lines.join('\n');
    };

    CL.deserialize = function (s, defaults) {
        var o = {}, k, lines = String(s || '').split(/\r?\n/), i, p, key, val;
        for (k in defaults) { if (defaults.hasOwnProperty(k)) { o[k] = defaults[k]; } }
        for (i = 0; i < lines.length; i++) {
            p = lines[i].indexOf('=');
            if (p < 1) { continue; }
            key = lines[i].substring(0, p); val = lines[i].substring(p + 1);
            if (!defaults.hasOwnProperty(key)) { continue; }
            if (typeof defaults[key] === 'number') { val = parseFloat(val); if (isNaN(val)) { continue; } }
            else if (typeof defaults[key] === 'boolean') { val = (val === 'true'); }
            o[key] = val;
        }
        return o;
    };
    // @@CORE-END

    // =====================================================================
    // Textes de l'interface / interface strings (FR / EN)
    // =====================================================================
    var LANG = (/^en/i.test(String($.locale))) ? 'en' : 'fr';
    var STR = {
        fr: {
            title: 'Contacts entre lettres',
            intro: 'Trouve les lettres qui se touchent ou sont trop proches dans une ligne (mesure sur la forme r\u00E9elle des lettres) et corrige par cr\u00E9nage la seule paire concern\u00E9e. Les lettres arabes li\u00E9es ne sont jamais s\u00E9par\u00E9es. Conseil : travaillez sur une copie du fichier.',
            noDoc: 'Aucun document ouvert.\nOuvrez un document Illustrator puis relancez le script.',
            noSel: 'Rien n\'est s\u00E9lectionn\u00E9.\nS\u00E9lectionnez un ou plusieurs textes, ou choisissez la port\u00E9e \u00AB Plan de travail actif \u00BB ou \u00AB Document \u00BB.',
            noText: 'Aucun texte modifiable trouv\u00E9 dans la port\u00E9e choisie.',
            scope: 'Port\u00E9e',
            scopeSel: 'S\u00E9lection', scopeAb: 'Plan de travail actif', scopeDoc: 'Document',
            gap: '\u00C9cart minimal entre lettres',
            preset: 'Usage :',
            presets: ['Typographie : contact seulement', 'Lisibilit\u00E9 : 1 % du corps', 'D\u00E9coupe vinyle / plotter : 0,3 mm', 'Gravure / d\u00E9coupe laser : 0,5 mm', 'Broderie : 1 mm', 'Personnalis\u00E9'],
            minGap: '\u00C9cart :',
            units: ['pt', 'mm', '% du corps'],
            checks: 'Contr\u00F4les',
            cLatin: 'Lettres latines et autres \u00E9critures (f) f? l\u2019, italique / romain, approche serr\u00E9e)',
            cArabic: 'Arabe : lettres non li\u00E9es et mots voisins (\u0631 \u0648 \u0646 contre le mot suivant)',
            cMarks: 'Signes (diacritiques, accents) contre les lettres voisines',
            cStacked: 'Signes arabes empil\u00E9s qui se touchent (signal\u00E9s seulement)',
            window: 'Comparer chaque lettre avec :',
            windows: ['la lettre suivante', 'les 2 lettres suivantes', 'les 3 lettres suivantes'],
            cCursive: 'Ignorer les polices cursives li\u00E9es (d\u00E9tection automatique)',
            fontsIgnore: 'Polices \u00E0 ignorer (morceaux de nom, s\u00E9par\u00E9s par des virgules) :',
            maxChars: 'Ignorer les textes de plus de',
            chars: 'caract\u00E8res',
            correction: 'Correction et rep\u00E8res',
            maxKern: 'Cr\u00E9nage ajout\u00E9 au plus (1/1000 cadratin) :',
            cMarkers: 'Rep\u00E8res sur un calque non imprimable',
            cLabels: '\u00C9tiquettes avec l\'\u00E9cart mesur\u00E9',
            bAnalyse: 'Analyser', bFix: 'Corriger', bRestore: 'R\u00E9tablir le cr\u00E9nage', bClear: 'Effacer les rep\u00E8res', bClose: 'Fermer',
            badValue: 'Valeur incorrecte : ',
            resultsTitle: 'Contacts entre lettres \u2013 r\u00E9sultat',
            cols: ['N\u00B0', 'Texte', 'Paire', '\u00C9cart', 'Type / action'],
            bFixNow: 'Corriger maintenant', bSelect: 'S\u00E9lectionner les textes', bSave: 'Enregistrer le rapport\u2026',
            kinds: { lettres: 'Lettres', arabe: 'Arabe', signe: 'Signe / lettre', empiles: 'Signes empil\u00E9s' },
            overlap: 'chevauchement', tooClose: 'trop proche',
            italic: 'italique / romain',
            notKernLie: 'non corrigeable : lettres li\u00E9es (kashida \u0640 ou position des signes)',
            notKernStack: 'non corrigeable par cr\u00E9nage : position verticale des signes ou police',
            capped: 'plafond de cr\u00E9nage atteint',
            fixedTxt: 'corrig\u00E9 : cr\u00E9nage ',
            remains: 'reste',
            sumFrames: 'Textes analys\u00E9s : ', sumIssues: 'Probl\u00E8mes trouv\u00E9s : ', sumFixed: 'Paires corrig\u00E9es : ',
            sumRemain: 'Probl\u00E8mes restants : ', sumSkipped: 'Ignor\u00E9s : ', sumCursive: 'Textes en police cursive li\u00E9e ignor\u00E9s : ',
            sumReflow: 'Textes recompos\u00E9s (nombre de lignes chang\u00E9) : ',
            skLocked: 'verrouill\u00E9s / masqu\u00E9s', skThread: 'cha\u00EEn\u00E9s', skVertical: 'verticaux', skLong: 'trop longs', skNote: 'note #contacts-ok', skEmpty: 'vides',
            gapUsed: '\u00C9cart demand\u00E9 : ',
            none: 'Aucun contact trouv\u00E9. \u2714',
            restored: 'Cr\u00E9nage d\'origine r\u00E9tabli dans ', restoredSkip: ' ; textes modifi\u00E9s depuis (ignor\u00E9s) : ',
            nothingRestore: 'Aucun texte corrig\u00E9 par ce script dans la port\u00E9e choisie.',
            cleared: 'Rep\u00E8res effac\u00E9s.', noMarkers: 'Aucun calque de rep\u00E8res.',
            saved: 'Rapport enregistr\u00E9 : ',
            reportHead: 'Rapport ContactsLettres v',
            selected: ' texte(s) s\u00E9lectionn\u00E9(s).',
            tooMany: '(liste limit\u00E9e aux 500 premiers)',
            workCopy: 'La correction modifie le cr\u00E9nage des paires concern\u00E9es (annulable : \u00C9dition > Annuler, ou bouton \u00AB R\u00E9tablir le cr\u00E9nage \u00BB).\nConseil : travaillez sur une copie du fichier.\n\nContinuer ?',
            textRangeInfo: 'Texte s\u00E9lectionn\u00E9 \u00E0 l\'outil Texte : tout le bloc sera analys\u00E9.',
            error: 'Erreur : '
        },
        en: {
            title: 'Letter contacts',
            intro: 'Finds letters that touch or sit too close within a line (measured on the real letter shapes) and fixes them by kerning only the offending pair. Joined Arabic letters are never separated. Tip: work on a copy of your file.',
            noDoc: 'No document open.\nOpen an Illustrator document and run the script again.',
            noSel: 'Nothing is selected.\nSelect one or more texts, or choose the \u201CActive artboard\u201D or \u201CDocument\u201D scope.',
            noText: 'No editable text found in the chosen scope.',
            scope: 'Scope',
            scopeSel: 'Selection', scopeAb: 'Active artboard', scopeDoc: 'Document',
            gap: 'Minimum gap between letters',
            preset: 'Use:',
            presets: ['Typography: contact only', 'Legibility: 1% of type size', 'Vinyl / plotter cutting: 0.3 mm', 'Laser engraving / cutting: 0.5 mm', 'Embroidery: 1 mm', 'Custom'],
            minGap: 'Gap:',
            units: ['pt', 'mm', '% of size'],
            checks: 'Checks',
            cLatin: 'Latin letters and other scripts (f) f? l\u2019, italic / roman, tight tracking)',
            cArabic: 'Arabic: non-joined letters and next words (\u0631 \u0648 \u0646 against the next word)',
            cMarks: 'Marks (diacritics, accents) against neighbouring letters',
            cStacked: 'Stacked Arabic marks touching each other (reported only)',
            window: 'Compare each letter with:',
            windows: ['the next letter', 'the next 2 letters', 'the next 3 letters'],
            cCursive: 'Ignore connected script fonts (automatic detection)',
            fontsIgnore: 'Fonts to ignore (name fragments, comma separated):',
            maxChars: 'Skip texts longer than',
            chars: 'characters',
            correction: 'Correction and markers',
            maxKern: 'Maximum kerning added (1/1000 em):',
            cMarkers: 'Markers on a non-printing layer',
            cLabels: 'Labels with the measured gap',
            bAnalyse: 'Analyse', bFix: 'Fix', bRestore: 'Restore kerning', bClear: 'Clear markers', bClose: 'Close',
            badValue: 'Invalid value: ',
            resultsTitle: 'Letter contacts \u2013 result',
            cols: ['#', 'Text', 'Pair', 'Gap', 'Type / action'],
            bFixNow: 'Fix now', bSelect: 'Select texts', bSave: 'Save report\u2026',
            kinds: { lettres: 'Letters', arabe: 'Arabic', signe: 'Mark / letter', empiles: 'Stacked marks' },
            overlap: 'overlap', tooClose: 'too close',
            italic: 'italic / roman',
            notKernLie: 'not fixable: joined letters (kashida \u0640 or mark position)',
            notKernStack: 'not fixable by kerning: vertical mark position or font',
            capped: 'kerning limit reached',
            fixedTxt: 'fixed: kerning ',
            remains: 'remains',
            sumFrames: 'Texts analysed: ', sumIssues: 'Problems found: ', sumFixed: 'Pairs fixed: ',
            sumRemain: 'Problems left: ', sumSkipped: 'Skipped: ', sumCursive: 'Connected-script texts skipped: ',
            sumReflow: 'Texts recomposed (line count changed): ',
            skLocked: 'locked / hidden', skThread: 'threaded', skVertical: 'vertical', skLong: 'too long', skNote: 'note #contacts-ok', skEmpty: 'empty',
            gapUsed: 'Requested gap: ',
            none: 'No contact found. \u2714',
            restored: 'Original kerning restored in ', restoredSkip: '; texts edited since (skipped): ',
            nothingRestore: 'No text fixed by this script in the chosen scope.',
            cleared: 'Markers cleared.', noMarkers: 'No marker layer.',
            saved: 'Report saved: ',
            reportHead: 'ContactsLettres report v',
            selected: ' text(s) selected.',
            tooMany: '(list limited to the first 500)',
            workCopy: 'Fixing changes the kerning of the affected pairs (undoable: Edit > Undo, or the \u201CRestore kerning\u201D button).\nTip: work on a copy of your file.\n\nContinue?',
            textRangeInfo: 'Text selected with the Type tool: the whole text object will be analysed.',
            error: 'Error: '
        }
    };
    var L = STR[LANG];

    // Préréglages : [valeur, unité] / presets: [value, unit]
    var PRESETS = [[0, 'pt'], [1, 'pct'], [0.3, 'mm'], [0.5, 'mm'], [1, 'mm']];
    var UNIT_KEYS = ['pt', 'mm', 'pct'];

    var DEFAULTS = {
        scope: 'sel', preset: 0, value: 0, unit: 'pt', latin: true, arabic: true, marks: true, stacked: true,
        window: 2, skipCursive: true, fontsIgnore: '', maxChars: 3000, maxKern: 300, markers: true, labels: true
    };

    // =====================================================================
    // Accès au document / document access
    // =====================================================================

    function settingsFile() {
        try { return new File(Folder.userData.fsName + '/ContactsLettres.cfg'); } catch (e) { return null; }
    }

    function loadSettings() {
        var f = settingsFile(), s = '';
        try {
            if (f && f.exists) { f.encoding = 'UTF-8'; f.open('r'); s = f.read(); f.close(); }
        } catch (e) { s = ''; }
        return CL.deserialize(s, DEFAULTS);
    }

    function saveSettings(o) {
        var f = settingsFile();
        try { if (f) { f.encoding = 'UTF-8'; f.open('w'); f.write(CL.serialize(o)); f.close(); } } catch (e) { }
    }

    /** L'objet et ses parents sont-ils visibles et déverrouillés ? Item and parents visible and unlocked? */
    function isEditable(it) {
        var p = it, guard = 0;
        try {
            while (p && guard < 60) {
                guard++;
                if (p.typename === 'Document') { break; }
                if (p.typename === 'Layer') { if (p.locked || !p.visible) { return false; } }
                else if (p.locked || p.hidden) { return false; }
                p = p.parent;
            }
        } catch (e) { return false; }
        return true;
    }

    function pushFrames(item, out) {
        var t = '';
        try { t = item.typename; } catch (e) { return; }
        if (t === 'TextFrame') { out.push(item); }
        else if (t === 'GroupItem') {
            for (var k = 0; k < item.pageItems.length; k++) { pushFrames(item.pageItems[k], out); }
        }
    }

    function unique(list) {
        var out = [], k, q, dup;
        for (k = 0; k < list.length; k++) {
            dup = false;
            for (q = 0; q < out.length; q++) { if (out[q] === list[k]) { dup = true; break; } }
            if (!dup) { out.push(list[k]); }
        }
        return out;
    }

    function rectsIntersect(a, b) {
        // [gauche, haut, droite, bas] (y vers le haut) / [left, top, right, bottom] (y up)
        return !(a[2] < b[0] || a[0] > b[2] || a[3] > b[1] || a[1] < b[3]);
    }

    /** Textes de la portée. Text frames of the scope. Retour {frames, textRange:boolean} */
    function collectFrames(doc, scope) {
        var out = [], k, sel, ab, r, isRange = false;
        if (scope === 'sel') {
            sel = doc.selection;
            if (sel && sel.typename === 'TextRange') {
                isRange = true;
                try { for (k = 0; k < sel.story.textFrames.length; k++) { out.push(sel.story.textFrames[k]); } } catch (e1) { }
            } else if (sel && sel.length) {
                for (k = 0; k < sel.length; k++) { pushFrames(sel[k], out); }
            }
        } else if (scope === 'ab') {
            ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            for (k = 0; k < doc.textFrames.length; k++) {
                try { r = doc.textFrames[k].visibleBounds; } catch (e2) { continue; }
                if (rectsIntersect(r, ab)) { out.push(doc.textFrames[k]); }
            }
        } else {
            for (k = 0; k < doc.textFrames.length; k++) { out.push(doc.textFrames[k]); }
        }
        return { frames: unique(out), textRange: isRange };
    }

    /** Raison d'ignorer un texte, ou '' / reason to skip a text, or '' */
    function skipReason(tf, maxChars) {
        if (!isEditable(tf)) { return 'locked'; }
        try { if (tf.nextFrame || tf.previousFrame) { return 'thread'; } } catch (e1) { }
        try { if (tf.orientation === TextOrientation.VERTICAL) { return 'vertical'; } } catch (e2) { }
        try { if (/#contacts-ok/i.test(String(tf.note))) { return 'note'; } } catch (e3) { }
        var n = 0;
        try { n = tf.textRange.characters.length; } catch (e4) { return 'empty'; }
        if (n < 2) { return 'empty'; }
        if (maxChars > 0 && n > maxChars) { return 'long'; }
        return '';
    }

    /** Codes des caractères, alignés sur textRange.characters. Character codes aligned with characters. */
    function codesOf(tf) {
        var s = String(tf.contents), chars = tf.textRange.characters, n = chars.length, cps = [], k, c;
        if (s.length === n) {
            for (k = 0; k < n; k++) { cps.push(s.charCodeAt(k)); }
            return cps;
        }
        for (k = 0; k < n; k++) {
            c = String(chars[k].contents);
            if (c.length === 2 && c.charCodeAt(0) >= 0xD800 && c.charCodeAt(0) <= 0xDBFF) {
                cps.push(((c.charCodeAt(0) - 0xD800) * 0x400) + (c.charCodeAt(1) - 0xDC00) + 0x10000);
            } else { cps.push(c.length ? c.charCodeAt(0) : 32); }
        }
        return cps;
    }

    function textOf(cps, a, b) {
        var s = '', k, c;
        for (k = Math.max(0, a); k <= b && k < cps.length; k++) {
            c = cps[k];
            if (CL.isBreak(c)) { s += ' '; }
            else if (c > 0xFFFF) { c -= 0x10000; s += String.fromCharCode(0xD800 + (c >> 10), 0xDC00 + (c & 1023)); }
            else { s += String.fromCharCode(c); }
        }
        return s;
    }

    function frameInfo(tf) {
        var u = [1, 0], sc = 1, isPath = false, m, len;
        try { isPath = (tf.kind === TextType.PATHTEXT); } catch (e1) { }
        try {
            m = tf.matrix;
            len = Math.sqrt(m.mValueA * m.mValueA + m.mValueB * m.mValueB);
            if (len > 1e-9 && !isNaN(len)) { u = [m.mValueA / len, m.mValueB / len]; sc = len; }
        } catch (e2) { }
        return { u: u, scale: sc, isPath: isPath };
    }

    function lineCount(tf) {
        try { return tf.lines.length; } catch (e) { return -1; }
    }

    function frameLabel(tf, cps) {
        var nm = '';
        try { nm = tf.name; } catch (e) { }
        if (nm) { return nm; }
        var s = textOf(cps, 0, 23);
        return '\u00AB' + s + (cps.length > 24 ? '\u2026' : '') + '\u00BB';
    }

    function makeColor(doc, vals) {
        var c;
        if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
            c = new CMYKColor(); c.cyan = vals[0]; c.magenta = vals[1]; c.yellow = vals[2]; c.black = vals[3];
        } else {
            c = new RGBColor(); c.red = vals[0]; c.green = vals[1]; c.blue = vals[2];
        }
        return c;
    }

    function colorValues(col) {
        try {
            if (col.typename === 'CMYKColor') { return [col.cyan, col.magenta, col.yellow, col.black]; }
            if (col.typename === 'RGBColor') { return [col.red, col.green, col.blue]; }
        } catch (e) { }
        return null;
    }

    // Couleurs des repères / marker colours  [CMJN, RVB]
    var MARK_COLS = {
        overlap: [[0, 100, 100, 0], [230, 30, 30]],
        close: [[0, 50, 100, 0], [255, 140, 0]],
        blocked: [[80, 30, 0, 0], [30, 120, 230]],
        fixed: [[70, 0, 100, 0], [40, 170, 60]]
    };

    function markColor(ctx, key) {
        return makeColor(ctx.doc, MARK_COLS[key][ctx.mode === 'cmyk' ? 0 : 1]);
    }

    function getLayer(doc, name, create) {
        var k;
        for (k = 0; k < doc.layers.length; k++) { if (doc.layers[k].name === name) { return doc.layers[k]; } }
        if (!create) { return null; }
        var ly = doc.layers.add();
        ly.name = name;
        return ly;
    }

    function removeLayer(doc, name) {
        var ly = getLayer(doc, name, false);
        if (!ly) { return false; }
        try { ly.locked = false; ly.visible = true; } catch (e) { }
        ly.remove();
        return true;
    }

    /** Copie vectorisée à couleurs-codes. Code-coloured outlined copy. Retour {group, leaves[], bb[]} */
    function makeOutline(tf, ctx) {
        var dup = tf.duplicate(ctx.tmp, ElementPlacement.PLACEATEND), ca, chars, n, k;
        try { dup.hidden = false; dup.locked = false; } catch (e0) { }
        ca = dup.textRange.characterAttributes;
        try { ca.underline = false; } catch (e1) { }
        try { ca.strikeThrough = false; } catch (e2) { }
        try { ca.strokeColor = new NoColor(); } catch (e3) { }
        chars = dup.textRange.characters;
        n = chars.length;
        for (k = 0; k < n; k++) {
            chars[k].characterAttributes.fillColor = makeColor(ctx.doc, CL.encodeIndex(k, ctx.mode));
        }
        var grp = dup.createOutline(), leaves = [], byChar = [], bb = [], q, idx, col, gb;
        collectLeaves(grp, leaves);
        for (q = 0; q < leaves.length; q++) {
            col = null;
            try { col = (leaves[q].typename === 'CompoundPathItem') ? leaves[q].pathItems[0].fillColor : leaves[q].fillColor; } catch (e4) { }
            idx = CL.decodeIndex(colorValues(col), ctx.mode);
            if (idx < 0 || idx >= n) { continue; }
            gb = leaves[q].geometricBounds;
            if (!byChar[idx]) { byChar[idx] = []; bb[idx] = [gb[0], gb[3], gb[2], gb[1]]; }
            else {
                bb[idx] = [Math.min(bb[idx][0], gb[0]), Math.min(bb[idx][1], gb[3]), Math.max(bb[idx][2], gb[2]), Math.max(bb[idx][3], gb[1])];
            }
            byChar[idx].push(leaves[q]);
        }
        return { group: grp, leaves: byChar, bb: bb };
    }

    function collectLeaves(item, out) {
        var t = item.typename, k;
        if (t === 'CompoundPathItem' || t === 'PathItem') { out.push(item); }
        else if (t === 'GroupItem') { for (k = 0; k < item.pageItems.length; k++) { collectLeaves(item.pageItems[k], out); } }
    }

    function leafRings(leaf, tol, rings) {
        var paths = [], k, q, pp, pts, P, a, l, r;
        if (leaf.typename === 'CompoundPathItem') { for (k = 0; k < leaf.pathItems.length; k++) { paths.push(leaf.pathItems[k]); } }
        else { paths.push(leaf); }
        for (k = 0; k < paths.length; k++) {
            pp = paths[k].pathPoints;
            pts = [];
            for (q = 0; q < pp.length; q++) {
                P = pp[q]; a = P.anchor; l = P.leftDirection; r = P.rightDirection;
                pts.push([a[0], a[1], l[0], l[1], r[0], r[1]]);
            }
            var flat = CL.flattenRing(pts, true, tol);
            if (flat.length >= 4) { rings.push(flat); }
        }
    }

    function readAttrs(tf, k, cache) {
        if (cache[k]) { return cache[k]; }
        var o = { size: 12, sw: 0, font: '', style: '', track: 0 }, ca;
        try {
            var ch = tf.textRange.characters[k];
            ca = ch.characterAttributes;
            o.size = ca.size;
            try { if (ca.strokeColor && ca.strokeColor.typename !== 'NoColor') { o.sw = ca.strokeWeight || 0; } } catch (e1) { }
            try { o.font = ca.textFont.name; o.style = ca.textFont.style; } catch (e2) { }
            try { o.track = ca.tracking || 0; } catch (e3) { }
        } catch (e) { }
        cache[k] = o;
        return o;
    }

    function readKern(tf, k) {
        try { var v = tf.textRange.characters[k].kerning; return isNaN(v) ? 0 : v; } catch (e) { return 0; }
    }

    function writeKern(tf, k, v) {
        tf.textRange.characters[k].kerning = v;
    }

    // =====================================================================
    // Analyse d'un texte / analysis of one text
    // =====================================================================

    /**
     * Mesure toutes les paires d'un texte sur sa copie vectorisée.
     * Measures every pair of a text on its outlined copy.
     * state : frontières déjà modifiées (passes de correction) / boundaries already changed.
     */
    function analyzeFrame(tf, cps, info, opts, ctx, state, attrCache) {
        var ol = makeOutline(tf, ctx), res = { recs: [], needs: {}, adj: 0, adjTouch: 0, cursive: false, negTrack: false, fontMatch: false };
        try {
            var n = cps.length, hasShape = [], k, base = CL.clusterBases(cps), shapes = {};
            for (k = 0; k < n; k++) { hasShape[k] = !!ol.bb[k]; }
            var pairs = CL.candidatePairs(cps, hasShape, opts);
            var getShape = function (idx, tol) {
                if (!shapes[idx]) {
                    var rings = [], q;
                    for (q = 0; q < ol.leaves[idx].length; q++) { leafRings(ol.leaves[idx][q], tol, rings); }
                    shapes[idx] = CL.makeShape(rings);
                }
                return shapes[idx];
            };
            for (k = 0; k < pairs.length; k++) {
                var p = pairs[k], bbA = ol.bb[p.i], bbB = ol.bb[p.j];
                var hMax = Math.max(bbA[3] - bbA[1], bbB[3] - bbB[1], 0.001);
                var bbd = CL.bboxDist(bbA, bbB);
                var kb = CL.kernBoundary(cps, base, p.i, p.j, ctx.conv);
                var tracked = !!(state && kb.idx >= 0 && state[kb.idx]);
                var quick = (opts.unit === 'pct') ? hMax * (opts.value / 50 + 0.35) : opts.gInt + hMax * 0.35;
                if (p.adjacent) { res.adj++; }
                if (bbd > quick && !(tracked && bbd < quick + hMax)) { continue; }

                var at = readAttrs(tf, p.i, attrCache), bt = readAttrs(tf, p.j, attrCache);
                var em = Math.max(at.size, bt.size, 0.01) * info.scale;
                var g = (opts.unit === 'pct') ? opts.value / 100 * em : opts.gInt;
                var touch = 0.0015 * em;
                var gDet = Math.max(g, touch);
                var sExtra = (at.sw + bt.sw) / 2 * info.scale;   // contours des caractères / character strokes
                var gEff = gDet + sExtra;
                if (bbd > gEff && !tracked) { continue; }

                var tol = Math.max(em * 0.0005, 1e-4), h = Math.max(em * 0.003, 1e-3), eps = Math.max(em * 1e-5, 1e-6);
                var A = getShape(p.i, tol), B = getShape(p.j, tol);
                var dr = CL.shapeDistance(A, B, 0, 0, gEff + em * 0.5);
                var issue = dr.overlap || dr.d < gEff - 1e-9;
                if (p.adjacent && (dr.overlap || dr.d < touch + sExtra)) {
                    res.adjTouch++;
                    if (at.track < 0 || bt.track < 0) { res.negTrack = true; }
                    if (CL.CURSIVE_RE.test(at.font) || CL.CURSIVE_RE.test(bt.font)) { res.fontMatch = true; }
                }

                // Axe de séparation : sens de la ligne, orienté de i vers j
                // Separation axis: line direction, oriented from i to j
                var cAx = (bbA[0] + bbA[2]) / 2, cAy = (bbA[1] + bbA[3]) / 2, cBx = (bbB[0] + bbB[2]) / 2, cBy = (bbB[1] + bbB[3]) / 2;
                var ux = info.u[0], uy = info.u[1], vx = cBx - cAx, vy = cBy - cAy, vl = Math.sqrt(vx * vx + vy * vy), proj;
                if (info.isPath && vl > 1e-9) { ux = vx / vl; uy = vy / vl; }
                else {
                    proj = vx * ux + vy * uy;
                    var rtl = CL.isArabic(cps[base[p.j]]) || (cps[base[p.j]] >= 0x0590 && cps[base[p.j]] <= 0x05FF);
                    if ((Math.abs(proj) > 0.1 * hMax) ? proj < 0 : rtl) { ux = -ux; uy = -uy; }
                }

                var rec = { p: p, kb: kb, issue: issue, overlap: dr.overlap, dVis: dr.d - sExtra, x: dr.x, y: dr.y, em: em, g: g,
                    fontA: at.font, fontB: bt.font, italic: CL.isItalicRoman(at.style, bt.style), need: null };
                if (issue && dr.overlap) {
                    var pen = CL.refineShift(A, B, ux, uy, 0, h, eps);
                    rec.dVis = -Math.max(0, pen === -Infinity ? 0 : pen) - sExtra;
                }
                if (ctx.correcting && kb.idx >= 0 && (issue || tracked)) {
                    var s = CL.refineShift(A, B, ux, uy, gEff + 0.001 * em, h, eps);
                    var kAt = readAttrs(tf, kb.idx, attrCache);
                    rec.need = { idx: kb.idx, s: s, slope: Math.max(kAt.size, 0.01) * info.scale / 1000 };
                }
                if (issue || rec.need) { res.recs.push(rec); }
            }
            // Police cursive liée : contacts voulus / connected script: intended contacts
            res.cursive = !!(opts.skipCursive && CL.isCursive(res.adj, res.adjTouch, res.fontMatch, info.isPath, res.negTrack));
            var kept = [];
            for (k = 0; k < res.recs.length; k++) {
                var r = res.recs[k];
                if (res.cursive && r.p.kind === 'lettres') { continue; }
                if (CL.fontExcluded(r.fontA, opts.fontsIgnore) || CL.fontExcluded(r.fontB, opts.fontsIgnore)) { continue; }
                kept.push(r);
                if (r.need && r.need.s !== -Infinity) {
                    var cur = res.needs[r.need.idx];
                    if (!cur || r.need.s > cur.s) { res.needs[r.need.idx] = r.need; }
                }
            }
            res.recs = kept;
        } finally {
            try { ol.group.remove(); } catch (eR) { }
        }
        return res;
    }

    function findTag(tf) {
        try {
            for (var k = 0; k < tf.tags.length; k++) { if (tf.tags[k].name === CL.TAG) { return tf.tags[k]; } }
        } catch (e) { }
        return null;
    }

    function saveTag(tf, n, map) {
        var tag = findTag(tf), old = tag ? CL.decodeTag(tag.value) : null, key;
        if (old && old.n === n) {
            for (key in old.map) { if (old.map.hasOwnProperty(key)) { map[key] = old.map[key]; } } // l'origine la plus ancienne gagne
        }
        if (!tag) { tag = tf.tags.add(); tag.name = CL.TAG; }
        tag.value = CL.encodeTag(n, map);
    }

    /** Traite un texte : analyse, puis corrections successives vérifiées. Process one text. */
    function processFrame(tf, opts, ctx, R, correct) {
        var why = skipReason(tf, opts.maxChars);
        if (why) { R.skipped[why] = (R.skipped[why] || 0) + 1; return; }
        var cps = codesOf(tf), info = frameInfo(tf), label = frameLabel(tf, cps), cache = {}, k, idx, st, nd, r, pass;
        R.analysed++;
        var an = analyzeFrame(tf, cps, info, opts, ctx, null, cache);
        var first = 0;
        for (k = 0; k < an.recs.length; k++) { if (an.recs[k].issue) { first++; } }
        R.found += first;
        if (an.cursive) { R.cursive++; }
        var state = {}, hasNeed = false;
        for (idx in an.needs) { if (an.needs.hasOwnProperty(idx)) { hasNeed = true; break; } }
        if (correct && hasNeed) {
            var linesBefore = lineCount(tf);
            for (pass = 1; pass <= 5; pass++) {
                var changed = false;
                for (idx in an.needs) {
                    if (!an.needs.hasOwnProperty(idx)) { continue; }
                    nd = an.needs[idx];
                    st = state[idx];
                    var fresh = !st;
                    if (fresh) { var k0 = readKern(tf, parseInt(idx, 10)); st = { k0: k0, k: k0, kPrev: null, sPrev: null, kFloor: k0, capped: false, floorSet: false, written: false }; }
                    else if (!st.floorSet && st.kPrev === st.k0) {
                        // crénage auto perdu ? / auto kerning lost?
                        st.kFloor = CL.kerningFloor(st.k0, st.kPrev, st.k, st.sPrev, nd.s, nd.slope);
                        st.floorSet = true;
                    }
                    r = CL.nextKerning(st, nd.s, nd.slope, opts.maxKern, pass, nd.slope * 0.05);
                    st.capped = r.capped;
                    if (r.k !== st.k) {
                        st.kPrev = st.k; st.sPrev = nd.s; st.k = r.k;
                        writeKern(tf, parseInt(idx, 10), r.k);
                        st.written = true;
                        changed = true;
                        if (fresh) { state[idx] = st; }
                    } else if (fresh && r.capped) { state[idx] = st; }
                }
                if (!changed) { break; }
                an = analyzeFrame(tf, cps, info, opts, ctx, state, cache);
            }
            var map = {}, any = false;
            var isFixed = function (s0) { return s0.written && (s0.k !== s0.k0 || s0.kFloor !== s0.k0); };
            for (idx in state) {
                // valeur qui redonne l'aspect d'origine / value restoring the original look
                if (state.hasOwnProperty(idx) && isFixed(state[idx])) { map[idx] = state[idx].kFloor; any = true; }
            }
            if (any) { saveTag(tf, cps.length, map); }
            var la = lineCount(tf);
            if (linesBefore >= 0 && la >= 0 && la !== linesBefore) { R.reflow.push(label); }
            // Paires corrigées (position tirée de la dernière mesure) / fixed pairs (position from last measure)
            for (idx in state) {
                if (!state.hasOwnProperty(idx) || !isFixed(state[idx])) { continue; }
                var ii = parseInt(idx, 10), a = (ctx.conv === 'before') ? ii - 1 : ii, fx = NaN, fy = NaN, fem = 0;
                for (k = 0; k < an.recs.length; k++) {
                    if (an.recs[k].kb.idx === ii && !isNaN(an.recs[k].x)) { fx = an.recs[k].x; fy = an.recs[k].y; fem = an.recs[k].em; break; }
                }
                R.fixed.push({ tf: tf, label: label, idx: ii, delta: state[idx].k - state[idx].kFloor, k: state[idx].k,
                    pair: textOf(cps, a, a + 1), x: fx, y: fy, em: fem, capped: state[idx].capped });
            }
        }
        for (k = 0; k < an.recs.length; k++) {
            var rc = an.recs[k];
            if (!rc.issue) { continue; }
            R.issues.push({ tf: tf, label: label, pair: textOf(cps, rc.p.i, rc.p.j), kind: rc.p.kind, overlap: rc.overlap,
                dVis: rc.dVis, x: rc.x, y: rc.y, em: rc.em, kernable: rc.kb.idx >= 0, reason: rc.kb.reason,
                capped: !!(rc.kb.idx >= 0 && state[rc.kb.idx] && state[rc.kb.idx].capped), italic: rc.italic });
        }
    }

    /** Sens du crénage dans ce moteur : agit après ou avant le caractère ? Kerning convention. */
    function calibrateKerning(ctx) {
        var t = null, conv = 'after', g0, g1, g2;
        try {
            t = ctx.tmp.textFrames.add();
            t.contents = 'HH';
            var ca = t.textRange.characterAttributes;
            ca.size = 100;
            try { ca.kerningMethod = AutoKernType.NOAUTOKERN; } catch (e0) { }
            g0 = gapHH(t, ctx);
            writeKern(t, 0, 500); g1 = gapHH(t, ctx); writeKern(t, 0, 0);
            if (g1 - g0 > 20) { conv = 'after'; }
            else {
                writeKern(t, 1, 500); g2 = gapHH(t, ctx);
                if (g2 - g0 > 20) { conv = 'before'; }
            }
        } catch (e) { }
        try { if (t) { t.remove(); } } catch (e2) { }
        return conv;
    }

    function gapHH(t, ctx) {
        var d = t.duplicate(ctx.tmp, ElementPlacement.PLACEATEND), g = d.createOutline(), leaves = [], gap = 0, a, b, tmp;
        collectLeaves(g, leaves);
        if (leaves.length >= 2) {
            a = leaves[0].geometricBounds; b = leaves[leaves.length - 1].geometricBounds;
            if (a[0] > b[0]) { tmp = a; a = b; b = tmp; }
            gap = b[0] - a[2];
        }
        g.remove();
        return gap;
    }

    // =====================================================================
    // Exécution, repères, rapport / run, markers, report
    // =====================================================================

    function buildOpts(s, doc) {
        var sf = 1;
        try { sf = doc.scaleFactor || 1; } catch (e) { sf = 1; }
        return {
            scope: s.scope, value: s.value, unit: s.unit,
            gInt: (s.unit === 'pct') ? 0 : CL.toPt(s.value, s.unit) / sf,
            latin: s.latin, arabic: s.arabic, marks: s.marks, stacked: s.stacked,
            window: s.window, maxRaw: 12, skipCursive: s.skipCursive, fontsIgnore: s.fontsIgnore,
            maxChars: s.maxChars, maxKern: s.maxKern, markers: s.markers, labels: s.labels
        };
    }

    function run(doc, opts, correct) {
        removeLayer(doc, CL.MARK_LAYER);              // anciens repères / previous markers
        var col = collectFrames(doc, opts.scope), k;
        var R = { analysed: 0, found: 0, issues: [], fixed: [], skipped: {}, cursive: 0, reflow: [], errors: [],
            frames: col.frames.length, textRange: col.textRange, correct: correct, opts: opts, sf: 1, doc: doc };
        if (!col.frames.length) { return R; }
        var ctx = { doc: doc, mode: (doc.documentColorSpace === DocumentColorSpace.CMYK) ? 'cmyk' : 'rgb', sf: 1, tmp: null, conv: 'after', correcting: correct };
        try { ctx.sf = doc.scaleFactor || 1; } catch (e0) { ctx.sf = 1; }
        R.sf = ctx.sf;
        var prevLayer = null;
        try { prevLayer = doc.activeLayer; } catch (e1) { }
        removeLayer(doc, CL.TMP_LAYER);
        ctx.tmp = getLayer(doc, CL.TMP_LAYER, true);
        try {
            if (correct) { ctx.conv = calibrateKerning(ctx); }
            for (k = 0; k < col.frames.length; k++) {
                try { processFrame(col.frames[k], opts, ctx, R, correct); }
                catch (e2) { R.errors.push((k + 1) + ': ' + e2.message); }
            }
        } finally {
            removeLayer(doc, CL.TMP_LAYER);
        }
        drawMarkers(ctx, R, opts);
        try { if (prevLayer) { doc.activeLayer = prevLayer; } } catch (e3) { }
        return R;
    }

    function gapText(dVis, em, R) {
        var pt = dVis * R.sf, s;
        if (R.opts.unit === 'mm') { s = CL.fmt(CL.fromPt(pt, 'mm'), 2, LANG) + ' mm'; }
        else { s = CL.fmt(pt, 2, LANG) + ' pt'; }
        if (R.opts.unit === 'pct' && em > 0) { s += ' (' + CL.fmt(dVis / em * 100, 1, LANG) + ' %)'; }
        return s;
    }

    function requestedGapText(R) {
        var o = R.opts;
        if (o.unit === 'pct') { return CL.fmt(o.value, 1, LANG) + ' ' + L.units[2]; }
        return CL.fmt(o.value, 2, LANG) + ' ' + o.unit + ((o.value === 0) ? ' (' + L.presets[0].split(':')[1].replace(/^\s+/, '') + ')' : '');
    }

    function issueTypeText(iss, R) {
        var s = L.kinds[iss.kind] + ' \u2013 ' + (iss.overlap ? L.overlap : L.tooClose);
        if (iss.italic) { s += ' \u2013 ' + L.italic; }
        if (!iss.kernable) { s += ' \u2013 ' + (iss.reason === 'lie' ? L.notKernLie : L.notKernStack); }
        else if (iss.capped) { s += ' \u2013 ' + L.capped; }
        if (R.correct) { s += ' \u2013 ' + L.remains; }
        return s;
    }

    function buildRows(R) {
        var rows = [], k, n = 0, iss, fx;
        for (k = 0; k < R.issues.length; k++) {
            iss = R.issues[k]; n++;
            rows.push([String(n), iss.label, '\u00AB' + iss.pair + '\u00BB', gapText(iss.dVis, iss.em, R), issueTypeText(iss, R)]);
        }
        for (k = 0; k < R.fixed.length; k++) {
            fx = R.fixed[k]; n++;
            rows.push([String(n), fx.label, '\u00AB' + fx.pair + '\u00BB', '', L.fixedTxt + (fx.delta > 0 ? '+' : '') + fx.delta + ' (\u2192 ' + fx.k + ')' + (fx.capped ? ' \u2013 ' + L.capped : '')]);
        }
        return rows;
    }

    function skipName(k) {
        return { locked: L.skLocked, thread: L.skThread, vertical: L.skVertical, 'long': L.skLong, note: L.skNote, empty: L.skEmpty }[k] || k;
    }

    function summaryLines(R) {
        var o = [], k, sk = [];
        o.push(L.sumFrames + R.analysed + ' / ' + R.frames + '    ' + L.gapUsed + requestedGapText(R));
        o.push(L.sumIssues + R.found + (R.correct ? '    ' + L.sumFixed + R.fixed.length + '    ' + L.sumRemain + R.issues.length : ''));
        for (k in R.skipped) { if (R.skipped.hasOwnProperty(k)) { sk.push(skipName(k) + ' ' + R.skipped[k]); } }
        if (sk.length) { o.push(L.sumSkipped + sk.join(', ')); }
        if (R.cursive) { o.push(L.sumCursive + R.cursive); }
        if (R.reflow.length) { o.push(L.sumReflow + R.reflow.length + ' (' + R.reflow.join(', ') + ')'); }
        if (R.textRange) { o.push(L.textRangeInfo); }
        if (!R.issues.length && !R.fixed.length && R.analysed) { o.push(L.none); }
        if (R.errors.length) { o.push(L.error + R.errors.join(' | ')); }
        return o;
    }

    function drawMarkers(ctx, R, opts) {
        var doc = ctx.doc, k, ly, iss, key, r, e, t, ca, sw = 0.75 / ctx.sf;
        removeLayer(doc, CL.MARK_LAYER);
        if (!opts.markers || (!R.issues.length && !R.fixed.length)) { return; }
        ly = getLayer(doc, CL.MARK_LAYER, true);
        try { ly.printable = false; } catch (e0) { }
        for (k = 0; k < R.issues.length; k++) {
            iss = R.issues[k];
            if (isNaN(iss.x) || isNaN(iss.y)) { continue; }
            key = !iss.kernable ? 'blocked' : (iss.overlap ? 'overlap' : 'close');
            r = Math.max(2.5 / ctx.sf, iss.em * 0.16);
            e = ly.pathItems.ellipse(iss.y + r, iss.x - r, 2 * r, 2 * r);
            e.filled = false; e.stroked = true; e.strokeColor = markColor(ctx, key); e.strokeWidth = sw;
            if (opts.labels) {
                t = ly.textFrames.add();
                t.contents = gapText(iss.dVis, iss.em, R);
                ca = t.textRange.characterAttributes;
                ca.size = Math.max(5 / ctx.sf, Math.min(iss.em * 0.2, 9 / ctx.sf));
                ca.fillColor = markColor(ctx, key);
                t.position = [iss.x + r, iss.y + r * 1.6];
            }
        }
        for (k = 0; k < R.fixed.length; k++) {
            iss = R.fixed[k];
            if (isNaN(iss.x) || isNaN(iss.y)) { continue; }
            r = Math.max(1.5 / ctx.sf, iss.em * 0.08);
            e = ly.pathItems.ellipse(iss.y + r, iss.x - r, 2 * r, 2 * r);
            e.filled = false; e.stroked = true; e.strokeColor = markColor(ctx, 'fixed'); e.strokeWidth = sw;
        }
        try { ly.locked = true; } catch (e1) { }
    }

    function restoreFrames(frames) {
        var done = 0, skipped = 0, k, tf, tag, d, key;
        for (k = 0; k < frames.length; k++) {
            tf = frames[k];
            if (!isEditable(tf)) { continue; }
            tag = findTag(tf);
            if (!tag) { continue; }
            d = CL.decodeTag(tag.value);
            if (!d) { continue; }
            if (d.n !== tf.textRange.characters.length) { skipped++; continue; }
            for (key in d.map) { if (d.map.hasOwnProperty(key)) { writeKern(tf, parseInt(key, 10), d.map[key]); } }
            tag.remove();
            done++;
        }
        return { done: done, skipped: skipped };
    }

    function selectFrames(doc, R) {
        var list = [], k;
        for (k = 0; k < R.issues.length; k++) { list.push(R.issues[k].tf); }
        for (k = 0; k < R.fixed.length; k++) { list.push(R.fixed[k].tf); }
        list = unique(list);
        doc.selection = null;
        for (k = 0; k < list.length; k++) { try { list[k].selected = true; } catch (e) { } }
        return list.length;
    }

    function reportText(R) {
        var o = [], rows = buildRows(R), k, dn = '';
        try { dn = R.doc.name; } catch (e) { }
        o.push(L.reportHead + CL.VERSION + ' \u2013 ' + dn + ' \u2013 ' + new Date().toString());
        o = o.concat(summaryLines(R));
        o.push('');
        o.push(L.cols.join('\t'));
        for (k = 0; k < rows.length; k++) { o.push(rows[k].join('\t')); }
        return o.join('\n');
    }

    function saveReport(R) {
        var f = null;
        try { f = File.saveDialog(L.bSave, '*.txt'); } catch (e) { f = File.saveDialog(L.bSave); }
        if (!f) { return; }
        if (!/\.txt$/i.test(f.name)) { f = new File(f.fsName + '.txt'); }
        f.encoding = 'UTF-8';
        f.lineFeed = 'Unix';
        if (f.open('w')) { f.write('\uFEFF' + reportText(R)); f.close(); alert(L.saved + f.fsName, L.title); }
    }

    // =====================================================================
    // Interface ScriptUI / ScriptUI interface
    // =====================================================================

    function idxOf(arr, v) {
        for (var k = 0; k < arr.length; k++) { if (arr[k] === v) { return k; } }
        return -1;
    }

    function clampInt(v, lo, hi) { v = Math.round(v); return v < lo ? lo : (v > hi ? hi : v); }

    function addPanel(parent, title) {
        var p = parent.add('panel', undefined, title);
        p.orientation = 'column';
        p.alignChildren = ['left', 'top'];
        p.margins = [12, 16, 12, 10];
        p.spacing = 6;
        return p;
    }

    function showMainDialog(S, isRange) {
        var w = new Window('dialog', L.title + ' \u2013 v' + CL.VERSION);
        w.orientation = 'column'; w.alignChildren = ['fill', 'top']; w.spacing = 10; w.margins = 16;
        var intro = w.add('statictext', undefined, L.intro, { multiline: true });
        intro.preferredSize = [540, 50];
        if (isRange) { w.add('statictext', undefined, L.textRangeInfo); }

        // Portée / scope
        var pS = addPanel(w, L.scope);
        pS.orientation = 'row';
        var rSel = pS.add('radiobutton', undefined, L.scopeSel);
        var rAb = pS.add('radiobutton', undefined, L.scopeAb);
        var rDoc = pS.add('radiobutton', undefined, L.scopeDoc);
        rSel.value = (S.scope === 'sel'); rAb.value = (S.scope === 'ab'); rDoc.value = (S.scope === 'doc');
        if (!rSel.value && !rAb.value && !rDoc.value) { rSel.value = true; }

        // Écart / gap
        var pG = addPanel(w, L.gap);
        var g1 = pG.add('group');
        g1.add('statictext', undefined, L.preset);
        var ddP = g1.add('dropdownlist', undefined, L.presets);
        ddP.selection = clampInt(S.preset, 0, L.presets.length - 1);
        var g2 = pG.add('group');
        g2.add('statictext', undefined, L.minGap);
        var eVal = g2.add('edittext', undefined, CL.fmt(S.value, 2, LANG));
        eVal.characters = 7;
        var ddU = g2.add('dropdownlist', undefined, L.units);
        ddU.selection = Math.max(0, idxOf(UNIT_KEYS, S.unit));
        var lock = false;
        ddP.onChange = function () {
            if (!ddP.selection) { return; }
            var i = ddP.selection.index;
            if (i < PRESETS.length) {
                lock = true;
                eVal.text = CL.fmt(PRESETS[i][0], 2, LANG);
                ddU.selection = idxOf(UNIT_KEYS, PRESETS[i][1]);
                lock = false;
            }
        };
        var toCustom = function () { if (!lock) { ddP.selection = L.presets.length - 1; } };
        eVal.onChanging = toCustom;
        ddU.onChange = toCustom;

        // Contrôles / checks
        var pC = addPanel(w, L.checks);
        var cbL = pC.add('checkbox', undefined, L.cLatin); cbL.value = S.latin;
        var cbA = pC.add('checkbox', undefined, L.cArabic); cbA.value = S.arabic;
        var cbM = pC.add('checkbox', undefined, L.cMarks); cbM.value = S.marks;
        var cbS = pC.add('checkbox', undefined, L.cStacked); cbS.value = S.stacked;
        var g3 = pC.add('group');
        g3.add('statictext', undefined, L.window);
        var ddW = g3.add('dropdownlist', undefined, L.windows);
        ddW.selection = clampInt(S.window - 1, 0, 2);
        var cbC = pC.add('checkbox', undefined, L.cCursive); cbC.value = S.skipCursive;
        pC.add('statictext', undefined, L.fontsIgnore);
        var eF = pC.add('edittext', undefined, S.fontsIgnore);
        eF.alignment = ['fill', 'top'];
        eF.preferredSize = [500, 22];
        var g4 = pC.add('group');
        g4.add('statictext', undefined, L.maxChars);
        var eMC = g4.add('edittext', undefined, String(S.maxChars)); eMC.characters = 6;
        g4.add('statictext', undefined, L.chars);

        // Correction / fixing
        var pK = addPanel(w, L.correction);
        var g5 = pK.add('group');
        g5.add('statictext', undefined, L.maxKern);
        var eMK = g5.add('edittext', undefined, String(S.maxKern)); eMK.characters = 5;
        var cbMk = pK.add('checkbox', undefined, L.cMarkers); cbMk.value = S.markers;
        var cbLb = pK.add('checkbox', undefined, L.cLabels); cbLb.value = S.labels;
        cbLb.enabled = cbMk.value;
        cbMk.onClick = function () { cbLb.enabled = cbMk.value; };

        // Boutons / buttons
        var gB = w.add('group');
        gB.alignment = ['fill', 'top'];
        var bClear = gB.add('button', undefined, L.bClear);
        var bRestore = gB.add('button', undefined, L.bRestore);
        var bClose = gB.add('button', undefined, L.bClose, { name: 'cancel' });
        var bAn = gB.add('button', undefined, L.bAnalyse, { name: 'ok' });
        var bFix = gB.add('button', undefined, L.bFix);

        var result = null;
        var read = function () {
            var v = CL.parseNum(eVal.text), mc = parseInt(eMC.text, 10), mk = parseInt(eMK.text, 10);
            if (isNaN(v) || v < 0 || v > 100) { alert(L.badValue + eVal.text, L.title); return null; }
            if (isNaN(mc) || mc < 0) { alert(L.badValue + eMC.text, L.title); return null; }
            if (isNaN(mk) || mk < 1 || mk > 2000) { alert(L.badValue + eMK.text, L.title); return null; }
            return {
                scope: rSel.value ? 'sel' : (rAb.value ? 'ab' : 'doc'),
                preset: ddP.selection ? ddP.selection.index : L.presets.length - 1,
                value: v, unit: UNIT_KEYS[ddU.selection ? ddU.selection.index : 0],
                latin: cbL.value, arabic: cbA.value, marks: cbM.value, stacked: cbS.value,
                window: (ddW.selection ? ddW.selection.index : 1) + 1,
                skipCursive: cbC.value, fontsIgnore: eF.text, maxChars: mc, maxKern: mk,
                markers: cbMk.value, labels: cbLb.value
            };
        };
        var go = function (a) {
            var o = read();
            if (o) { result = { action: a, opts: o }; w.close(1); }
        };
        bAn.onClick = function () { go('analyze'); };
        bFix.onClick = function () { go('fix'); };
        bRestore.onClick = function () { go('restore'); };
        bClear.onClick = function () { go('clear'); };
        bClose.onClick = function () { w.close(2); };
        w.show();
        return result;
    }

    function countKernable(R) {
        var n = 0;
        for (var k = 0; k < R.issues.length; k++) { if (R.issues[k].kernable) { n++; } }
        return n;
    }

    function showResults(R, canFix) {
        var w = new Window('dialog', L.resultsTitle), k, c, rows = buildRows(R), act = null;
        w.orientation = 'column'; w.alignChildren = ['fill', 'top']; w.margins = 16; w.spacing = 10;
        var st = w.add('statictext', undefined, summaryLines(R).join('\n'), { multiline: true });
        st.preferredSize = [780, 100];
        if (rows.length) {
            var lb = w.add('listbox', undefined, undefined, {
                numberOfColumns: 5, showHeaders: true, columnTitles: L.cols, columnWidths: [40, 170, 80, 120, 350]
            });
            lb.preferredSize = [780, 300];
            for (k = 0; k < rows.length && k < 500; k++) {
                var it = lb.add('item', rows[k][0]);
                for (c = 1; c < 5; c++) { it.subItems[c - 1].text = rows[k][c]; }
            }
            if (rows.length > 500) { w.add('statictext', undefined, L.tooMany); }
        }
        var gB = w.add('group');
        gB.alignment = ['right', 'top'];
        var bSave = gB.add('button', undefined, L.bSave);
        bSave.onClick = function () { saveReport(R); };
        if (rows.length) {
            var bSel = gB.add('button', undefined, L.bSelect);
            bSel.onClick = function () { act = 'select'; w.close(1); };
        }
        if (canFix && countKernable(R) > 0) {
            var bF = gB.add('button', undefined, L.bFixNow);
            bF.onClick = function () { act = 'fix'; w.close(1); };
        }
        var bC = gB.add('button', undefined, L.bClose, { name: 'cancel' });
        bC.onClick = function () { w.close(2); };
        w.show();
        return act;
    }

    // =====================================================================
    // Programme principal / main program
    // =====================================================================
    function main() {
        if (!app.documents || app.documents.length === 0) { alert(L.noDoc, L.title); return; }
        var doc = app.activeDocument, sel = null, hasSel = false, isRange = false;
        try {
            sel = doc.selection;
            isRange = !!(sel && sel.typename === 'TextRange');
            hasSel = isRange || !!(sel && sel.length > 0);
        } catch (e0) { }
        var S = loadSettings();
        var d = showMainDialog(S, isRange);
        if (!d) { return; }
        saveSettings(d.opts);
        var opts = buildOpts(d.opts, doc);
        if (d.action === 'clear') {
            alert(removeLayer(doc, CL.MARK_LAYER) ? L.cleared : L.noMarkers, L.title);
            return;
        }
        if (opts.scope === 'sel' && !hasSel) { alert(L.noSel, L.title); return; }
        if (d.action === 'restore') {
            var rr = restoreFrames(collectFrames(doc, opts.scope).frames);
            if (!rr.done && !rr.skipped) { alert(L.nothingRestore, L.title); }
            else { alert(L.restored + rr.done + (rr.skipped ? L.restoredSkip + rr.skipped : ''), L.title); }
            return;
        }
        var correct = (d.action === 'fix');
        if (correct && !confirm(L.workCopy)) { return; }
        var R = run(doc, opts, correct);
        if (!R.frames || (!R.analysed && !R.errors.length)) {
            alert(L.noText + (R.frames ? '\n' + summaryLines(R).join('\n') : ''), L.title);
            return;
        }
        var a = showResults(R, !correct);
        if (a === 'fix' && confirm(L.workCopy)) {
            R = run(doc, opts, true);
            a = showResults(R, false);
        }
        if (a === 'select') { alert(selectFrames(doc, R) + L.selected, L.title); }
    }

    // Accès pour les tests hors Illustrator / hook for tests outside Illustrator
    if (typeof $ !== 'undefined' && $.global && $.global.__CONTACTS_LETTRES_TEST__) {
        var T = $.global.__CONTACTS_LETTRES_TEST__;
        T.CL = CL; T.L = L; T.run = run; T.buildOpts = buildOpts; T.restoreFrames = restoreFrames;
        T.collectFrames = collectFrames; T.showMainDialog = showMainDialog; T.showResults = showResults;
        T.main = main; T.reportText = reportText; T.selectFrames = selectFrames; T.DEFAULTS = DEFAULTS;
        T.removeLayer = removeLayer;
        return;
    }

    try { main(); }
    catch (err) { alert(L.error + err.message + (err.line ? ' (l. ' + err.line + ')' : ''), L.title); }
})();
