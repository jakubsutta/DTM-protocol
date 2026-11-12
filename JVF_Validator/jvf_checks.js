/* jvf_checks.js – kontrolní jádro JVF DTM validátoru. Závislost: JSTS (globální `jsts`).
   Běží v prohlížeči i v Node. Nezávisí na verzi XSD – kontroluje geometrii, topologii a formát zápisu. */
(function (root) {
'use strict';
const DEFAULTS = { tolConnect: 0.05, gapMax: 0.5, minSeg: 0.02, maxZJump: 5, zMin: 100, zMax: 1650,
  tolDupPoint: 0.05, minOverlapArea: 0.05, minOverlapLen: 0.10, lineSelfSev: 'WARN',
  networkBlocks: null, version: 'auto', casts: null, groups: { S: 1, G: 1, T: 1, Z: 1, D: 1, N: 1 } };
const GML = 'http://www.opengis.net/gml/3.2';
const ln = e => e.localName || e.nodeName.split(':').pop();
const kids = e => Array.from(e.childNodes).filter(n => n.nodeType === 1);
const byName = (e, n) => Array.from(e.getElementsByTagNameNS('*', n));
const fp = r => { const p = r.geom && r.geom.rings[0] && r.geom.rings[0].pts[0]; return p ? [p[0], p[1]] : null; };
const envOf = (r, pad) => { pad = pad || 0; let a = 1e12, b = 1e12, c = -1e12, d = -1e12;
  r.geom.rings.forEach(g => g.pts.forEach(p => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }));
  return [a - pad, b - pad, c + pad, d + pad]; };

function Grid(cell) { this.c = cell; this.m = new Map(); this.big = []; }
Grid.prototype.cells = function (e, f) { const c = this.c;
  for (let x = Math.floor(e[0] / c); x <= Math.floor(e[2] / c); x++) for (let y = Math.floor(e[1] / c); y <= Math.floor(e[3] / c); y++) f(x + ',' + y); };
Grid.prototype.add = function (it, e) { const c = this.c;
  if ((Math.floor(e[2] / c) - Math.floor(e[0] / c) + 1) * (Math.floor(e[3] / c) - Math.floor(e[1] / c) + 1) > 400) { this.big.push(it); return; }
  this.cells(e, k => { (this.m.get(k) || this.m.set(k, []).get(k)).push(it); }); };
Grid.prototype.query = function (e) { const s = new Set(this.big); this.cells(e, k => (this.m.get(k) || []).forEach(i => s.add(i))); return s; };

/* ---------- parsování ---------- */
function parseRec(r, blk, idx, line) {
  const rec = { blk, idx, line, el: r, attrs: {}, geom: null, id: '', popis: '' };
  (function walk(e) { if (/^Geometrie/.test(ln(e))) return; const c = kids(e);
    if (!c.length) { const t = e.textContent.trim(); if (t) rec.attrs[ln(e)] = t; } else c.forEach(walk); })(r);
  rec.id = rec.attrs.ID || ''; rec.popis = rec.attrs.PopisObjektu || '';
  [['bod', 'Point', 'pos'], ['linie', 'LineString', 'posList'], ['plocha', 'Polygon', 'posList']].some(([kind, tag, pos]) => {
    const g = byName(r, tag)[0]; if (!g) return false;
    const dim = parseInt(g.getAttribute('srsDimension') || '3', 10) || 3;
    rec.geom = { kind, dim, gid: g.getAttribute('gml:id') || g.getAttributeNS(GML, 'id') || '', srs: g.getAttribute('srsName') || '',
      rings: byName(g, pos).map(p => { const raw = p.textContent.trim().split(/\s+/).filter(Boolean), pts = [];
        for (let i = 0; i + dim <= raw.length; i += dim) pts.push([+raw[i], +raw[i + 1], dim > 2 ? +raw[i + 2] : null]);
        return { raw, pts }; }) };
    return true; });
  return rec;
}
function parse(doc, raw, add) {
  const m = { version: '', blocks: [] }, rootEl = doc.documentElement;
  const v = byName(rootEl, 'VerzeJVFDTM')[0]; m.version = v ? v.textContent.trim() : '';
  const data = byName(rootEl, 'Data').find(d => kids(d).some(c => byName(c, 'ZaznamyObjektu').length));
  if (!data) { add('ERR', 'F02', 'Chybí element Data s objekty'); return m; }
  const lines = []; if (raw) { const re = /<([\w.-]+:)?ZaznamObjektu\w*[\s>]/g; let x, last = 0, line = 1;
    while ((x = re.exec(raw))) { for (let i = last; i < x.index; i++) if (raw.charCodeAt(i) === 10) line++; last = x.index; lines.push(line); } }
  let k = 0;
  kids(data).forEach(b => {
    const nz = byName(b, 'ObjektovyTypNazev')[0], cz = byName(b, 'ObsahovaCast')[0];
    const blk = { el: b, root: ln(b), nazev: nz ? nz.textContent.trim() : ln(b), cast: cz ? cz.textContent.trim() : '', recs: [] };
    const zs = byName(b, 'ZaznamyObjektu')[0];
    const els = zs ? kids(zs).filter(r => ln(r).indexOf('ZaznamObjektu') === 0) : [];
    if (!els.length) add('WARN', 'F05', 'Blok „' + blk.nazev + '“ neobsahuje žádný záznam');
    els.forEach((r, i) => blk.recs.push(parseRec(r, blk, i + 1, lines[k++] || 0)));
    m.blocks.push(blk); });
  return m;
}

/* ---------- JSTS příprava ---------- */
function prepare(m) {
  const GF = new jsts.geom.GeometryFactory(), C = p => new jsts.geom.Coordinate(p[0], p[1]);
  m.blocks.forEach(b => b.recs.forEach(r => { const g = r.geom; if (!g || r.bad) return;
    try { if (g.kind === 'bod') r.j = GF.createPoint(C(g.rings[0].pts[0]));
      else if (g.kind === 'linie') r.j = GF.createLineString(g.rings[0].pts.map(C));
      else { const rs = g.rings.map(x => GF.createLinearRing(x.pts.map(C))); r.j = GF.createPolygon(rs[0], rs.slice(1));
        r.verr = new jsts.operation.valid.IsValidOp(r.j).getValidationError(); }
    } catch (e) { r.j = null; } }));
  return GF;
}

/* ---------- G: formát a zápis geometrie ---------- */
function checkFormat(m, o, add) {
  const ids = new Map(); let n150 = /^1\.5/.test(m.version);
  if (o.version && o.version !== 'auto' && m.version !== o.version) add('WARN', 'F03', 'Soubor je ve verzi „' + (m.version || '?') + '“, kontrola je nastavena na JVF DTM ' + o.version);
  m.blocks.forEach(b => {
    const kinds = new Set(b.recs.map(r => r.geom && r.geom.kind).filter(Boolean));
    if (kinds.size > 1) add('ERR', 'G10', 'Blok „' + b.nazev + '“ obsahuje více typů geometrie: ' + [...kinds].join(', '), b.recs[0]);
    let kr = 0; b.recs.forEach(r => { if (n150 && r.attrs.KritickaTI !== undefined) { if (!kr++) add('ERR', 'F04', 'Atribut KritickaTI byl ve verzi 1.5.0 odstraněn (ČÚZK, přehled změn 1.5.0)', r); } });
    b.recs.forEach(r => { const g = r.geom; if (!g) { add('INFO', 'F06', 'Záznam bez geometrie', r); return; }
      const xy = fp(r), E = (c, t) => { add('ERR', c, t, r, xy); if (/^G0[24789]$/.test(c)) r.bad = true; };
      if (g.srs !== 'EPSG:5514') E('G01', 'srsName „' + g.srs + '“, očekáváno EPSG:5514' + (/5514/.test(g.srs) ? ' (pravděpodobný překlep)' : ''));
      if (g.dim !== 3) add('WARN', 'G02', 'srsDimension=' + g.dim + ' (očekáváno 3, souřadnice včetně výšky)', r, xy);
      const code = { bod: '01', linie: '02', plocha: '03' }[g.kind], mm = /^ID[0-9A-Za-z]+_(\d\d)$/.exec(g.gid);
      if (!mm) E('G05', 'gml:id „' + g.gid + '“ nemá tvar ID…_kód'); else if (mm[1] !== code) E('G05', 'gml:id „' + g.gid + '“ má kód ' + mm[1] + ', očekáváno ' + code);
      if (g.gid) { if (ids.has(g.gid)) E('G06', 'gml:id „' + g.gid + '“ se opakuje (první výskyt řádek ' + ids.get(g.gid) + ')'); else ids.set(g.gid, r.line); }
      if (!g.rings.length) E('G08', 'Chybí souřadnice (pos/posList)');
      g.rings.forEach(ring => {
        if (ring.raw.length % g.dim) E('G02', 'Počet čísel v posList (' + ring.raw.length + ') není násobkem srsDimension ' + g.dim);
        if (ring.raw.some(t => !isFinite(+t))) E('G09', 'Nečíselná hodnota souřadnice');
        if (ring.raw.some(t => /\.\d{3,}|e/i.test(t))) E('G03', 'Souřadnice mají více než 2 desetinná místa');
        const bad = ring.pts.find(p => !(p[0] > -1000000 && p[0] < -300000 && p[1] > -1400000 && p[1] < -800000));
        if (bad) E('G04', 'Souřadnice mimo rozsah S-JTSK pro ČR (X=' + bad[0] + ', Y=' + bad[1] + '), překlep nebo prohozené osy?');
        const min = { bod: 1, linie: 2, plocha: 4 }[g.kind];
        if (ring.pts.length < min) E('G08', 'Příliš málo bodů (' + ring.pts.length + ', min. ' + min + ')');
        else if (g.kind === 'plocha') { const a = ring.pts[0], z = ring.pts[ring.pts.length - 1]; if (a[0] !== z[0] || a[1] !== z[1]) E('G07', 'Prstenec plochy není uzavřený'); } }); }); });
}

/* ---------- T: platnost geometrie, samokřížení ---------- */
function checkTopo(m, o, add) {
  m.blocks.forEach(b => b.recs.forEach(r => { if (!r.j) return; const g = r.geom, pts = g.rings[0].pts;
    if (g.kind === 'linie') { let dup = 0, sh = 0, dl = null, sl = null, len = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len += d;
        if (d === 0) { dup++; dl = dl || pts[i]; } else if (d < o.minSeg) { sh++; sl = sl || pts[i]; } }
      if (len === 0) add('ERR', 'T03', 'Linie má nulovou délku', r, fp(r));
      else { if (dup) add('WARN', 'T01', 'Opakované shodné vrcholy (' + dup + '×)', r, dl);
        if (sh) add('WARN', 'T02', 'Segment kratší než ' + o.minSeg + ' m (' + sh + '×)', r, sl);
        const s = new jsts.operation.IsSimpleOp(r.j); if (!s.isSimple()) { const c = s.getNonSimpleLocation();
          add(o.lineSelfSev, 'T04', 'Samokřížení nebo samodotyk linie', r, c ? [c.x, c.y] : fp(r)); } } }
    else if (g.kind === 'plocha') { if (r.verr) add('ERR', 'T05', 'Neplatná plocha: ' + r.verr.getMessage(), r, [r.verr.getCoordinate().x, r.verr.getCoordinate().y]);
      else if (r.j.getArea() <= 0) add('ERR', 'T03', 'Plocha má nulovou výměru', r, fp(r)); } }));
}

