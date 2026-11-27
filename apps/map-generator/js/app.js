/**
 * Generátor map – start aplikace, ukládání, šablony, tisk a klávesnice
 */

window.MapApp = window.MapApp || {};

MapApp.app = {
    _saveTimer: null,

    /* ---------- Načtení / uložení dokumentu ---------- */
    loadDoc() {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(MapApp.CONFIG.STORAGE_KEY) || 'null');
        } catch (e) { saved = null; }
        return this.normalize(saved);
    },

    // Doplní chybějící klíče z výchozího dokumentu (starší uložení, ruční JSON)
    normalize(d) {
        if (!d || d.version !== 2 || !d.page) return MapApp.defaultDoc();
        const def = MapApp.defaultDoc(d.page.format, d.page.orient);
        const out = Object.assign({}, def, d);
        ['page', 'guides', 'frame', 'map', 'style'].forEach(k => {
            out[k] = Object.assign({}, def[k], d[k] || {});
        });
        if (!Array.isArray(out.items)) out.items = def.items;
        // Vestavěné prvky, které v uložení chybí, doplníme (skryté)
        def.items.forEach(di => {
            const ex = out.items.find(i => i.id === di.id);
            if (!ex) out.items.push(Object.assign({}, di, { visible: false }));
            else Object.keys(di).forEach(k => { if (ex[k] === undefined) ex[k] = di[k]; });
        });
        return out;
    },

    save() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(MapApp.CONFIG.STORAGE_KEY, JSON.stringify(MapApp.doc));
            } catch (e) { /* plné úložiště / soukromé okno – nevadí */ }
        }, 300);
    },

    // Kompletní překreslení po načtení šablony / obnovení
    applyDoc(doc) {
        MapApp.doc = this.normalize(doc);
        MapApp.state.selectedId = null;
        MapApp.layout.renderPage();
        MapApp.mapService.setView(MapApp.doc.map.center, MapApp.doc.map.scale);
        MapApp.mapService.applyBasemap();
        MapApp.panel.syncAll();
        MapApp.canvasZoom.fitToView();
        this.save();
    },

    /* ---------- Šablona (JSON) ---------- */
    exportTemplate() {
        const doc = MapApp.doc;
        const num = (doc.items.find(i => i.id === 'mapnum') || {}).text || 'mapa';
        const name = 'sablona-' + num.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
        const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        this.toast('Šablona uložena (' + name + ').');
    },

    importTemplate(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const d = JSON.parse(reader.result);
                if (!d || d.version !== 2) throw new Error('Neznámý formát šablony.');
                this.applyDoc(d);
                this.toast('Šablona načtena.');
            } catch (e) {
                this.toast('Šablonu nelze načíst: ' + e.message, true);
            }
        };
        reader.readAsText(file);
    },

    resetAll() {
        if (!confirm('Obnovit výchozí rozvržení? Všechny úpravy mapy (texty, legenda, polohy prvků) se ztratí.')) return;
        const keepMap = MapApp.doc.map;
        const d = MapApp.defaultDoc();
        d.map.center = keepMap.center;
        d.map.scale = keepMap.scale;
        this.applyDoc(d);
        this.toast('Rozvržení obnoveno.');
    },

    /* ---------- Tisk / PDF ---------- */
    async print() {
        MapApp.layout.select(null);
        if (MapApp.mapService.isLoading()) {
            this.toast('Čekám na dočtení podkladové mapy…');
            await MapApp.mapService.whenLoaded(20000);
        }
        // Název souboru PDF = číslo mapy
        const oldTitle = document.title;
        const num = (MapApp.doc.items.find(i => i.id === 'mapnum') || {}).text;
        if (num) document.title = num.replace(/\s+/g, '_');
        window.print();
        setTimeout(() => { document.title = oldTitle; }, 500);
    },

    /* ---------- Hláška ---------- */
    toast(msg, isError) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 5000 : 2600);
    },

    /* ---------- Události ---------- */
    wireEvents() {
        const bind = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

        bind('btnPrintPdf', 'click', () => this.print());
        bind('btnSaveTpl', 'click', () => this.exportTemplate());
        bind('btnLoadTpl', 'click', () => document.getElementById('tplFile').click());
        bind('tplFile', 'change', (e) => { this.importTemplate(e.target.files[0]); e.target.value = ''; });
        bind('btnReset', 'click', () => this.resetAll());
        bind('btnAddText', 'click', () => MapApp.panel.addCustomText());

        bind('btnZoomIn', 'click', () => MapApp.canvasZoom.zoomIn());
        bind('btnZoomOut', 'click', () => MapApp.canvasZoom.zoomOut());
        bind('btnZoomFit', 'click', () => MapApp.canvasZoom.fitToView());

        // Ctrl+kolečko = zvětšení náhledu stránky
        bind('canvasArea', 'wheel', (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            if (e.deltaY < 0) MapApp.canvasZoom.zoomIn(); else MapApp.canvasZoom.zoomOut();
        });

        // Klik mimo prvky = zrušit výběr
        bind('canvasArea', 'pointerdown', (e) => {
            if (!e.target.closest('.layout-item')) MapApp.layout.select(null);
        });

        // Ctrl+P → stejná cesta jako tlačítko (počká na podklad)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                this.print();
                return;
            }
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
            const step = e.shiftKey ? 5 : 0.5;
            const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (moves[e.key] && MapApp.layout.nudgeSelected(...moves[e.key])) e.preventDefault();
            if (e.key === 'Escape') MapApp.layout.select(null);
        });

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => MapApp.canvasZoom.fitToView(), 150);
        });
    }
};

MapApp.init = function () {
    MapApp.doc = MapApp.app.loadDoc();

    MapApp.layout.renderPage();
    MapApp.mapService.initMap();
    MapApp.panel.init();
    MapApp.app.wireEvents();
    MapApp.ui.toggleSymbolMode();
    if (MapApp.data && MapApp.data.wireEvents) MapApp.data.wireEvents();

    let tab = 'tab-stranka';
    try { tab = localStorage.getItem('jenda-mapgen-tab') || tab; } catch (e) { /* nevadí */ }
    if (document.getElementById(tab)) MapApp.panel.switchTab(tab);

    requestAnimationFrame(() => {
        MapApp.canvasZoom.fitToView();
        MapApp.mapService.invalidate();
    });
};

document.addEventListener('DOMContentLoaded', () => MapApp.init());
