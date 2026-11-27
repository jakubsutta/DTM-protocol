/**
 * Generátor map – rozvržení stránky (jako tiskové rozvržení v QGIS)
 *
 * - stránka A3/A4, vodítka, rám mapy,
 * - prvky rozvržení (nadpis, číslo mapy, legenda, měřítko, tiráž, severka,
 *   vlastní texty) s polohou v mm vůči stránce a referenčním bodem (rohem),
 * - výběr, tažení myší s přichytáváním k vodítkům a rámu, posun šipkami,
 * - zvětšení náhledu (transform: scale) a přizpůsobení oknu.
 */

window.MapApp = window.MapApp || {};

const PX_PER_MM = 96 / 25.4;

// Referenční bod → posun prvku (v %) vůči souřadnici x, y
const ANCHORS = {
    tl: [0, 0], tc: [-50, 0], tr: [-100, 0],
    ml: [0, -50], mc: [-50, -50], mr: [-100, -50],
    bl: [0, -100], bc: [-50, -100], br: [-100, -100]
};

MapApp.ANCHORS = ANCHORS;

MapApp.layout = {
    /* =========================== Stránka =========================== */
    pageSize() {
        return MapApp.pageSize(MapApp.doc.page.format, MapApp.doc.page.orient);
    },

    renderPage() {
        const doc = MapApp.doc;
        const [W, H] = this.pageSize();
        const page = document.getElementById('page');
        page.style.width = W + 'mm';
        page.style.height = H + 'mm';

        // Pravidlo pro tisk – velikost papíru
        let ps = document.getElementById('dynamicPrintStyle');
        if (!ps) {
            ps = document.createElement('style');
            ps.id = 'dynamicPrintStyle';
            document.head.appendChild(ps);
        }
        // Pevná výška těla při tisku – jinak Chrome občas přidá prázdnou 2. stranu
        ps.textContent = `@page { size: ${doc.page.format} ${doc.page.orient}; margin: 0; }
@media print { html, body { width: ${W}mm !important; height: ${H}mm !important; overflow: hidden !important; } }`;

        this.applyStyleVars();
        this.renderGuides();
        this.renderFrame();
        this.renderAllItems();
        MapApp.canvasZoom.applySize();
    },

    applyStyleVars() {
        const s = MapApp.doc.style;
        const page = document.getElementById('page');
        page.style.setProperty('--box-bg', MapApp.rgba(s.boxBg, s.boxOpacity));
        page.style.setProperty('--box-border', s.boxBorder + 'mm');
        page.style.setProperty('--box-border-color', s.boxBorderColor);
        page.style.setProperty('--box-radius', s.boxRadius + 'mm');
        page.style.setProperty('--box-pad', s.boxPadding + 'mm');
        page.style.setProperty('--accent', s.accent);
        page.style.setProperty('--text', s.textColor);
        page.style.setProperty('--map-font', MapApp.CONFIG.FONT_STACK);
    },

    /* =========================== Vodítka =========================== */
    renderGuides() {
        const g = MapApp.doc.guides;
        const layer = document.getElementById('guidesLayer');
        layer.innerHTML = '';
        layer.classList.toggle('hidden', !g.show);
        g.h.forEach(y => {
            const el = document.createElement('div');
            el.className = 'guide guide-h';
            el.style.top = y + 'mm';
            layer.appendChild(el);
        });
        g.v.forEach(x => {
            const el = document.createElement('div');
            el.className = 'guide guide-v';
            el.style.left = x + 'mm';
            layer.appendChild(el);
        });
    },

    // Rám podle vodítek: krajní vodorovná a svislá vodítka
    frameFromGuides() {
        const g = MapApp.doc.guides;
        const [W, H] = this.pageSize();
        const v = g.v.length >= 2 ? g.v.slice().sort((a, b) => a - b) : [0, W];
        const h = g.h.length >= 2 ? g.h.slice().sort((a, b) => a - b) : [0, H];
        return { x: v[0], y: h[0], w: v[v.length - 1] - v[0], h: h[h.length - 1] - h[0] };
    },

    /* =========================== Rám mapy =========================== */
    renderFrame() {
        const f = MapApp.doc.frame;
        const el = document.getElementById('mapFrame');
        el.style.left = f.x + 'mm';
        el.style.top = f.y + 'mm';
        el.style.width = f.w + 'mm';
        el.style.height = f.h + 'mm';
        el.style.setProperty('--frame-border', f.border + 'mm');
        el.style.setProperty('--frame-color', f.borderColor);
        MapApp.mapService.invalidate();
    },

    /**
     * Změna rámu (formát, vodítka, ruční úprava). Prvky rozvržení se posunou
     * spolu s rámem – drží si vzdálenost od toho okraje rámu, ke kterému
     * jsou ukotvené (podle referenčního bodu).
     */
    setFrame(nf, reflow) {
        const of = Object.assign({}, MapApp.doc.frame);
        Object.assign(MapApp.doc.frame, nf);
        if (reflow !== false) this.reflowItems(of, MapApp.doc.frame);
        this.renderFrame();
        this.renderAllItems();
    },

    reflowItems(of, nf) {
        const mapAxis = (v, a0, aLen, b0, bLen, side) => {
            if (side === 'start') return b0 + (v - a0);
            if (side === 'end') return (b0 + bLen) - ((a0 + aLen) - v);
            return aLen ? b0 + (v - a0) / aLen * bLen : v;
        };
        MapApp.doc.items.forEach(it => {
            const a = it.anchor || 'tl';
            const hSide = a[1] === 'l' ? 'start' : a[1] === 'r' ? 'end' : 'mid';
            const vSide = a[0] === 't' ? 'start' : a[0] === 'b' ? 'end' : 'mid';
            it.x = MapApp.round(mapAxis(it.x, of.x, of.w, nf.x, nf.w, hSide), 0.1);
            it.y = MapApp.round(mapAxis(it.y, of.y, of.h, nf.y, nf.h, vSide), 0.1);
        });
    },

    /* =========================== Prvky =========================== */
    getItem(id) {
        return MapApp.doc.items.find(i => i.id === id);
    },

    renderAllItems() {
        const layer = document.getElementById('itemsLayer');
        // Odstranit prvky, které už v dokumentu nejsou
        layer.querySelectorAll('.layout-item').forEach(el => {
            if (!this.getItem(el.dataset.id)) el.remove();
        });
        MapApp.doc.items.forEach(it => this.renderItem(it.id));
    },

    renderItem(id) {
        const it = this.getItem(id);
        const layer = document.getElementById('itemsLayer');
        if (!it || !layer) return;

        let el = layer.querySelector(`.layout-item[data-id="${CSS.escape(id)}"]`);
        if (!el) {
            el = document.createElement('div');
            el.className = 'layout-item';
            el.dataset.id = id;
            layer.appendChild(el);
            this._bindItem(el);
        }

        el.classList.toggle('hidden', !it.visible);
        el.classList.toggle('boxed', !!it.box);
        el.classList.toggle('selected', MapApp.state.selectedId === id);
        el.dataset.type = it.type;
        this.positionItem(el, it);

        const R = MapApp.renderers[it.type];
        el.innerHTML = R ? R(it) : '';
    },

    positionItem(el, it) {
        const [ax, ay] = ANCHORS[it.anchor] || ANCHORS.tl;
        el.style.left = it.x + 'mm';
        el.style.top = it.y + 'mm';
        el.style.transform = `translate(${ax}%, ${ay}%)`;
    },

    // Rozměry prvku v mm (bez zvětšení náhledu)
    itemSizeMm(id) {
        const el = document.querySelector(`.layout-item[data-id="${CSS.escape(id)}"]`);
        if (!el) return { w: 0, h: 0 };
        return { w: el.offsetWidth / PX_PER_MM, h: el.offsetHeight / PX_PER_MM };
    },

    // Levý horní roh prvku (mm) ze souřadnic referenčního bodu
    itemBox(it, x, y) {
        const { w, h } = this.itemSizeMm(it.id);
        const [ax, ay] = ANCHORS[it.anchor] || ANCHORS.tl;
        const left = (x === undefined ? it.x : x) + ax / 100 * w;
        const top = (y === undefined ? it.y : y) + ay / 100 * h;
        return { left, top, w, h };
    },

    /**
     * Zarovnání prvku do rohu/středu rámu mapy s odsazením (inset).
     * pos = dvojice znaků jako u referenčního bodu (tl, tc, …, br).
     * Referenční bod se nastaví na stejný roh – prvek pak při změně obsahu
     * „roste“ směrem od rohu, jako v QGIS.
     */
    alignItem(id, pos) {
        const it = this.getItem(id);
        if (!it) return;
        const f = MapApp.doc.frame;
        const ins = MapApp.doc.style.inset;
        const xs = { l: f.x + ins, c: f.x + f.w / 2, r: f.x + f.w - ins };
        const ys = { t: f.y + ins, m: f.y + f.h / 2, b: f.y + f.h - ins };
        it.anchor = pos;
        it.x = MapApp.round(xs[pos[1]], 0.1);
        it.y = MapApp.round(ys[pos[0]], 0.1);
        this.renderItem(id);
        MapApp.panel.syncItemPosition(id);
        MapApp.app.save();
    },

    // Změna referenčního bodu bez posunu prvku na stránce
    setAnchor(id, anchor) {
        const it = this.getItem(id);
        if (!it) return;
        const box = this.itemBox(it);
        const [ax, ay] = ANCHORS[anchor] || ANCHORS.tl;
        it.anchor = anchor;
        it.x = MapApp.round(box.left - ax / 100 * box.w, 0.1);
        it.y = MapApp.round(box.top - ay / 100 * box.h, 0.1);
        this.renderItem(id);
        MapApp.panel.syncItemPosition(id);
        MapApp.app.save();
    },

    select(id) {
        MapApp.state.selectedId = id;
        document.querySelectorAll('.layout-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.id === id);
        });
        MapApp.panel.highlightItemCard(id);
    },

    /* =========================== Tažení a přichytávání =========================== */
    _bindItem(el) {
        el.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const id = el.dataset.id;
            this.select(id);
            this._startDrag(e, id, el);
        });
        el.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            MapApp.panel.openItem(el.dataset.id, true);
        });
        // Kolečko nad prvkem posouvá podkladovou mapu jako by prvek nebyl
        el.addEventListener('wheel', (e) => {
            if (e.ctrlKey) return;
            e.preventDefault();
            if (!MapApp.doc.map.lockScale) MapApp.mapService.stepScale(e.deltaY > 0 ? 1 : -1, e);
        }, { passive: false });
    },

    _snapCandidates() {
        const doc = MapApp.doc;
        const f = doc.frame;
        const ins = doc.style.inset;
        const [W, H] = this.pageSize();
        const xs = [f.x, f.x + f.w, f.x + ins, f.x + f.w - ins, W / 2];
        const ys = [f.y, f.y + f.h, f.y + ins, f.y + f.h - ins, H / 2];
        if (doc.guides.snap) {
            xs.push(...doc.guides.v);
            ys.push(...doc.guides.h);
        }
        // Hrany ostatních viditelných prvků
        doc.items.forEach(o => {
            if (!o.visible || o.id === this._dragId) return;
            const b = this.itemBox(o);
            if (!b.w) return;
            xs.push(b.left, b.left + b.w);
            ys.push(b.top, b.top + b.h);
        });
        return { xs, ys };
    },

    _startDrag(e, id, el) {
        const it = this.getItem(id);
        if (!it) return;
        this._dragId = id;
        const startX = e.clientX, startY = e.clientY;
        const x0 = it.x, y0 = it.y;
        const zoom = MapApp.canvasZoom.scale;
        const cand = this._snapCandidates();
        const { w, h } = this.itemSizeMm(id);
        const [ax, ay] = ANCHORS[it.anchor] || ANCHORS.tl;
        let moved = false;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');

        const onMove = (ev) => {
            const dx = (ev.clientX - startX) / (PX_PER_MM * zoom);
            const dy = (ev.clientY - startY) / (PX_PER_MM * zoom);
            if (!moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
            moved = true;
            let nx = x0 + dx, ny = y0 + dy;
            let snapX = null, snapY = null;

            if (!ev.altKey) {
                const thr = 7 / (PX_PER_MM * zoom); // ~7 px na obrazovce
                const left = nx + ax / 100 * w;
                const top = ny + ay / 100 * h;
                let best = thr;
                [[left, 0], [left + w / 2, 0.5], [left + w, 1]].forEach(([edge, k]) => {
                    cand.xs.forEach(c => {
                        const d = Math.abs(edge - c);
                        if (d < best) { best = d; snapX = c; nx = c - k * w - ax / 100 * w; }
                    });
                });
                best = thr;
                [[top, 0], [top + h / 2, 0.5], [top + h, 1]].forEach(([edge, k]) => {
                    cand.ys.forEach(c => {
                        const d = Math.abs(edge - c);
                        if (d < best) { best = d; snapY = c; ny = c - k * h - ay / 100 * h; }
                    });
                });
            }

            it.x = MapApp.round(nx, 0.1);
            it.y = MapApp.round(ny, 0.1);
            this.positionItem(el, it);
            this._showSnapLines(snapX, snapY);
            MapApp.panel.syncItemPosition(id);
        };

        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onUp);
            el.classList.remove('dragging');
            this._showSnapLines(null, null);
            this._dragId = null;
            if (moved) MapApp.app.save();
        };

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
    },

    _showSnapLines(x, y) {
        const lx = document.getElementById('snapLineX');
        const ly = document.getElementById('snapLineY');
        if (lx) { lx.style.display = x === null ? 'none' : 'block'; if (x !== null) lx.style.left = x + 'mm'; }
        if (ly) { ly.style.display = y === null ? 'none' : 'block'; if (y !== null) ly.style.top = y + 'mm'; }
    },

    // Posun vybraného prvku šipkami (0,5 mm, se Shiftem 5 mm)
    nudgeSelected(dx, dy) {
        const id = MapApp.state.selectedId;
        const it = id && this.getItem(id);
        if (!it) return false;
        it.x = MapApp.round(it.x + dx, 0.1);
        it.y = MapApp.round(it.y + dy, 0.1);
        this.renderItem(id);
        MapApp.panel.syncItemPosition(id);
        MapApp.app.save();
        return true;
    }
};