/* ---------- Z: výšky ---------- */
function checkZ(m, o, add) {
  m.blocks.forEach(b => b.recs.forEach(r => { const g = r.geom; if (!g || r.bad || g.dim < 3) return;
    const pts = [].concat(...g.rings.map(x => x.pts)), nz = pts.filter(p => p[2] !== 0), xy = fp(r);
    if (!nz.length) { add('WARN', 'Z01', 'Všechny výšky jsou 0.00 (výška nebyla zapsána?)', r, xy); return; }
    if (nz.length < pts.length) add('WARN', 'Z03', 'Část vrcholů má výšku 0.00 (' + (pts.length - nz.length) + ' z ' + pts.length + ')', r, xy);
    const out = nz.find(p => p[2] < o.zMin || p[2] > o.zMax); if (out) add('WARN', 'Z02', 'Výška ' + out[2] + ' m mimo očekávaný rozsah ' + o.zMin + '–' + o.zMax + ' m n. m.', r, out);
    if (g.kind !== 'bod') { const p = g.rings[0].pts; for (let i = 1; i < p.length; i++) if (p[i][2] && p[i - 1][2] && Math.abs(p[i][2] - p[i - 1][2]) > o.maxZJump) {
      add('WARN', 'Z04', 'Skok výšky ' + Math.abs(p[i][2] - p[i - 1][2]).toFixed(2) + ' m mezi sousedními vrcholy (limit ' + o.maxZJump + ' m)', r, p[i]); break; } } }));
}

