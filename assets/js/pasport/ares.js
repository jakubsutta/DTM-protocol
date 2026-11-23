/**
 * Doplnění údajů objednatele z ARES (Administrativní registr ekonomických subjektů).
 * K poli IČO/DIČ přidá tlačítko „ARES“:
 *  - je-li vyplněné IČO → načte přímo daný subjekt,
 *  - jinak hledá obec podle názvu (právní forma 801 = obec/město/městys); více shod → výběr,
 *    shody se zužují podle vyplněného okresu.
 * Doplní: IČO/DIČ, adresu a (pokud je prázdný) objednatele.
 *
 * Vyžaduje core.js.
 */
(function () {
    'use strict';

    var C = window.PasportCore;
    var API = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';
    var icoInput = document.getElementById('icoDic');
    if (!icoInput) return;

    var style = document.createElement('style');
    style.textContent = [
        '.pp-ares-row{display:flex;gap:6px;align-items:stretch;}',
        '.pp-ares-row input{flex:1;min-width:0;}',
        '.pp-ares-btn{flex-shrink:0;border:none;border-radius:4px;padding:0 10px;font-family:inherit;font-size:11px;font-weight:800;letter-spacing:.03em;cursor:pointer;background:var(--pp-primary,#555);color:var(--pp-primary-fg,#fff);display:flex;align-items:center;gap:5px;}',
        '.pp-ares-btn:hover{filter:brightness(.92);}',
        '.pp-ares-btn[disabled]{opacity:.6;cursor:wait;}',
        '.pp-ares-btn svg{width:13px;height:13px;}'
    ].join('\n');
    document.head.appendChild(style);

    var row = document.createElement('div');
    row.className = 'pp-ares-row';
    icoInput.parentNode.insertBefore(row, icoInput);
    row.appendChild(icoInput);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pp-ares-btn';
    btn.title = 'Doplnit IČO, DIČ a adresu z registru ARES (podle IČO, případně podle názvu obce)';
    btn.setAttribute('data-preview-target', 'p-icoDic');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>ARES';
    row.appendChild(btn);

    function norm(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function withTimeout(p, ms) {
        return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('ARES neodpovídá')); }, ms); })]);
    }

    function getJson(url, opts) {
        return withTimeout(fetch(url, opts).then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) throw new Error('ARES vrátil chybu ' + r.status);
            return r.json();
        }), 10000);
    }

    function formatPsc(psc) {
        var s = String(psc || '').replace(/\s/g, '');
        return s.length === 5 ? s.slice(0, 3) + ' ' + s.slice(3) : s;
    }

    // „Ulice č.p./č.o., PSČ Obec“ (dle placeholderu formuláře)
    function formatAdresa(s) {
        if (!s) return '';
        var cislo = s.cisloDomovni != null ? String(s.cisloDomovni) : '';
        if (s.cisloOrientacni != null) cislo += '/' + s.cisloOrientacni + (s.cisloOrientacniPismeno || '');
        var ulice = s.nazevUlice ? s.nazevUlice + ' ' + cislo : (s.nazevCastiObce && s.nazevCastiObce !== s.nazevObce ? s.nazevCastiObce + ' ' + cislo : (cislo ? 'č.p. ' + cislo : ''));
        var obec = s.nazevObce || '';
        var line2 = (formatPsc(s.psc) + ' ' + obec).trim();
        var out = [ulice.trim(), line2].filter(Boolean).join(', ');
        return out || s.textovaAdresa || '';
    }

    function setField(id, value) {
        var el = document.getElementById(id);
        if (!el || value == null) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applySubject(s) {
        var ico = s.ico || s.icoId || '';
        setField('icoDic', ico + (s.dic ? '/' + s.dic : ''));
        var adr = formatAdresa(s.sidlo);
        if (adr) setField('adresa', adr);
        var obj = document.getElementById('objednatel');
        if (obj && !obj.value.trim() && s.obchodniJmeno) setField('objednatel', s.obchodniJmeno);
        if (typeof window.updatePreview === 'function') window.updatePreview();
        C.toast('Doplněno z ARES: ' + (s.obchodniJmeno || '') + ' (IČO ' + ico + ')');
    }

    function pick(list) {
        var ul = document.createElement('ul');
        ul.className = 'pp-list';
        var holder = document.createElement('div');
        var p = document.createElement('p');
        p.textContent = 'V ARES je víc obcí tohoto názvu. Vyberte tu správnou:';
        holder.appendChild(p);
        holder.appendChild(ul);
        return C.modal({
            title: 'Výběr obce z ARES',
            node: holder,
            buttons: [{ label: 'Zrušit', value: null, kind: 'ghost' }],
            onOpen: function (body, close) {
                list.forEach(function (s) {
                    var li = document.createElement('li');
                    var sid = s.sidlo || {};
                    li.innerHTML = '<span class="pp-ico">🏛</span><span><b>' + C.esc(s.obchodniJmeno) + '</b><small>' +
                        C.esc([formatAdresa(sid), sid.nazevOkresu ? 'okres ' + sid.nazevOkresu : '', 'IČO ' + s.ico].filter(Boolean).join(' · ')) +
                        '</small></span>';
                    li.addEventListener('click', function () { close(s); });
                    ul.appendChild(li);
                });
            }
        });
    }

    function byIco(ico) {
        return getJson(API + '/' + encodeURIComponent(ico)).then(function (s) {
            if (!s) throw new Error('Subjekt s IČO ' + ico + ' v ARES neexistuje.');
            return s;
        });
    }

    // Kódy všech obcí daného názvu z RÚIAN (stejnojmenných obcí bývá víc – např. Lhota).
    function ruianKody(name) {
        var url = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/12/query' +
            '?where=' + encodeURIComponent("nazev='" + name.replace(/'/g, "''") + "'") +
            '&outFields=kod&returnGeometry=false&f=json';
        return getJson(url).then(function (d) {
            return ((d && d.features) || []).map(function (f) { return f.attributes.kod; }).slice(0, 20);
        });
    }

    // Úřad obce (právní forma 801) podle kódu obce v sídle.
    function byKodObce(kod, name) {
        return getJson(API + '/vyhledat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sidlo: { kodObce: Number(kod) }, pravniForma: ['801'], pocet: 10 })
        }).then(function (data) {
            var list = (data && data.ekonomickeSubjekty) || [];
            var target = norm(name);
            return list.find(function (s) { return norm(s.obchodniJmeno).indexOf(target) !== -1; }) || list[0] || null;
        });
    }

    function filterOkres(cands) {
        var okres = norm(C.val('okres'));
        if (okres && cands.length > 1) {
            var inOkres = cands.filter(function (s) { return norm(s.sidlo && s.sidlo.nazevOkresu) === okres; });
            if (inOkres.length) return inOkres;
        }
        return cands;
    }

    function byName(name) {
        return ruianKody(name).then(function (kody) {
            if (!kody.length) return byNameSearch(name);
            return Promise.all(kody.map(function (k) { return byKodObce(k, name).catch(function () { return null; }); }))
                .then(function (list) {
                    list = list.filter(Boolean);
                    return list.length ? filterOkres(list) : byNameSearch(name);
                });
        }, function () { return byNameSearch(name); });
    }

    // Záložní hledání podle obchodního jména (když RÚIAN neodpoví).
    function byNameSearch(name) {
        return getJson(API + '/vyhledat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obchodniJmeno: name, pravniForma: ['801'], pocet: 50 })
        }).then(function (data) {
            var list = (data && data.ekonomickeSubjekty) || [];
            var target = norm(name);
            // přesná shoda názvu obce v sídle, případně „Obec/Město/Městys <název>“
            var exact = list.filter(function (s) {
                var jm = norm(s.obchodniJmeno).replace(/^(obec|mesto|mestys|statutarni mesto)\s+/, '');
                return norm(s.sidlo && s.sidlo.nazevObce) === target || jm === target;
            });
            return filterOkres(exact.length ? exact : list);
        });
    }

    btn.addEventListener('click', function () {
        var icoMatch = icoInput.value.replace(/\s/g, '').match(/\d{6,8}/);
        var name = C.obecName() || C.val('objednatel').replace(/^(obec|město|městys|statutární město)\s+/i, '');
        if (!icoMatch && !name) {
            C.modal({ title: 'ARES', html: '<p>Vyplňte nejdřív IČO, nebo vyhledejte obec v mapě / zadejte název obce.</p>' });
            return;
        }
        btn.disabled = true;
        var job = icoMatch
            ? byIco(icoMatch[0].padStart(8, '0')).then(applySubject)
            : byName(name).then(function (cands) {
                if (!cands.length) throw new Error('V ARES jsem nenašel obec „' + name + '“. Zkuste zadat IČO.');
                if (cands.length === 1) { applySubject(cands[0]); return; }
                return pick(cands).then(function (s) { if (s) applySubject(s); });
            });
        job.catch(function (e) {
            C.modal({ title: 'ARES', html: '<p>' + C.esc(e.message || 'Načtení z ARES selhalo.') + '</p>' });
        }).then(function () { btn.disabled = false; });
    });
})();
