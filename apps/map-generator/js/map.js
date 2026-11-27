/**
 * Generátor map – mapové okno (Leaflet), podkladové WMS a měřítko
 *
 * Podklady se nenačítají po dlaždicích, ale jako JEDEN obrázek WMS GetMap
 * přes celé mapové okno (stejně jako QGIS při tisku). Odpadají tak bílé
 * „spáry“ mezi dlaždicemi při neceločíselném zoomu a obrázek se dá
 * vyžádat ve vyšším rozlišení (Kvalita 2× ≈ 190 dpi na papíře).
 *
 * Měřítko se počítá pro tisk 1:1 v mm: 1 CSS px = 0,2646 mm na papíře.
 */

window.MapApp = window.MapApp || {};

/* ---------- Jednoobrázková vrstva WMS ---------- */
MapApp.WmsImageLayer = L.Layer.extend({
    options: { pad: 0.15, quality: 2, opacity: 1, zIndex: 1, className: '' },

    initialize(cfg, options) {
        this._cfg = cfg;
        this._layers = cfg.layers;
        L.setOptions(this, options);
    },

    onAdd(map) {
        this._map = map;
        this._overlay = null;
        this._seq = 0;
        this._pending = 0;
        map.on('moveend zoomend resize', this._scheduleUpdate, this);
        this._update();
    },

    onRemove(map) {
        map.off('moveend zoomend resize', this._scheduleUpdate, this);
        clearTimeout(this._timer);
        if (this._overlay) map.removeLayer(this._overlay);
        this._overlay = null;
        this._setPending(0);
    },

    setLayers(layers) {
        if (layers === this._layers) return;
        this._layers = layers;
        if (this._map) this._update();
    },

    setQuality(q) {
        this.options.quality = q;
        if (this._map) this._update();
    },

    isLoading() {
        return this._pending > 0;
    },

    _scheduleUpdate() {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._update(), 180);
    },

    _setPending(n) {
        this._pending = n;
        MapApp.mapService.updateLoadingIndicator();
    },

    _update() {
        const map = this._map;
        if (!map) return;
        const size = map.getSize();
        if (!size.x || !size.y) return;

        const pad = this.options.pad;
        const padPx = L.point(Math.round(size.x * pad), Math.round(size.y * pad));
        const nwPx = L.point(-padPx.x, -padPx.y);
        const sePx = size.add(padPx);
        const nw = map.containerPointToLatLng(nwPx);
        const se = map.containerPointToLatLng(sePx);
        const bounds = L.latLngBounds(nw, se);

        let q = this.options.quality || 1;
        let w = (sePx.x - nwPx.x) * q;
        let h = (sePx.y - nwPx.y) * q;
        const maxSize = this._cfg.maxSize || 4096;
        const k = Math.min(1, maxSize / w, maxSize / h);
        w = Math.round(w * k);
        h = Math.round(h * k);

        const crs = L.CRS.EPSG3857;
        const pNW = crs.project(nw);
        const pSE = crs.project(se);
        const params = {
            SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap',
            LAYERS: this._layers, STYLES: '',
            CRS: 'EPSG:3857',
            BBOX: [pNW.x, pSE.y, pSE.x, pNW.y].map(v => v.toFixed(2)).join(','),
            WIDTH: w, HEIGHT: h,
            FORMAT: this._cfg.format,
            TRANSPARENT: this._cfg.transparent ? 'TRUE' : 'FALSE'
        };
        const url = this._cfg.url + '?' + Object.keys(params)
            .map(k2 => k2 + '=' + encodeURIComponent(params[k2])).join('&');

        const seq = ++this._seq;
        this._setPending(1);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (seq !== this._seq || !this._map) return;
            const overlay = L.imageOverlay(url, bounds, {
                opacity: this.options.opacity,
                zIndex: this.options.zIndex,
                className: 'wms-image ' + this.options.className,
                interactive: false
            }).addTo(this._map);
            if (this._overlay) this._map.removeLayer(this._overlay);
            this._overlay = overlay;
            this._setPending(0);
        };
        img.onerror = () => {
            if (seq !== this._seq) return;
            this._setPending(0);
            MapApp.app.toast('Podkladovou mapu se nepodařilo načíst (WMS ČÚZK).', true);
        };
        img.src = url;
    }
});