/* ---------- D: duplicity a překryvy v rámci bloku ---------- */
function checkDup(m, o, add) {
  const s = a => a.map(p => p[0] + ' ' + p[1]).join(',');
  m.blocks.forEach(b => { const rs = b.recs.filter(r => r.j && !r.bad); if (rs.length < 2) return;
    const kind = rs[0].geom.kind, seen = new Map();
    rs.forEach(r => { let key = r.geom.rings.map(x => s(x.pts)).join('|');
      if (kind === 'linie') { const rv = s(r.geom.rings[0].pts.slice().reverse()); if (rv < key) key = rv; }
      if (seen.has(key)) { add('ERR', 'D01', 'Duplicitní geometrie, shodná s objektem na řádku ' + seen.get(key).line, r, fp(r)); r.dup = true; } else seen.set(key, r); });
    const items = rs.filter(r => !r.dup).map((r, i) => ({ r, i })), pad = kind === 'bod' ? o.tolDupPoint : 0, G = new Grid(25);
    items.forEach(it => G.add(it, envOf(it.r, pad)));
    items.forEach(a => G.query(envOf(a.r, pad)).forEach(c => { if (c.i <= a.i) return; const A = a.r, B = c.r;
      try { if (kind === 'bod') { const pa = A.geom.rings[0].pts[0], pb = B.geom.rings[0].pts[0];
          if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < o.tolDupPoint) add('WARN', 'D02', 'Body blíž než ' + o.tolDupPoint + ' m (objekt na řádku ' + B.line + ')', A, fp(A)); }
        else if (kind === 'plocha' && !A.verr && !B.verr) { const x = A.j.intersection(B.j), ar = x.getArea();
          if (ar > o.minOverlapArea) { const c0 = x.getInteriorPoint().getCoordinate(); add('WARN', 'D03', 'Překryv ploch ' + ar.toFixed(2) + ' m² s objektem na řádku ' + B.line, A, [c0.x, c0.y]); } }
        else if (kind === 'linie') { const x = A.j.intersection(B.j);
          if (x.getLength() > o.minOverlapLen) { const c0 = x.getCoordinate(); add('WARN', 'D04', 'Překryv linií ' + x.getLength().toFixed(2) + ' m s objektem na řádku ' + B.line, A, [c0.x, c0.y]); } }
      } catch (e) { /* neplatná topologie – řeší T */ } })); });
}

