/**
 * Generátor map – levý panel (záložky Stránka, Mapa, Prvky, Legenda)
 * Panel jen čte/zapisuje MapApp.doc a volá překreslení náhledu.
 */

window.MapApp = window.MapApp || {};

const $ = (id) => document.getElementById(id);

MapApp.panel = {
    init() {
        this.bindTabs();
        this.bindPage();
        this.bindMap();
        this.bindLegendSettings();
        this.syncAll();
    },

    syncAll() {
        this.syncPage();
        this.syncMap();
        this.renderGuideLists();
        this.renderItemCards();
        this.syncLegendSettings();
        MapApp.legend.renderEditor();
    },

    /* =========================== Záložky =========================== */
    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
    },

    switchTab(tabId) {
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.toggle('active', el.id === tabId));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
        try { localStorage.setItem('jenda-mapgen-tab', tabId); } catch (e) { /* nevadí */ }
    },

    /* =========================== Stránka =========================== */
    bindPage() {
        const doc = () => MapApp.doc;

        document.querySelectorAll('[name="pageFormat"]').forEach(r => r.addEventListener('change', () => this.changePage(r.value, null)));
        document.querySelectorAll('[name="pageOrient"]').forEach(r => r.addEventListener('change', () => this.changePage(null, r.value)));

        $('guidesShow').addEventListener('change', (e) => {
            doc().guides.show = e.target.checked;
            MapApp.layout.renderGuides();
            MapApp.app.save();
        });
        $('guidesSnap').addEventListener('change', (e) => {
            doc().guides.snap = e.target.checked;
            MapApp.app.save();
        });
        $('btnGuideAddH').addEventListener('click', () => this.addGuide('h'));
        $('btnGuideAddV').addEventListener('click', () => this.addGuide('v'));
        $('btnGuidesReset').addEventListener('click', () => {
            const [W, H] = MapApp.layout.pageSize();
            const m = MapApp.CONFIG.DEFAULT_MARGINS;
            doc().guides.h = [m.top, H - m.bottom];
            doc().guides.v = [m.left, W - m.right];
            this.guidesChanged();
        });

        $('frameLinked').addEventListener('change', (e) => {
            doc().frame.linked = e.target.checked;
            if (e.target.checked) MapApp.layout.setFrame(MapApp.layout.frameFromGuides());
            this.syncPage();
            MapApp.app.save();
        });
        ['frameX', 'frameY', 'frameW', 'frameH'].forEach(id => {
            $(id).addEventListener('change', () => {
                const f = {
                    x: parseFloat($('frameX').value) || 0,
                    y: parseFloat($('frameY').value) || 0,
                    w: Math.max(20, parseFloat($('frameW').value) || 0),
                    h: Math.max(20, parseFloat($('frameH').value) || 0)
                };
                MapApp.layout.setFrame(f);
                this.renderItemCards();
                MapApp.app.save();
            });
        });
        $('frameBorder').addEventListener('input', (e) => {
            doc().frame.border = Math.max(0, parseFloat(e.target.value) || 0);
            MapApp.layout.renderFrame();
            MapApp.app.save();
        });
        $('frameBorderColor').addEventListener('input', (e) => {
            doc().frame.borderColor = e.target.value;
            MapApp.layout.renderFrame();
            MapApp.app.save();
        });

        // Styl rámečků prvků
        const styleBind = (id, key, parse) => {
            $(id).addEventListener('input', (e) => {
                doc().style[key] = parse ? parse(e.target.value) : e.target.value;
                if (id === 'styleOpacity') $('styleOpacityVal').textContent = Math.round(doc().style.boxOpacity * 100) + ' %';
                MapApp.layout.applyStyleVars();
                MapApp.app.save();
            });
        };
        styleBind('styleBg', 'boxBg');
        styleBind('styleOpacity', 'boxOpacity', v => parseFloat(v));
        styleBind('styleBorder', 'boxBorder', v => Math.max(0, parseFloat(v) || 0));
        styleBind('styleBorderColor', 'boxBorderColor');
        styleBind('styleRadius', 'boxRadius', v => Math.max(0, parseFloat(v) || 0));
        styleBind('stylePadding', 'boxPadding', v => Math.max(0, parseFloat(v) || 0));
        styleBind('styleAccent', 'accent');
        styleBind('styleText', 'textColor');
        styleBind('styleInset', 'inset', v => Math.max(0, parseFloat(v) || 0));
    },

    changePage(format, orient) {
        const doc = MapApp.doc;
        const [oW, oH] = MapApp.layout.pageSize();
        const g = doc.guides;
        // Okraje z vodítek přeneseme na nový formát
        const margins = {
            left: Math.min(...g.v), right: oW - Math.max(...g.v),
            top: Math.min(...g.h), bottom: oH - Math.max(...g.h)
        };
        if (format) doc.page.format = format;
        if (orient) doc.page.orient = orient;
        const [W, H] = MapApp.layout.pageSize();
        if (g.v.length >= 2 && g.h.length >= 2 && isFinite(margins.left)) {
            g.v = [margins.left, W - margins.right].map(v => MapApp.round(v, 0.1));
            g.h = [margins.top, H - margins.bottom].map(v => MapApp.round(v, 0.1));
        } else {
            g.v = g.v.filter(v => v <= W);
            g.h = g.h.filter(v => v <= H);
        }
        MapApp.layout.renderPage();
        if (doc.frame.linked) {
            MapApp.layout.setFrame(MapApp.layout.frameFromGuides());
        } else {
            // Rám se nevejde → zmenšit na stránku
            const f = doc.frame;
            MapApp.layout.setFrame({ x: f.x, y: f.y, w: Math.min(f.w, W - f.x), h: Math.min(f.h, H - f.y) });
        }
        this.syncPage();
        this.renderGuideLists();
        this.renderItemCards();
        MapApp.canvasZoom.fitToView();
        MapApp.app.save();
    },

    syncPage() {
        const doc = MapApp.doc;
        document.querySelectorAll('[name="pageFormat"]').forEach(r => { r.checked = r.value === doc.page.format; });
        document.querySelectorAll('[name="pageOrient"]').forEach(r => { r.checked = r.value === doc.page.orient; });
        $('guidesShow').checked = doc.guides.show;
        $('guidesSnap').checked = doc.guides.snap;
        $('frameLinked').checked = doc.frame.linked;
        [['frameX', 'x'], ['frameY', 'y'], ['frameW', 'w'], ['frameH', 'h']].forEach(([id, k]) => {
            $(id).value = MapApp.fmtMm(doc.frame[k]);
            $(id).disabled = doc.frame.linked;
        });
        $('frameBorder').value = doc.frame.border;
        $('frameBorderColor').value = doc.frame.borderColor;
        const s = doc.style;
        $('styleBg').value = s.boxBg;
        $('styleOpacity').value = s.boxOpacity;
        $('styleOpacityVal').textContent = Math.round(s.boxOpacity * 100) + ' %';
        $('styleBorder').value = s.boxBorder;
        $('styleBorderColor').value = s.boxBorderColor;
        $('styleRadius').value = s.boxRadius;
        $('stylePadding').value = s.boxPadding;
        $('styleAccent').value = s.accent;
        $('styleText').value = s.textColor;
        $('styleInset').value = s.inset;
    },

    /* --- seznamy vodítek (jako v QGIS) --- */
    renderGuideLists() {
        ['h', 'v'].forEach(axis => {
            const box = $(axis === 'h' ? 'guidesListH' : 'guidesListV');
            box.innerHTML = '';
            const list = MapApp.doc.guides[axis];
            if (!list.length) {
                box.innerHTML = '<div class="guide-empty">Žádná vodítka</div>';
                return;
            }
            list.forEach((val, i) => {
                const row = document.createElement('div');
                row.className = 'guide-row';
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '0.5';
                inp.min = '0';
                inp.value = val;
                inp.addEventListener('change', () => {
                    const [W, H] = MapApp.layout.pageSize();
                    const max = axis === 'h' ? H : W;
                    list[i] = Math.max(0, Math.min(max, parseFloat(inp.value) || 0));
                    inp.value = list[i];
                    this.guidesChanged(true);
                });
                const unit = document.createElement('span');
                unit.className = 'unit';
                unit.textContent = 'mm';
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'mini-btn danger';
                del.textContent = '✕';
                del.title = 'Odebrat vodítko';
                del.addEventListener('click', () => {
                    list.splice(i, 1);
                    this.guidesChanged();
                });
                row.append(inp, unit, del);
                box.appendChild(row);
            });
        });
    },

    addGuide(axis) {
        const [W, H] = MapApp.layout.pageSize();
        const list = MapApp.doc.guides[axis];
        list.push(MapApp.round((axis === 'h' ? H : W) / 2, 0.5));
        this.guidesChanged();
        const box = $(axis === 'h' ? 'guidesListH' : 'guidesListV');
        const inputs = box.querySelectorAll('input');
        inputs[inputs.length - 1]?.select();
    },

    guidesChanged(keepList) {
        MapApp.layout.renderGuides();
        if (MapApp.doc.frame.linked) {
            MapApp.layout.setFrame(MapApp.layout.frameFromGuides());
            this.renderItemCards();
        }
        if (!keepList) this.renderGuideLists();
        this.syncPage();
        MapApp.app.save();
    },

    /* =========================== Mapa =========================== */
    bindMap() {
        const doc = () => MapApp.doc;

        // Měřítko
        const scaleInput = $('scaleInput');
        scaleInput.addEventListener('change', () => {
            const v = parseFloat(String(scaleInput.value).replace(/\s/g, ''));
            if (v > 0) MapApp.mapService.setScale(v);
        });
        $('scalePreset').addEventListener('change', (e) => {
            if (e.target.value) MapApp.mapService.setScale(parseFloat(e.target.value));
        });
        MapApp.CONFIG.SCALES.forEach(s => $('scalePreset').appendChild(new Option(MapApp.fmtScale(s), s)));
        $('btnScaleDown').addEventListener('click', () => MapApp.mapService.stepScale(-1));
        $('btnScaleUp').addEventListener('click', () => MapApp.mapService.stepScale(1));
        $('lockScale').addEventListener('change', (e) => {
            doc().map.lockScale = e.target.checked;
            MapApp.app.save();
        });

        // Podklad
        document.querySelectorAll('[name="basemap"]').forEach(r => r.addEventListener('change', () => {
            doc().map.basemap = r.value;
            MapApp.mapService.applyBasemap();
            MapApp.app.save();
        }));
        $('chkKn').addEventListener('change', (e) => {
            doc().map.kn = e.target.checked;
            MapApp.mapService.applyBasemap();
            this.syncMap();
            MapApp.app.save();
        });
        $('chkKnInverse').addEventListener('change', (e) => {
            doc().map.knInverse = e.target.checked;
            MapApp.mapService.applyBasemap();
            MapApp.app.save();
        });
        $('mapQuality').addEventListener('change', (e) => {
            doc().map.quality = parseFloat(e.target.value) || 2;
            MapApp.mapService.applyBasemap();
            MapApp.app.save();
        });

        // Vyhledání obce / části obce
        const inp = $('placeSearch');
        const list = $('placeSuggest');
        let timer = null, results = [], hi = -1;
        const close = () => { list.classList.remove('show'); list.innerHTML = ''; hi = -1; };
        const pick = async (r) => {
            close();
            inp.value = r.name;
            try {
                await MapApp.mapService.goToPlace(r);
            } catch (err) {
                MapApp.app.toast('Místo se nepodařilo najít: ' + err.message, true);
            }
        };
        const render = () => {
            list.innerHTML = results.map((r, i) =>
                `<div class="suggest-item${i === hi ? ' hi' : ''}" data-i="${i}"><span>${escapeHtml(r.name)}</span><small>${escapeHtml(r.note)}</small></div>`
            ).join('') || '<div class="suggest-empty">Nic nenalezeno</div>';
            list.classList.add('show');
        };
        inp.addEventListener('input', () => {
            clearTimeout(timer);
            const t = inp.value;
            if (t.trim().length < 2) { close(); return; }
            timer = setTimeout(async () => {
                try {
                    results = await MapApp.mapService.searchPlaces(t);
                    hi = results.length ? 0 : -1;
                    if (inp.value === t) render();
                } catch (err) {
                    results = [];
                    list.innerHTML = '<div class="suggest-empty">Vyhledávání RÚIAN není dostupné</div>';
                    list.classList.add('show');
                }
            }, 280);
        });
        inp.addEventListener('keydown', (e) => {
            if (!list.classList.contains('show')) return;
            if (e.key === 'ArrowDown') { hi = Math.min(results.length - 1, hi + 1); render(); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); render(); e.preventDefault(); }
            else if (e.key === 'Enter' && results[hi]) { pick(results[hi]); e.preventDefault(); }
            else if (e.key === 'Escape') close();
        });
        list.addEventListener('mousedown', (e) => {
            const row = e.target.closest('.suggest-item');
            if (row) { e.preventDefault(); pick(results[+row.dataset.i]); }
        });
        inp.addEventListener('blur', () => setTimeout(close, 150));
    },

    syncMap() {
        const m = MapApp.doc.map;
        document.querySelectorAll('[name="basemap"]').forEach(r => { r.checked = r.value === m.basemap; });
        $('chkKn').checked = !!m.kn;
        $('chkKnInverse').checked = !!m.knInverse;
        $('chkKnInverse').disabled = !m.kn;
        $('mapQuality').value = String(m.quality);
        $('lockScale').checked = !!m.lockScale;
        this.syncScaleInputs();
    },

    syncScaleInputs() {
        const s = MapApp.doc.map.scale;
        if (document.activeElement !== $('scaleInput')) $('scaleInput').value = s;
        $('scalePreset').value = MapApp.CONFIG.SCALES.includes(s) ? String(s) : '';
    },

    /* =========================== Prvky =========================== */
    renderItemCards() {
        const box = $('itemCards');
        const openIds = [...box.querySelectorAll('.item-card.open')].map(c => c.dataset.id);
        box.innerHTML = '';
        MapApp.doc.items.forEach(it => {
            box.appendChild(this._itemCard(it, openIds.includes(it.id)));
        });
        this.highlightItemCard(MapApp.state.selectedId);
    },

    _itemCard(it, open) {
        const card = document.createElement('div');
        card.className = 'item-card' + (open ? ' open' : '') + (it.visible ? '' : ' is-hidden');
        card.dataset.id = it.id;

        const head = document.createElement('div');
        head.className = 'item-head';
        const vis = document.createElement('input');
        vis.type = 'checkbox';
        vis.checked = it.visible;
        vis.title = 'Zobrazit v mapě';
        vis.addEventListener('click', (e) => e.stopPropagation());
        vis.addEventListener('change', () => {
            it.visible = vis.checked;
            card.classList.toggle('is-hidden', !it.visible);
            MapApp.layout.renderItem(it.id);
            MapApp.app.save();
        });
        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = it.name;
        const chev = document.createElement('span');
        chev.className = 'item-chev';
        chev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
        head.append(vis, name, chev);
        head.addEventListener('click', () => {
            card.classList.toggle('open');
            MapApp.layout.select(it.id);
        });
        card.appendChild(head);

        const body = document.createElement('div');
        body.className = 'item-body';
        this._itemFields(it, body);
        this._positionFields(it, body);
        card.appendChild(body);
        return card;
    },

    // Pomocné tvůrce polí
    _f(body, label, el, cls) {
        const wrap = document.createElement('div');
        wrap.className = 'field' + (cls ? ' ' + cls : '');
        if (label) {
            const l = document.createElement('label');
            l.textContent = label;
            wrap.appendChild(l);
        }
        wrap.appendChild(el);
        body.appendChild(wrap);
        return el;
    },

    _input(it, key, type, opts) {
        opts = opts || {};
        const el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') el.type = type || 'text';
        if (type === 'textarea') el.rows = opts.rows || 2;
        if (opts.step) el.step = opts.step;
        if (opts.min != null) el.min = opts.min;
        el.value = it[key] != null ? it[key] : '';
        el.dataset.key = key;
        el.addEventListener('input', () => {
            it[key] = (type === 'number') ? (parseFloat(el.value) || 0) : el.value;
            MapApp.layout.renderItem(it.id);
            MapApp.app.save();
        });
        return el;
    },

    _check(it, key, label) {
        const l = document.createElement('label');
        l.className = 'checkbox-label';
        const c = document.createElement('input');
        c.type = 'checkbox';
        c.checked = !!it[key];
        c.addEventListener('change', () => {
            it[key] = c.checked;
            MapApp.layout.renderItem(it.id);
            MapApp.app.save();
        });
        const s = document.createElement('span');
        s.textContent = label;
        l.append(c, s);
        return l;
    },

    _select(it, key, options, parse) {
        const s = document.createElement('select');
        options.forEach(([v, t]) => s.appendChild(new Option(t, v, false, String(it[key]) === String(v))));
        s.addEventListener('change', () => {
            it[key] = parse ? parse(s.value) : s.value;
            MapApp.layout.renderItem(it.id);
            MapApp.app.save();
        });
        return s;
    },

    _grid(body, cols, cells) {
        const g = document.createElement('div');
        g.className = 'grid' + cols;
        cells.forEach(([label, el]) => {
            const w = document.createElement('div');
            if (label) {
                const l = document.createElement('label');
                l.textContent = label;
                w.appendChild(l);
            }
            w.appendChild(el);
            g.appendChild(w);
        });
        const f = document.createElement('div');
        f.className = 'field';
        f.appendChild(g);
        body.appendChild(f);
        return g;
    },

    _itemFields(it, body) {
        const num = (k, step, min) => this._input(it, k, 'number', { step: step || 0.5, min: min != null ? min : 0 });

        if (it.type === 'title') {
            this._f(body, 'Nadpis', this._input(it, 'text', 'textarea'));
            this._f(body, 'Podnadpis', this._input(it, 'subtitle', 'textarea'));
            this._grid(body, 2, [['Písmo nadpisu (pt)', num('size')], ['Písmo podnadpisu (pt)', num('subSize')]]);
            this._f(body, '', this._check(it, 'accentLine', 'Barevná linka pod nadpisem'));
        } else if (it.type === 'text') {
            this._f(body, 'Text', this._input(it, 'text', 'textarea', { rows: 2 }));
            this._grid(body, 3, [
                ['Písmo (pt)', num('size')],
                ['Řez', this._select(it, 'weight', [[350, 'Tenký'], [400, 'Normální'], [600, 'Polotučný'], [700, 'Tučný'], [900, 'Černý']], v => +v)],
                ['Zarovnání', this._select(it, 'align', [['left', 'Vlevo'], ['center', 'Na střed'], ['right', 'Vpravo']])]
            ]);
        } else if (it.type === 'imprint') {
            const linesBox = document.createElement('div');
            linesBox.className = 'imprint-lines';
            const renderLines = () => {
                linesBox.innerHTML = '';
                it.lines.forEach((ln, i) => {
                    const row = document.createElement('div');
                    row.className = 'imprint-row';
                    const a = document.createElement('input');
                    a.type = 'text'; a.value = ln.label; a.placeholder = 'Popisek';
                    a.addEventListener('input', () => { ln.label = a.value; MapApp.layout.renderItem(it.id); MapApp.app.save(); });
                    const b = document.createElement('input');
                    b.type = 'text'; b.value = ln.value; b.placeholder = 'Hodnota';
                    b.addEventListener('input', () => { ln.value = b.value; MapApp.layout.renderItem(it.id); MapApp.app.save(); });
                    const d = document.createElement('button');
                    d.type = 'button'; d.className = 'mini-btn danger'; d.textContent = '✕'; d.title = 'Odebrat řádek';
                    d.addEventListener('click', () => { it.lines.splice(i, 1); renderLines(); MapApp.layout.renderItem(it.id); MapApp.app.save(); });
                    row.append(a, b, d);
                    linesBox.appendChild(row);
                });
                const add = document.createElement('button');
                add.type = 'button'; add.className = 'outline small'; add.textContent = '+ Přidat řádek';
                add.addEventListener('click', () => { it.lines.push({ label: '', value: '' }); renderLines(); MapApp.layout.renderItem(it.id); });
                linesBox.appendChild(add);
            };
            renderLines();
            this._f(body, 'Řádky tiráže (tučný popisek + hodnota)', linesBox);
            this._grid(body, 2, [
                ['Písmo (pt)', num('size')],
                ['Zarovnání', this._select(it, 'align', [['left', 'Vlevo'], ['center', 'Na střed'], ['right', 'Vpravo']])]
            ]);
        } else if (it.type === 'scale') {
            this._grid(body, 3, [
                ['Segmentů', num('segments', 1, 1)],
                ['Segment (m)', num('segLen', 1, 0)],
                ['Cíl. šířka (mm)', num('targetWidth', 5, 10)]
            ]);
            const hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = 'Délka segmentu 0 = automaticky „hezké“ číslo podle cílové šířky.';
            body.appendChild(hint);
            this._grid(body, 3, [
                ['Styl', this._select(it, 'barStyle', [['ticks', 'Linka s rysky'], ['bar', 'Pruhy']])],
                ['Jednotky', this._select(it, 'units', [['auto', 'Auto'], ['m', 'm'], ['km', 'km']])],
                ['Písmo (pt)', num('size')]
            ]);
            this._grid(body, 2, [
                ['', this._check(it, 'showRatio', 'Číselné měřítko')],
                ['Písmo čísel. (pt)', num('ratioSize')]
            ]);
        } else if (it.type === 'legend') {
            const p = document.createElement('div');
            p.className = 'hint';
            p.innerHTML = 'Položky, písmo a rozestupy legendy se upravují v záložce <a href="#" data-goto="tab-legenda">Legenda</a>.';
            p.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); this.switchTab('tab-legenda'); });
            body.appendChild(p);
        } else if (it.type === 'north') {
            this._grid(body, 2, [['Velikost (mm)', num('sizeMm', 1, 5)], ['', document.createElement('span')]]);
        }

        this._f(body, '', this._check(it, 'box', 'Rámeček s podkladem'));

        if (it.custom) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'outline small danger-text';
            del.textContent = 'Odstranit textové pole';
            del.addEventListener('click', () => {
                MapApp.doc.items = MapApp.doc.items.filter(i => i.id !== it.id);
                if (MapApp.state.selectedId === it.id) MapApp.state.selectedId = null;
                MapApp.layout.renderAllItems();
                this.renderItemCards();
                MapApp.app.save();
            });
            body.appendChild(del);
        }
    },

    _positionFields(it, body) {
        const sec = document.createElement('div');
        sec.className = 'pos-section';
        sec.innerHTML = '<div class="pos-title">Umístění</div>';

        const row = document.createElement('div');
        row.className = 'pos-row';

        // 3×3 mřížka: zarovnat do rohu/středu rámu mapy
        const grid = document.createElement('div');
        grid.className = 'align-grid';
        grid.title = 'Zarovnat k rámu mapy (s odsazením)';
        ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].forEach(a => {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.anchor = a;
            b.className = it.anchor === a ? 'active' : '';
            b.title = 'Zarovnat k rámu: ' + this._anchorName(a);
            b.addEventListener('click', () => this.alignTo(it.id, a));
            grid.appendChild(b);
        });

        const coords = document.createElement('div');
        coords.className = 'pos-coords';
        const mk = (axis) => {
            const w = document.createElement('label');
            w.className = 'pos-input';
            w.innerHTML = `<span>${axis.toUpperCase()}</span>`;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = '0.5';
            inp.value = MapApp.fmtMm(it[axis]);
            inp.dataset.pos = axis;
            inp.addEventListener('change', () => {
                it[axis] = parseFloat(inp.value) || 0;
                MapApp.layout.renderItem(it.id);
                MapApp.app.save();
            });
            const u = document.createElement('em');
            u.textContent = 'mm';
            w.append(inp, u);
            return w;
        };
        const anchorSel = document.createElement('select');
        anchorSel.dataset.pos = 'anchor';
        anchorSel.title = 'Referenční bod – roh prvku, ke kterému se vztahují souřadnice X/Y';
        Object.keys(MapApp.ANCHORS).forEach(a => anchorSel.appendChild(new Option(this._anchorName(a), a, false, it.anchor === a)));
        anchorSel.addEventListener('change', () => MapApp.layout.setAnchor(it.id, anchorSel.value));
        const anchorWrap = document.createElement('label');
        anchorWrap.className = 'pos-anchor';
        anchorWrap.innerHTML = '<span>Ref. bod</span>';
        anchorWrap.appendChild(anchorSel);

        coords.append(mk('x'), mk('y'), anchorWrap);
        row.append(grid, coords);
        sec.appendChild(row);
        body.appendChild(sec);
    },

    _anchorName(a) {
        return {
            tl: 'vlevo nahoře', tc: 'nahoře uprostřed', tr: 'vpravo nahoře',
            ml: 'vlevo uprostřed', mc: 'střed', mr: 'vpravo uprostřed',
            bl: 'vlevo dole', bc: 'dole uprostřed', br: 'vpravo dole'
        }[a] || a;
    },

    alignTo(id, a) {
        MapApp.layout.alignItem(id, a);
    },

    syncItemPosition(id) {
        const it = MapApp.layout.getItem(id);
        const card = document.querySelector(`.item-card[data-id="${CSS.escape(id)}"]`);
        if (!it || !card) return;
        card.querySelectorAll('[data-pos]').forEach(inp => {
            const k = inp.dataset.pos;
            if (document.activeElement === inp) return;
            inp.value = k === 'anchor' ? it.anchor : MapApp.fmtMm(it[k]);
        });
        card.querySelectorAll('.align-grid button').forEach(b => b.classList.toggle('active', b.dataset.anchor === it.anchor));
    },

    highlightItemCard(id) {
        document.querySelectorAll('.item-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
    },

    // Otevře kartu prvku (dvojklik v náhledu)
    openItem(id, focus) {
        const it = MapApp.layout.getItem(id);
        if (!it) return;
        if (it.type === 'legend') {
            this.switchTab('tab-legenda');
            return;
        }
        this.switchTab('tab-prvky');
        const card = document.querySelector(`.item-card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;
        card.classList.add('open');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (focus) {
            const f = card.querySelector('.item-body textarea, .item-body input[type="text"], .item-body input[type="number"]');
            if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 50);
        }
    },

    addCustomText() {
        const f = MapApp.doc.frame;
        const n = MapApp.doc.items.filter(i => i.custom).length + 1;
        const it = {
            id: 'text-' + Date.now().toString(36), type: 'text', custom: true,
            name: 'Textové pole ' + n, visible: true, box: true,
            x: f.x + f.w / 2, y: f.y + f.h / 2, anchor: 'mc',
            text: 'Nový text', size: 10, weight: 400, align: 'left'
        };
        MapApp.doc.items.push(it);
        MapApp.layout.renderItem(it.id);
        MapApp.layout.select(it.id);
        this.renderItemCards();
        this.openItem(it.id, true);
        MapApp.app.save();
    },

    /* =========================== Legenda – nastavení =========================== */
    bindLegendSettings() {
        const bind = (id, key, parse) => {
            $(id).addEventListener('input', () => {
                const it = MapApp.legend.legendItem();
                it[key] = parse ? parse($(id).value) : $(id).value;
                MapApp.legend.changed(key === 'patchW' || key === 'patchH');
            });
        };
        const f = (v) => parseFloat(v) || 0;
        bind('legTitle', 'title');
        bind('legTitleSize', 'titleSize', f);
        bind('legSize', 'size', f);
        bind('legHeaderSize', 'headerSize', f);
        bind('legRowGap', 'rowGap', f);
        bind('legPatchW', 'patchW', f);
        bind('legPatchH', 'patchH', f);
        bind('legColGap', 'colGap', f);
        bind('legFooter', 'footer');
        $('btnLegAddItem').addEventListener('click', () => MapApp.legend.addItem('line'));
        $('btnLegAddHeader').addEventListener('click', () => MapApp.legend.addItem('header'));
        $('btnLegReset').addEventListener('click', () => {
            if (confirm('Nahradit položky legendy výchozí legendou pasportu komunikací?')) MapApp.legend.resetDefault();
        });
        $('btnLegFromData').addEventListener('click', () => MapApp.legend.addFromData());
    },

    syncLegendSettings() {
        const it = MapApp.legend.legendItem();
        if (!it) return;
        $('legTitle').value = it.title || '';
        $('legTitleSize').value = it.titleSize;
        $('legSize').value = it.size;
        $('legHeaderSize').value = it.headerSize;
        $('legRowGap').value = it.rowGap;
        $('legPatchW').value = it.patchW;
        $('legPatchH').value = it.patchH;
        $('legColGap').value = it.colGap;
        $('legFooter').value = it.footer || '';
    }
};

// Kompatibilita se staršími moduly (data.js, labels.js)
MapApp.ui = {
    val(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    },
    num(id) {
        return parseFloat(this.val(id)) || 0;
    },
    toggleSymbolMode() {
        const mode = this.val('pointType');
        const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
        show('secVectorSym', mode === 'vector');
        show('secIconSym', mode !== 'vector');
        show('secIconUrl', mode === 'iconUrl');
        show('secSvgCode', mode === 'svgCode');
    },
    updateDecorations() {
        /* legenda je nezávislá na datech – nic */
    }
};