/* ---------- Služba mapy ---------- */
MapApp.mapService = {
    _ignoreMove: false,

    initMap() {
        const { state, doc, CONFIG } = MapApp;

        state.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0,
            zoomDelta: 0.25,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            fadeAnimation: false,
            zoomAnimation: false,
            inertia: false
        });

        state.orto = new MapApp.WmsImageLayer(CONFIG.WMS.orto, { zIndex: 1 });
        state.kn = new MapApp.WmsImageLayer(CONFIG.WMS.kn, { zIndex: 2, quality: 2 });
        state.labelMarkersGroup = L.layerGroup().addTo(state.map);

        this.setView(doc.map.center, doc.map.scale);
        this.applyBasemap();

        state.map.on('moveend', () => {
            if (this._ignoreMove) return;
            const c = state.map.getCenter();
            MapApp.doc.map.center = [+c.lat.toFixed(6), +c.lng.toFixed(6)];
            MapApp.app.save();
        });

        // Kolečko myši: přepínání mezi pevnými měřítky (kolem kurzoru)
        const container = state.map.getContainer();
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) return; // Ctrl+kolečko = zoom náhledu stránky
            e.preventDefault();
            e.stopPropagation();
            if (MapApp.doc.map.lockScale) return;
            this.stepScale(e.deltaY > 0 ? 1 : -1, e);
        }, { passive: false });
    },

    /* --- převody zoom ↔ měřítko --- */
    zoomForScale(scale, lat) {
        const mpp = scale * MapApp.CONFIG.MM_PER_PX / 1000;
        return Math.log2(40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * mpp));
    },

    scaleForZoom(zoom, lat) {
        const mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
        return mpp * 1000 / MapApp.CONFIG.MM_PER_PX;
    },

    currentScale() {
        return MapApp.doc.map.scale;
    },

    setView(center, scale) {
        const { state } = MapApp;
        if (!state.map) return;
        const zoom = this.zoomForScale(scale, center[0]);
        this._ignoreMove = true;
        state.map.setView(center, zoom, { animate: false });
        this._ignoreMove = false;
    },

    setScale(scale, aroundEvent) {
        const { state, doc } = MapApp;
        scale = Math.max(50, Math.min(1000000, Math.round(scale)));
        doc.map.scale = scale;
        if (state.map) {
            const lat = state.map.getCenter().lat;
            const zoom = this.zoomForScale(scale, lat);
            if (aroundEvent) {
                state.map.setZoomAround(this._containerPoint(aroundEvent), zoom, { animate: false });
            } else {
                state.map.setZoom(zoom, { animate: false });
            }
        }
        MapApp.panel.syncScaleInputs();
        MapApp.layout.renderItem('scale');
        MapApp.app.save();
    },

    stepScale(dir, aroundEvent) {
        const list = MapApp.CONFIG.SCALES;
        const cur = MapApp.doc.map.scale;
        let next;
        if (dir > 0) next = list.find(s => s > cur + 0.5) || list[list.length - 1];
        else next = [...list].reverse().find(s => s < cur - 0.5) || list[0];
        this.setScale(next, aroundEvent);
    },

    // Bod v kontejneru mapy s ohledem na zvětšení náhledu (transform: scale)
    _containerPoint(e) {
        const rect = MapApp.state.map.getContainer().getBoundingClientRect();
        const z = MapApp.canvasZoom.scale || 1;
        return L.point((e.clientX - rect.left) / z, (e.clientY - rect.top) / z);
    },

    /* --- podklady --- */
    applyBasemap() {
        const { state, doc, CONFIG } = MapApp;
        if (!state.map) return;
        const m = doc.map;

        state.orto.setQuality(m.quality);
        state.kn.setQuality(Math.min(2, m.quality));

        if (m.basemap === 'orto') {
            if (!state.map.hasLayer(state.orto)) state.map.addLayer(state.orto);
        } else if (state.map.hasLayer(state.orto)) {
            state.map.removeLayer(state.orto);
        }

        if (m.kn) {
            // Na ortofotu světlé (inverzní) hranice, na bílém podkladu tmavé
            const inverse = m.basemap === 'orto' && m.knInverse;
            state.kn.setLayers(inverse ? CONFIG.WMS.kn.layersInverse : CONFIG.WMS.kn.layers);
            if (!state.map.hasLayer(state.kn)) state.map.addLayer(state.kn);
        } else if (state.map.hasLayer(state.kn)) {
            state.map.removeLayer(state.kn);
        }

        document.getElementById('map')?.classList.toggle('no-basemap', m.basemap !== 'orto');
        this.updateLoadingIndicator();
    },

    isLoading() {
        const { state } = MapApp;
        return [state.orto, state.kn].some(l => l && state.map && state.map.hasLayer(l) && l.isLoading());
    },

    updateLoadingIndicator() {
        const el = document.getElementById('mapLoading');
        if (el) el.classList.toggle('show', this.isLoading());
    },

    // Počká, až se dotáhnou podklady (před tiskem)
    whenLoaded(timeoutMs) {
        return new Promise(resolve => {
            const t0 = Date.now();
            const tick = () => {
                if (!this.isLoading() || Date.now() - t0 > (timeoutMs || 15000)) resolve();
                else setTimeout(tick, 150);
            };
            setTimeout(tick, 250);
        });
    },

    invalidate() {
        const { state } = MapApp;
        if (!state.map) return;
        const c = L.latLng(MapApp.doc.map.center);
        state.map.invalidateSize({ pan: false });
        this.setView([c.lat, c.lng], MapApp.doc.map.scale);
    },

    /* --- vyhledání obce / části obce (RÚIAN) --- */
    async searchPlaces(text) {
        const t = text.trim();
        if (t.length < 2) return [];
        const esc = t.replace(/'/g, "''");
        const q = (layer, fields) => {
            const params = new URLSearchParams({
                f: 'json',
                where: `UPPER(nazev) LIKE UPPER('${esc}%')`,
                outFields: fields,
                returnGeometry: 'false',
                orderByFields: 'nazev',
                resultRecordCount: '8'
            });
            return fetch(`${MapApp.CONFIG.RUIAN_URL}/${layer}/query?${params}`)
                .then(r => r.json()).then(d => (d.features || []).map(f => f.attributes));
        };
        const [obce, casti] = await Promise.all([q(12, 'kod,nazev'), q(11, 'kod,nazev,obec')]);

        // Názvy nadřazených obcí pro části obce
        const parentKody = [...new Set(casti.map(c => c.obec))].filter(Boolean);
        let parents = {};
        if (parentKody.length) {
            const params = new URLSearchParams({
                f: 'json', where: `kod IN (${parentKody.join(',')})`,
                outFields: 'kod,nazev', returnGeometry: 'false'
            });
            const d = await fetch(`${MapApp.CONFIG.RUIAN_URL}/12/query?${params}`).then(r => r.json());
            (d.features || []).forEach(f => { parents[f.attributes.kod] = f.attributes.nazev; });
        }

        return [
            ...obce.map(o => ({ layer: 12, kod: o.kod, name: o.nazev, note: 'obec' })),
            ...casti
                .filter(c => !(parents[c.obec] === c.nazev)) // část shodná s obcí – stačí obec
                .map(c => ({ layer: 11, kod: c.kod, name: c.nazev, note: 'část obce ' + (parents[c.obec] || '') }))
        ].slice(0, 12);
    },

    async goToPlace(place) {
        const params = new URLSearchParams({
            f: 'json', where: `kod=${place.kod}`, outFields: 'kod',
            returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.0005'
        });
        const d = await fetch(`${MapApp.CONFIG.RUIAN_URL}/${place.layer}/query?${params}`).then(r => r.json());
        const g = d.features && d.features[0] && d.features[0].geometry;
        if (!g) throw new Error('Místo nemá geometrii.');
        if (g.x !== undefined) {
            MapApp.doc.map.center = [g.y, g.x];
            this.setView(MapApp.doc.map.center, MapApp.doc.map.scale);
            return;
        }
        // Polygon obce → přizpůsobit rámu na nejbližší „hezké“ měřítko
        const pts = [];
        (g.rings || []).forEach(r => r.forEach(p => pts.push([p[1], p[0]])));
        const b = L.latLngBounds(pts);
        const size = MapApp.state.map.getSize();
        const widthM = b.getNorthWest().distanceTo(b.getNorthEast());
        const heightM = b.getNorthWest().distanceTo(b.getSouthWest());
        const frameWmm = size.x * MapApp.CONFIG.MM_PER_PX;
        const frameHmm = size.y * MapApp.CONFIG.MM_PER_PX;
        const need = Math.max(widthM * 1000 / frameWmm, heightM * 1000 / frameHmm) * 1.05;
        const scale = MapApp.CONFIG.SCALES.find(s => s >= need) || Math.ceil(need / 1000) * 1000;
        const c = b.getCenter();
        MapApp.doc.map.center = [c.lat, c.lng];
        MapApp.doc.map.scale = scale;
        this.setView(MapApp.doc.map.center, scale);
        MapApp.panel.syncScaleInputs();
        MapApp.layout.renderItem('scale');
        MapApp.app.save();
    }
};