/* ---------- N: návaznost sítí (volné konce, mezery) ---------- */
function checkNet(m, o, add, GF) {
  const net = new Set(o.networkBlocks || m.blocks.filter(b => b.root.indexOf('Trasa') === 0).map(b => b.root)), T = new Grid(25);
  m.blocks.forEach(b => b.recs.forEach(r => { if (!r.j || r.bad) return; if (r.geom.kind === 'linie' && !net.has(b.root)) return; T.add(r, envOf(r)); }));
  m.blocks.filter(b => net.has(b.root)).forEach(b => b.recs.forEach(r => { if (!r.j || r.bad || r.geom.kind !== 'linie') return;
    const p = r.geom.rings[0].pts, ends = [p[0], p[p.length - 1]]; if (ends[0][0] === ends[1][0] && ends[0][1] === ends[1][1]) return;
    ends.forEach(e => { const pt = GF.createPoint(new jsts.geom.Coordinate(e[0], e[1])); let dmin = Infinity;
      T.query([e[0] - o.gapMax, e[1] - o.gapMax, e[0] + o.gapMax, e[1] + o.gapMax]).forEach(t => { if (t === r) return;
        const d = jsts.operation.distance.DistanceOp.distance(pt, t.j); if (d < dmin) dmin = d; });
      if (dmin <= o.tolConnect) return;
      if (dmin <= o.gapMax) add('WARN', 'N02', 'Mezera ' + dmin.toFixed(2) + ' m mezi koncem linie a nejbližším objektem (tolerance napojení ' + o.tolConnect + ' m)', r, [e[0], e[1]]);
      else add('WARN', 'N01', 'Volný konec linie (nenavazuje na jinou trasu, bod ani plochu)', r, [e[0], e[1]]); }); }));
}

function validate(doc, raw, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {}); o.groups = Object.assign({}, DEFAULTS.groups, (opts || {}).groups);
  const issues = [], add = (sev, code, msg, rec, xy) => issues.push({ sev, code, msg, block: rec ? rec.blk.nazev : '', root: rec ? rec.blk.root : '',
    rec: rec ? rec.idx : 0, line: rec ? rec.line : 0, ref: rec ? ((rec.geom && rec.geom.gid) || rec.id) : '', x: xy ? xy[0] : null, y: xy ? xy[1] : null, r: rec || null });
  const m = parse(doc, raw, add), ver = (o.version && o.version !== 'auto') ? o.version : m.version;
  if (o.groups.S && root.JVFSyntax) root.JVFSyntax.check(doc, m, o, add, ver || '?');
  checkFormat(m, o, add); const GF = prepare(m), g = o.groups;
  if (g.T) checkTopo(m, o, add); if (g.Z) checkZ(m, o, add); if (g.D) checkDup(m, o, add); if (g.N) checkNet(m, o, add, GF);
  return { model: m, issues };
}
const api = { validate, DEFAULTS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JVFCheck = api;
})(typeof window !== 'undefined' ? window : globalThis);
