/* jvf_syntax.js – syntaktická a strukturní kontrola JVF DTM podle datového modelu verze (JVF_MODELS[verze]).
   Kontroluje: kořen a hlavičku, namespace, názvy a pořadí elementů, povinné/nepovolené atributy, typy a číselníky hodnot. */
(function (root) {
'use strict';
const NS = { objtyp: 'objtyp', cmn: 'cmn', atr: 'atr', gml: 'http://www.opengis.net/gml/3.2', dopinf: 'dopinf' };
const ln = e => e.localName || e.nodeName.split(':').pop(), nsu = e => e.namespaceURI || '';
const kids = e => Array.from(e.childNodes).filter(n => n.nodeType === 1);
/* názvy elementů objektů ve schématu objtyp, které se liší od kořene v objektovém XSD (dle výdeje DMVS a přejímky kraje) */
const OBJTYP = { ObjektStokoveSiteBod: 'ObjektstokoveSiteBod', ObjektStokoveSitePlocha: 'ObjektstokoveSitePlocha' };
const GP = { bod: 'pointProperty', linie: 'curveProperty', plocha: 'surfaceProperty', multi: 'multiCurveProperty' };

function bad(d, v) {
  if (!d || d.b === 'any') return '';
  const list = en => Object.keys(en).slice(0, 12).join(', ') + (Object.keys(en).length > 12 ? ', …' : '');
  if (d.b === 'int') { if (!/^[+-]?\d+$/.test(v.trim())) return 'není celé číslo'; const n = +v;
    if (d.en && !Object.keys(d.en).some(k => +k === n)) return 'není v číselníku (povoleno: ' + list(d.en) + ')';
    if (d.min != null && n < d.min) return 'je menší než ' + d.min; if (d.max != null && n > d.max) return 'je větší než ' + d.max; return ''; }
  if (d.b === 'dec') { if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(v.trim())) return 'není číslo';
    if (d.fd != null && (v.split('.')[1] || '').length > d.fd) return 'má více než ' + d.fd + ' desetinných míst'; return ''; }
  if (d.b === 'bool') return /^(true|false|0|1)$/.test(v.trim()) ? '' : 'není true/false';
  if (d.b === 'date') return /^-?\d{4,}-\d\d-\d\d(Z|[+-]\d\d:\d\d)?$/.test(v.trim()) ? '' : 'není datum ve tvaru RRRR-MM-DD';
  if (d.b === 'dt') return /^-?\d{4,}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)?$/.test(v.trim()) ? '' : 'není datum a čas (RRRR-MM-DDThh:mm:ss)';
  if (d.en && !(v in d.en)) return 'není v číselníku (povoleno: ' + list(d.en) + ')';
  if (d.xl != null && v.length > d.xl) return 'je delší než ' + d.xl + ' znaků'; if (d.nl != null && v.length < d.nl) return 'je kratší než ' + d.nl + ' znaků';
  if (d.ln != null && v.length !== d.ln) return 'nemá délku ' + d.ln + ' znaků';
  if (d.pat) { try { if (!new RegExp('^(?:' + d.pat + ')$').test(v)) return 'neodpovídá povolenému vzoru'; } catch (e) { /* vzor nelze převést */ } }
  return '';
}

