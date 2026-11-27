/**
 * Generátor map – legenda: symboly (patche) a editor položek
 *
 * Druhy položek:
 *   header – nadpis skupiny,
 *   line   – linie (barva, šířka, lem/obrys, varianta „účelová“ s krajními bloky),
 *   fill   – plocha (výplň + obrys),
 *   point  – bod (kruh/čtverec),
 *   icon   – vestavěná značka (most, propustek, lávka),
 *   svg    – vlastní SVG kód.
 */

window.MapApp = window.MapApp || {};

MapApp.legend = {
    KINDS: [
        { value: 'header', text: 'Nadpis skupiny' },
        { value: 'line', text: 'Linie' },
        { value: 'fill', text: 'Plocha' },
        { value: 'point', text: 'Bod' },
        { value: 'icon', text: 'Značka' },
        { value: 'svg', text: 'Vlastní SVG' }
    ],

    ICONS: [
        { value: 'most', text: 'Silniční most' },
        { value: 'propustek', text: 'Propustek' },
        { value: 'lavka', text: 'Lávka pro chodce' }
    ],

    /* ---------- Symbol položky (SVG v mm) ---------- */
    patchSvg(li, w, h) {
        w = +w || 8; h = +h || 4;
        const cy = h / 2;
        let inner = '';

        if (li.kind === 'line') {
            const lw = +li.width || 1;
            const cw = +li.casingWidth || 0;
            if (cw > 0) {
                inner += `<line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="${li.casing}" stroke-width="${lw + 2 * cw}"/>`;
            }
            if (li.dashed) {
                // „účelová“ – barevný střed, po krajích jen lem
                inner += `<line x1="${w * 0.26}" y1="${cy}" x2="${w * 0.74}" y2="${cy}" stroke="${li.color}" stroke-width="${lw}"/>`;
            } else {
                inner += `<line x1="${cw}" y1="${cy}" x2="${w - cw}" y2="${cy}" stroke="${li.color}" stroke-width="${lw}"/>`;
            }
        } else if (li.kind === 'fill') {
            const sw = +li.strokeWidth || 0;
            inner = `<rect x="${sw / 2 + 0.1}" y="${sw / 2 + 0.1}" width="${w - sw - 0.2}" height="${h - sw - 0.2}" rx="0.35"
                fill="${li.color === 'transparent' ? 'none' : li.color}" stroke="${li.stroke}" stroke-width="${sw}"/>`;
        } else if (li.kind === 'point') {
            const r = Math.min(h, w) * 0.32 * ((+li.size || 100) / 100);
            const sw = +li.strokeWidth || 0.25;
            inner = li.shape === 'square'
                ? `<rect x="${w / 2 - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${li.color}" stroke="${li.stroke || '#000'}" stroke-width="${sw}"/>`
                : `<circle cx="${w / 2}" cy="${cy}" r="${r}" fill="${li.color}" stroke="${li.stroke || '#000'}" stroke-width="${sw}"/>`;
        } else if (li.kind === 'icon') {
            inner = this.iconSvg(li.icon, w, h, li.color || '#000');
        } else if (li.kind === 'svg') {
            const code = String(li.svg || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+=/gi, ' data-x=');
            return `<span class="li-leg-custom">${code}</span>`;
        }
        return `<svg width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" overflow="visible">${inner}</svg>`;
    },

    // Vestavěné značky (kresleno v mm kolem středu patche)
    iconSvg(name, w, h, color) {
        const cx = w / 2 - 1, cy = h / 2;
        const s = 0.28;
        const bridge = (x) => `
            <path d="M${x - 1.6},${cy - 2.1} L${x - 0.6},${cy - 1.1} L${x - 0.6},${cy + 1.1} L${x - 1.6},${cy + 2.1}"
                fill="none" stroke="${color}" stroke-width="${s}" stroke-linejoin="round"/>
            <path d="M${x + 1.6},${cy - 2.1} L${x + 0.6},${cy - 1.1} L${x + 0.6},${cy + 1.1} L${x + 1.6},${cy + 2.1}"
                fill="none" stroke="${color}" stroke-width="${s}" stroke-linejoin="round"/>`;
        if (name === 'most') return bridge(cx);
        if (name === 'lavka') {
            return bridge(cx) +
                `<line x1="${cx - 0.6}" y1="${cy - 0.5}" x2="${cx + 0.6}" y2="${cy - 0.5}" stroke="${color}" stroke-width="${s * 0.8}"/>
                 <line x1="${cx - 0.6}" y1="${cy + 0.5}" x2="${cx + 0.6}" y2="${cy + 0.5}" stroke="${color}" stroke-width="${s * 0.8}"/>
                 <text x="${cx + 2.1}" y="${cy - 0.9}" font-size="2.3" font-weight="900" fill="#e30613">L</text>`;
        }
        if (name === 'propustek') {
            return `<circle cx="${cx - 1.1}" cy="${cy}" r="0.55" fill="none" stroke="${color}" stroke-width="${s}"/>
                    <circle cx="${cx + 1.1}" cy="${cy}" r="0.55" fill="none" stroke="${color}" stroke-width="${s}"/>`;
        }
        return '';
    },

    /* ---------- Editor v panelu ---------- */
    legendItem() {
        return MapApp.layout.getItem('legend');
    },

    changed(rerenderEditor) {
        MapApp.layout.renderItem('legend');
        if (rerenderEditor) this.renderEditor();
        MapApp.app.save();
    },

    renderEditor() {
        const it = this.legendItem();
        const box = document.getElementById('legendItemsEditor');
        if (!box || !it) return;
        box.innerHTML = '';

        it.legendItems.forEach((li, idx) => {
            const card = document.createElement('div');
            card.className = 'leg-row' + (li.kind === 'header' ? ' is-header' : '');

            // Náhled symbolu
            const prev = document.createElement('span');
            prev.className = 'leg-prev';
            if (li.kind !== 'header') prev.innerHTML = this.patchSvg(li, it.patchW, it.patchH);
            card.appendChild(prev);

            const text = document.createElement('input');
            text.type = 'text';
            text.className = 'leg-text';
            text.value = li.text || '';
            text.placeholder = li.kind === 'header' ? 'Nadpis skupiny' : 'Popis položky';
            text.addEventListener('input', () => { li.text = text.value; this.changed(false); });
            card.appendChild(text);

            const btns = document.createElement('div');
            btns.className = 'leg-btns';
            btns.appendChild(this._miniBtn('▲', 'Posunout nahoru', idx === 0, () => this.move(idx, -1)));
            btns.appendChild(this._miniBtn('▼', 'Posunout dolů', idx === it.legendItems.length - 1, () => this.move(idx, 1)));
            const more = this._miniBtn('⋯', 'Upravit symbol', false, () => card.classList.toggle('open'));
            if (li.kind === 'header') more.style.visibility = 'hidden';
            btns.appendChild(more);
            btns.appendChild(this._miniBtn('✕', 'Odstranit', false, () => {
                it.legendItems.splice(idx, 1);
                this.changed(true);
            }, 'danger'));
            card.appendChild(btns);

            if (li.kind !== 'header') card.appendChild(this._detailEditor(li, prev, it));
            box.appendChild(card);
        });
    },

    _miniBtn(label, title, disabled, onClick, extra) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini-btn' + (extra ? ' ' + extra : '');
        b.textContent = label;
        b.title = title;
        b.disabled = !!disabled;
        b.addEventListener('click', onClick);
        return b;
    },

    _detailEditor(li, prev, it) {
        const wrap = document.createElement('div');
        wrap.className = 'leg-detail';
        const refresh = () => {
            prev.innerHTML = this.patchSvg(li, it.patchW, it.patchH);
            this.changed(false);
        };

        const field = (label, input) => {
            const f = document.createElement('label');
            f.className = 'leg-field';
            const s = document.createElement('span');
            s.textContent = label;
            f.appendChild(s);
            f.appendChild(input);
            wrap.appendChild(f);
            return input;
        };
        const color = (key, label, allowNone) => {
            const inp = document.createElement('input');
            inp.type = 'color';
            inp.value = /^#[0-9a-f]{6}$/i.test(li[key]) ? li[key] : '#ffffff';
            inp.addEventListener('input', () => { li[key] = inp.value; if (none) none.checked = false; refresh(); });
            const f = field(label, inp);
            let none = null;
            if (allowNone) {
                none = document.createElement('input');
                none.type = 'checkbox';
                none.title = 'Bez výplně';
                none.checked = li[key] === 'transparent';
                none.addEventListener('change', () => { li[key] = none.checked ? 'transparent' : inp.value; refresh(); });
                const l = document.createElement('label');
                l.className = 'leg-none';
                l.appendChild(none);
                l.appendChild(document.createTextNode('bez'));
                f.parentNode.appendChild(l);
            }
            return f;
        };
        const number = (key, label, step) => {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = step || 0.05;
            inp.min = 0;
            inp.value = li[key] != null ? li[key] : '';
            inp.addEventListener('input', () => { li[key] = parseFloat(inp.value) || 0; refresh(); });
            return field(label, inp);
        };
        const select = (key, label, options) => {
            const inp = document.createElement('select');
            options.forEach(o => inp.appendChild(new Option(o.text, o.value, false, li[key] === o.value)));
            inp.addEventListener('change', () => { li[key] = inp.value; refresh(); });
            return field(label, inp);
        };

        // Druh položky – přepnutí doplní rozumné výchozí hodnoty
        const kindSel = document.createElement('select');
        this.KINDS.filter(k => k.value !== 'header').forEach(k =>
            kindSel.appendChild(new Option(k.text, k.value, false, li.kind === k.value)));
        kindSel.addEventListener('change', () => {
            const defaults = {
                line: { color: '#f2b766', width: 1, casing: '#000000', casingWidth: 0.15, dashed: false },
                fill: { color: '#8a95e6', stroke: '#3a2a1a', strokeWidth: 0.35 },
                point: { color: '#ea521f', stroke: '#000000', strokeWidth: 0.25, shape: 'circle', size: 100 },
                icon: { icon: 'most', color: '#000000' },
                svg: { svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#0288D1"/></svg>' }
            };
            li.kind = kindSel.value;
            Object.entries(defaults[li.kind] || {}).forEach(([k, v]) => { if (li[k] == null) li[k] = v; });
            this.changed(true);
        });
        field('Druh', kindSel);

        if (li.kind === 'line') {
            color('color', 'Barva');
            number('width', 'Šířka (mm)');
            color('casing', 'Lem');
            number('casingWidth', 'Lem (mm)');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!li.dashed;
            chk.addEventListener('change', () => { li.dashed = chk.checked; refresh(); });
            field('Krajní bloky', chk);
        } else if (li.kind === 'fill') {
            color('color', 'Výplň', true);
            color('stroke', 'Obrys');
            number('strokeWidth', 'Obrys (mm)');
        } else if (li.kind === 'point') {
            select('shape', 'Tvar', [{ value: 'circle', text: 'Kruh' }, { value: 'square', text: 'Čtverec' }]);
            color('color', 'Výplň');
            color('stroke', 'Obrys');
            number('size', 'Velikost (%)', 5);
        } else if (li.kind === 'icon') {
            select('icon', 'Značka', this.ICONS);
            color('color', 'Barva');
        } else if (li.kind === 'svg') {
            const ta = document.createElement('textarea');
            ta.rows = 3;
            ta.value = li.svg || '';
            ta.addEventListener('input', () => { li.svg = ta.value; refresh(); });
            field('SVG kód', ta).parentNode.classList.add('wide');
        }
        return wrap;
    },

    move(idx, dir) {
        const arr = this.legendItem().legendItems;
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        this.changed(true);
    },

    addItem(kind) {
        const arr = this.legendItem().legendItems;
        arr.push(kind === 'header'
            ? { kind: 'header', text: 'nová skupina' }
            : { kind: 'line', text: 'nová položka', color: '#0288d1', width: 1, casing: '#000000', casingWidth: 0, dashed: false });
        this.changed(true);
        const rows = document.querySelectorAll('#legendItemsEditor .leg-row');
        const last = rows[rows.length - 1];
        if (last) {
            if (kind !== 'header') last.classList.add('open');
            last.querySelector('.leg-text')?.select();
            last.scrollIntoView({ block: 'nearest' });
        }
    },

    resetDefault() {
        this.legendItem().legendItems = MapApp.defaultLegendItems();
        this.changed(true);
    },

    // Doplnění položek z kategorií načtených dat (záložka Data)
    addFromData() {
        const { state } = MapApp;
        const arr = this.legendItem().legendItems;
        const geom = state.detectedGeomType || 'line';
        const cats = Object.keys(state.categoryColors || {});
        if (!cats.length) {
            MapApp.app.toast('Nejdřív načtěte data a zvolte atribut pro kategorie (záložka Data).', true);
            return;
        }
        cats.forEach(c => {
            const color = state.categoryColors[c];
            if (geom === 'polygon') arr.push({ kind: 'fill', text: c, color, stroke: '#000000', strokeWidth: 0.25 });
            else if (geom === 'point') arr.push({ kind: 'point', text: c, color, stroke: '#000000', strokeWidth: 0.25, shape: 'circle', size: 100 });
            else arr.push({ kind: 'line', text: c, color, width: 1, casing: '#000000', casingWidth: 0, dashed: false });
        });
        this.changed(true);
    }
};