/* =========================== Zvětšení náhledu =========================== */
MapApp.canvasZoom = {
    scale: 1,
    MIN: 0.2,
    MAX: 2,

    applySize() {
        const page = document.getElementById('page');
        const scaler = document.getElementById('pageScaler');
        const label = document.getElementById('zoomLevelLabel');
        if (!page || !scaler) return;
        const [W, H] = MapApp.layout.pageSize();
        page.style.transform = `scale(${this.scale})`;
        scaler.style.width = (W * PX_PER_MM * this.scale) + 'px';
        scaler.style.height = (H * PX_PER_MM * this.scale) + 'px';
        if (label) label.textContent = Math.round(this.scale * 100) + ' %';
        if (window.PreviewActions) window.PreviewActions.update();
    },

    set(s) {
        this.scale = Math.max(this.MIN, Math.min(this.MAX, Math.round(s * 100) / 100));
        this.applySize();
    },

    zoomIn() { this.set(this.scale * 1.15); },
    zoomOut() { this.set(this.scale / 1.15); },

    fitToView() {
        const area = document.getElementById('canvasArea');
        if (!area) return;
        const [W, H] = MapApp.layout.pageSize();
        const availW = area.clientWidth - 140; // odsazení + místo pro plovoucí tlačítka
        const availH = area.clientHeight - 100;
        const s = Math.min(availW / (W * PX_PER_MM), availH / (H * PX_PER_MM));
        this.set(Math.max(this.MIN, Math.floor(s * 100) / 100));
    }
};