function check(doc, m, o, add0, ver) {
  const M = (root.JVF_MODELS || {})[ver];
  if (!M) { add0('INFO', 'S00', 'Model JVF DTM ' + ver + ' (XSD / datový model) není načten, syntaktická kontrola přeskočena'); return; }
  const cnt = new Map(), fp = r => { const p = r && r.geom && r.geom.rings[0] && r.geom.rings[0].pts[0]; return p ? [p[0], p[1]] : null; };
  const add = (sev, code, msg, rec) => { const k = code + '|' + msg, c = (cnt.get(k) || 0) + 1; cnt.set(k, c); if (c <= 25) add0(sev, code, msg, rec || null, fp(rec)); };
  const first = m.blocks.length && m.blocks[0].recs[0];
  const rt = doc.documentElement;

  /* hlavička */
  if (ln(rt) !== 'JVFDTM' || nsu(rt) !== NS.objtyp) add('ERR', 'S01', 'Kořenový element musí být JVFDTM v namespace „objtyp“ (nalezeno „' + nsu(rt) + '“: ' + ln(rt) + ')');
  const dj = kids(rt).find(e => ln(e) === 'DataJVFDTM');
  if (!dj) { add('ERR', 'S01', 'Chybí element DataJVFDTM'); return; }
  if (nsu(dj) !== NS.objtyp) add('ERR', 'S03', 'DataJVFDTM je v namespace „' + nsu(dj) + '“, očekáváno „objtyp“');
  const seq = [['VerzeJVFDTM', NS.cmn], ['DatumZapisu', NS.cmn], ['TypZapisu', NS.cmn], ['Data', NS.objtyp], ['DoprovodneInformace', NS.dopinf]]; let last = -1;
  kids(dj).forEach(e => { const i = seq.findIndex(s => s[0] === ln(e));
    if (i < 0) { add('ERR', 'S02', 'Neznámý element „' + ln(e) + '“ v DataJVFDTM'); return; }
    if (nsu(e) !== seq[i][1]) add('ERR', 'S03', 'Element ' + ln(e) + ' je v namespace „' + nsu(e) + '“, očekáváno „' + seq[i][1] + '“');
    if (i < last) add('ERR', 'S02', 'Element ' + ln(e) + ' je ve špatném pořadí'); last = Math.max(last, i);
    if (ln(e) === 'DatumZapisu' && bad({ b: 'dt' }, e.textContent.trim())) add('ERR', 'S08', 'DatumZapisu „' + e.textContent.trim() + '“ ' + bad({ b: 'dt' }, e.textContent.trim()));
    if (ln(e) === 'DoprovodneInformace') Array.from(e.getElementsByTagNameNS('*', '*')).forEach(x => { const u = nsu(x);
      if (u !== NS.dopinf && u !== NS.gml && !(u === NS.atr && ln(x) === 'PopisObjektu')) add('ERR', 'S03', 'Element „' + ln(x) + '“ v DoprovodneInformace je v namespace „' + u + '“, očekáváno „dopinf“'); }); });
  ['VerzeJVFDTM', 'DatumZapisu', 'TypZapisu', 'Data'].forEach(n => { if (!kids(dj).some(e => ln(e) === n)) add('ERR', 'S02', 'Chybí povinný element ' + n); });

  /* mapování názvů objektů */
  const byName = {}, byLow = {}; Object.keys(M.obj).forEach(k => { const n = OBJTYP[k] || k; byName[n] = M.obj[k]; byLow[n.toLowerCase()] = n; });

  const val = (c, n, def, rec, loc) => { const d = (def.l && def.l[n]) || M.atr[n];
    if (!d) { add('WARN', 'S08', 'Atribut ' + n + ' nemá v modelu definici', rec); return; }
    if (kids(c).length) { add('ERR', 'S08', 'Atribut ' + n + ' má obsahovat pouze hodnotu', rec); return; }
    const v = c.textContent; if (v.trim() === '' && d.b !== 'str') { add('ERR', 'S08', 'Atribut ' + n + ' je prázdný', rec); return; }
    const e = bad(d, v); if (e) add('ERR', 'S08', 'Atribut ' + n + ' = „' + v.trim().slice(0, 40) + '“ ' + e, rec); };
  const members = (el, exp, what, rec, onLeaf) => { const seen = new Set(), E = new Map(exp.map(([n, r]) => [n, r]));
    kids(el).forEach(c => { const n = ln(c);
      if (!E.has(n)) { add('ERR', 'S07', 'Nepovolený element „' + n + '“ v ' + what, rec); return; }
      if (nsu(c) !== NS.atr) add('ERR', 'S03', 'Element „' + n + '“ je v namespace „' + nsu(c) + '“, očekáváno „atr“', rec);
      if (seen.has(n)) add('ERR', 'S07', 'Element „' + n + '“ se v ' + what + ' opakuje', rec); seen.add(n); onLeaf(c, n); });
    E.forEach((req, n) => { if (req && !seen.has(n)) add('ERR', 'S06', 'Chybí povinný atribut „' + n + '“ v ' + what, rec); }); };

  /* objektové bloky */
  m.blocks.forEach(b => { const el = b.el, name = ln(el), rec0 = b.recs[0] || first, def = byName[name];
    if (nsu(el) !== NS.objtyp) add('ERR', 'S03', 'Blok „' + name + '“ je v namespace „' + nsu(el) + '“, očekáváno „objtyp“', rec0);
    if (!def) { const ci = byLow[name.toLowerCase()];
      add('ERR', 'S10', ci ? 'Element „' + name + '“ ve schématu ' + ver + ' neexistuje, správný název je „' + ci + '“ (velikost písmen)' : 'Neznámý objektový typ „' + name + '“ ve verzi ' + ver, rec0); return; }
    if (o.casts && def.cast && !o.casts[def.cast]) add('ERR', 'S12', 'Objekt „' + b.nazev + '“ patří do části ' + def.cast + ', která není ve zvoleném rozsahu editace (přejímka kraje ho odmítne)', rec0);
    const bs = ['ObjektovyTypNazev', 'KategorieObjektu', 'SkupinaObjektu', 'ObsahovaCast', 'ZaznamyObjektu'], fx = { ObjektovyTypNazev: def.nm, KategorieObjektu: def.kat, SkupinaObjektu: def.sk, ObsahovaCast: def.cast }; let lb = -1;
    kids(el).forEach(c => { const n = ln(c), i = bs.indexOf(n);
      if (i < 0) { add('ERR', 'S02', 'Neznámý element „' + n + '“ v bloku ' + name, rec0); return; }
      if (nsu(c) !== def.ns) add('ERR', 'S03', 'Element ' + n + ' v bloku ' + name + ' je v namespace „' + nsu(c) + '“, očekáváno „' + def.ns + '“', rec0);
      if (i < lb) add('ERR', 'S02', 'Element ' + n + ' v bloku ' + name + ' je ve špatném pořadí', rec0); lb = Math.max(lb, i);
      if (fx[n] != null && n !== 'ZaznamyObjektu' && c.textContent.trim() !== fx[n]) add('ERR', 'S05', n + ' = „' + c.textContent.trim() + '“, očekáváno „' + fx[n] + '“ (' + name + ')', rec0);
      if (n === 'ObjektovyTypNazev') { if (def.cb && c.getAttribute('code_base') !== def.cb) add('ERR', 'S05', 'code_base = „' + c.getAttribute('code_base') + '“, očekáváno „' + def.cb + '“ (' + name + ')', rec0);
        if (def.cs && c.getAttribute('code_suffix') !== def.cs) add('ERR', 'S05', 'code_suffix = „' + c.getAttribute('code_suffix') + '“, očekáváno „' + def.cs + '“ (' + name + ')', rec0); } });
    bs.forEach(n => { if (!kids(el).some(c => ln(c) === n)) add('ERR', 'S02', 'V bloku ' + name + ' chybí element ' + n, rec0); });

    b.recs.forEach(r => { const rs = [['ZapisObjektu', NS.cmn], ['AtributyObjektu', def.ns], ['GeometrieObjektu', def.ns], ['OblastObjektuKI', NS.atr]]; let lr = -1;
      kids(r.el).forEach(c => { const n = ln(c), i = rs.findIndex(s => s[0] === n);
        if (i < 0) { add('ERR', 'S02', 'Neznámý element „' + n + '“ v záznamu objektu', r); return; }
        if (nsu(c) !== rs[i][1]) add('ERR', 'S03', 'Element ' + n + ' je v namespace „' + nsu(c) + '“, očekáváno „' + rs[i][1] + '“', r);
        if (i < lr) add('ERR', 'S02', 'Element ' + n + ' je v záznamu ve špatném pořadí', r); lr = Math.max(lr, i); });
      const g = n => kids(r.el).find(c => ln(c) === n);
      if (!g('ZapisObjektu')) add('ERR', 'S02', 'V záznamu chybí ZapisObjektu', r);
      if (!g('AtributyObjektu')) add('ERR', 'S02', 'V záznamu chybí AtributyObjektu', r);
      if (!g('GeometrieObjektu') && def.gr) add('ERR', 'S09', 'V záznamu chybí povinná GeometrieObjektu', r);
      if (g('OblastObjektuKI') && !def.ki) add('ERR', 'S07', 'OblastObjektuKI není pro tento objekt povolena', r);
      const ao = g('AtributyObjektu');
      if (ao) members(ao, def.a, 'AtributyObjektu', r, (c, n) => {
        if (M.groups[n]) members(c, M.groups[n], n, r, (x, xn) => val(x, xn, def, r)); else val(c, n, def, r); });
      const go = g('GeometrieObjektu');
      if (go) { const gc = kids(go), want = GP[def.g];
        if (!gc.length || (want && (ln(gc[0]) !== want || nsu(gc[0]) !== NS.gml))) add('ERR', 'S09', 'Geometrie má být gml:' + want + ' (' + def.g + '), nalezeno „' + (gc[0] ? ln(gc[0]) : 'nic') + '“', r);
        if (gc.length > 1) add('ERR', 'S09', 'GeometrieObjektu smí obsahovat jen jednu geometrii', r); } }); });

  cnt.forEach((c, k) => { if (c > 25) add0('INFO', 'S99', 'Nález „' + k.split('|')[1].slice(0, 90) + '“ se opakuje celkem ' + c + '×, zobrazeno prvních 25', null, null); });
}
const api = { check, OBJTYP };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JVFSyntax = api;
})(typeof window !== 'undefined' ? window : globalThis);
